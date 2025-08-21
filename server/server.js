// server/server.js — viem + lowdb (tanpa native build)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { monadTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { addScore, getLeaderboard, getPlayer } from './db.js';

// ----- env -----
const PORT = process.env.PORT || 3000;
const ALLOW = (process.env.ALLOW_ORIGIN || '*')
  .split(',')
  .map(s => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const RPC = process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PK = process.env.SERVER_PRIVATE_KEY; // address ini harus didaftarkan sebagai _game
const CONTRACT = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';
const EXPLORER_TX_PREFIX = process.env.EXPLORER_TX_PREFIX || ''; // optional

// ----- chain clients -----
if (!PK) {
  console.error('SERVER_PRIVATE_KEY missing in .env');
  process.exit(1);
}
const account = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) });

// ABI minimal untuk update
const ABI = parseAbi([
  'function updatePlayerData(address player, uint256 scoreAmount, uint256 transactionAmount)'
]);

// ----- app -----
const app = express();
app.set('trust proxy', 1);

// Global anti-cache (mobile Safari/Chrome)
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  res.set('Vary', 'Origin');
  next();
});

app.use(helmet());
app.use(express.json());

// CORS dengan normalisasi origin (tanpa trailing slash)
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);        // curl/postman
    if (ALLOW.includes('*')) return cb(null, true);
    const o = origin.replace(/\/+$/, '');
    const ok = ALLOW.some(a => a === o);
    cb(ok ? null : new Error('CORS blocked'), ok);
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(morgan('dev'));

const limiter = new RateLimiterMemory({ points: 8, duration: 10 });
app.use(async (req, res, next) => {
  try {
    await limiter.consume(req.ip);
    next();
  } catch {
    res.status(429).json({ error: 'Too many requests' });
  }
});

// no-cache helper
function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

app.get('/health', (req, res) => res.json({ ok: true }));

// Debug signer (cek balance & address yang dipakai)
app.get('/debug/signer', async (req, res) => {
  noStore(res);
  try {
    const bal = await publicClient.getBalance({ address: account.address });
    res.json({ address: account.address, balanceWei: bal.toString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit score → simpan ke DB → kirim tx on-chain (incremental)
app.post('/submit-score', async (req, res) => {
  noStore(res);
  try {
    const { player, username, score } = req.body || {};
    if (!player || typeof score !== 'number' || score <= 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // simpan lokal dulu (untuk leaderboard & grafik)
    await addScore({ player, username, score });

    // kirim ke chain — tambahkan (bukan total)
    const hash = await walletClient.writeContract({
      address: CONTRACT,
      abi: ABI,
      functionName: 'updatePlayerData',
      args: [player, BigInt(Math.floor(score)), 1n]
    });

    const explorerUrl = EXPLORER_TX_PREFIX ? `${EXPLORER_TX_PREFIX}${hash}` : undefined;
    return res.json({ ok: true, tx: hash, explorerUrl });
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || 'tx error';
    res.status(500).json({ stage: 'error', error: msg });
  }
});

// ---- helper serialize receipt ----
function serializeMined(hash, nonce, rcpt, head) {
  const blockNumber = Number(rcpt.blockNumber);
  const confirmations = Math.max(1, Number(head - rcpt.blockNumber + 1n));
  const status = rcpt.status === 'success' ? 1 : 0;
  const gasUsed = rcpt.gasUsed ? rcpt.gasUsed.toString() : null;
  return {
    stage: 'mined',
    hash,
    nonce,
    blockNumber,
    confirmations,
    gasUsed,
    status,
    head: Number(head),
  };
}

// Status tx detail (queued → pending → mined)
app.get('/tx/:hash', async (req, res) => {
  noStore(res);
  try {
    const { hash } = req.params;
    const explorerUrl = EXPLORER_TX_PREFIX ? `${EXPLORER_TX_PREFIX}${hash}` : undefined;

    let tx = null;
    try { tx = await publicClient.getTransaction({ hash }); } catch {}

    if (!tx) {
      const head = await publicClient.getBlockNumber();
      return res.json({
        stage: 'queued',
        hash,
        nonce: null,
        blockNumber: null,
        confirmations: 0,
        gasUsed: null,
        status: null,
        head: Number(head),
        explorerUrl
      });
    }

    const nonce = Number(tx.nonce);

    let rcpt = null;
    try { rcpt = await publicClient.getTransactionReceipt({ hash }); } catch {}

    if (!rcpt) {
      const head = await publicClient.getBlockNumber();
      return res.json({
        stage: 'pending',
        hash,
        nonce,
        blockNumber: null,
        confirmations: 0,
        gasUsed: null,
        status: null,
        head: Number(head),
        explorerUrl
      });
    }

    const head = await publicClient.getBlockNumber();
    return res.json({ ...serializeMined(hash, nonce, rcpt, head), explorerUrl });
  } catch (e) {
    res.status(500).json({ stage: 'error', error: e.message });
  }
});

// Fast ensure: tunggu sampai mined (maks 12s), langsung balikin detail
app.get('/tx/ensure/:hash', async (req, res) => {
  noStore(res);
  const { hash } = req.params;
  const explorerUrl = EXPLORER_TX_PREFIX ? `${EXPLORER_TX_PREFIX}${hash}` : undefined;

  try {
    const rcpt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 12_000,
      pollingInterval: 800,
    });

    // ambil nonce dari tx untuk konsistensi
    let tx = null;
    try { tx = await publicClient.getTransaction({ hash }); } catch {}
    const nonce = tx ? Number(tx.nonce) : null;

    const head = await publicClient.getBlockNumber();
    return res.json({ ...serializeMined(hash, nonce, rcpt, head), explorerUrl });
  } catch (e) {
    // Timeout atau belum mined → fallback ke status biasa
    try {
      let tx = null;
      try { tx = await publicClient.getTransaction({ hash }); } catch {}
      if (!tx) {
        const head = await publicClient.getBlockNumber();
        return res.json({
          stage: 'queued',
          hash,
          nonce: null,
          blockNumber: null,
          confirmations: 0,
          gasUsed: null,
          status: null,
          head: Number(head),
          explorerUrl
        });
      }
      const nonce = Number(tx.nonce);
      let rcpt = null;
      try { rcpt = await publicClient.getTransactionReceipt({ hash }); } catch {}
      if (!rcpt) {
        const head = await publicClient.getBlockNumber();
        return res.json({
          stage: 'pending',
          hash,
          nonce,
          blockNumber: null,
          confirmations: 0,
          gasUsed: null,
          status: null,
          head: Number(head),
          explorerUrl
        });
      }
      const head = await publicClient.getBlockNumber();
      return res.json({ ...serializeMined(hash, nonce, rcpt, head), explorerUrl });
    } catch (err) {
      return res.status(500).json({ stage: 'error', error: err.message, explorerUrl });
    }
  }
});

// Leaderboard & player stats
app.get('/leaderboard', (req, res) => { noStore(res); res.json(getLeaderboard(50)); });
app.get('/player/:addr', (req, res) => { noStore(res); res.json(getPlayer(req.params.addr)); });

app.listen(PORT, () => console.log(`Server on :${PORT}`));
