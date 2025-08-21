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
const RPC = process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PK = process.env.SERVER_PRIVATE_KEY; // address ini harus didaftarkan sebagai _game
const CONTRACT = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';
const EXPLORER_TX_PREFIX = process.env.EXPLORER_TX_PREFIX || '';
const ALLOW_STR = (process.env.ALLOW_ORIGIN || '*').trim(); // contoh: https://cyber-runner-x.vercel.app, http://localhost:5173
const ALLOW_LIST = ALLOW_STR.split(',').map(s => s.trim()).filter(Boolean);

// ----- chain clients -----
if (!PK) { console.error('SERVER_PRIVATE_KEY missing in .env'); process.exit(1); }
const account = privateKeyToAccount(PK);
const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) });

// ABI minimal
const ABI = parseAbi([
  'function updatePlayerData(address player, uint256 scoreAmount, uint256 transactionAmount)'
]);

// ----- app -----
const app = express();
app.use(helmet());
app.use(express.json());

// === CORS & preflight aman untuk mobile/webview ===
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);                  // webview/kadang Origin:null
    const norm = origin.replace(/\/+$/, '');
    const ok = ALLOW_LIST.includes('*') ||
               ALLOW_LIST.some(o => o.replace(/\/+$/, '') === norm);
    cb(null, ok);
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
  maxAge: 86400,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // penting: selalu 204 untuk preflight

app.use(morgan('dev'));

// Rate limit HANYA untuk POST submit-score
const postLimiter = new RateLimiterMemory({ points: 6, duration: 10 });
async function limitPost(req, res, next) {
  try { await postLimiter.consume(req.ip); next(); }
  catch { res.status(429).json({ error: 'Too many requests' }); }
}

// Cache-control helper
function noStore(res) {
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma','no-cache'); res.set('Expires','0');
}

app.get('/health', (req,res)=>res.json({ok:true}));

app.get('/debug/signer', async (req, res) => {
  try {
    const bal = await publicClient.getBalance({ address: account.address });
    res.json({ address: account.address, balanceWei: bal.toString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Submit score → simpan DB → kirim tx
app.post('/submit-score', limitPost, async (req, res) => {
  try {
    const { player, username, score } = req.body || {};
    if (!player || typeof score !== 'number' || score <= 0)
      return res.status(400).json({ error: 'Invalid payload' });

    await addScore({ player, username, score });

    const hash = await walletClient.writeContract({
      address: CONTRACT, abi: ABI, functionName: 'updatePlayerData',
      args: [player, BigInt(Math.floor(score)), 1n],
    });

    const explorerUrl = EXPLORER_TX_PREFIX ? `${EXPLORER_TX_PREFIX}${hash}` : undefined;
    res.json({ ok: true, tx: hash, explorerUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ stage:'error', error: e?.shortMessage || e?.message || 'tx error' });
  }
});

// helper
function serializeMined(hash, nonce, rcpt, head) {
  const blockNumber = Number(rcpt.blockNumber);
  const confirmations = Math.max(1, Number(head - rcpt.blockNumber + 1n));
  const status = rcpt.status === 'success' ? 1 : 0;
  const gasUsed = rcpt.gasUsed ? rcpt.gasUsed.toString() : null;
  return { stage:'mined', hash, nonce, blockNumber, confirmations, gasUsed, status, head:Number(head) };
}

// status tx
app.get('/tx/:hash', async (req, res) => {
  noStore(res);
  try {
    const { hash } = req.params;
    const explorerUrl = EXPLORER_TX_PREFIX ? `${EXPLORER_TX_PREFIX}${hash}` : undefined;

    let tx = null; try { tx = await publicClient.getTransaction({ hash }); } catch {}
    if (!tx) {
      const head = await publicClient.getBlockNumber();
      return res.json({ stage:'queued', hash, nonce:null, blockNumber:null, confirmations:0, gasUsed:null, status:null, head:Number(head), explorerUrl });
    }

    const nonce = Number(tx.nonce);
    let rcpt = null; try { rcpt = await publicClient.getTransactionReceipt({ hash }); } catch {}
    if (!rcpt) {
      const head = await publicClient.getBlockNumber();
      return res.json({ stage:'pending', hash, nonce, blockNumber:null, confirmations:0, gasUsed:null, status:null, head:Number(head), explorerUrl });
    }

    const head = await publicClient.getBlockNumber();
    res.json({ ...serializeMined(hash, nonce, rcpt, head), explorerUrl });
  } catch (e) { res.status(500).json({ stage:'error', error:e.message }); }
});

// cepat: tunggu sampai mined (maks 12s)
app.get('/tx/ensure/:hash', async (req, res) => {
  noStore(res);
  const { hash } = req.params;
  const explorerUrl = EXPLORER_TX_PREFIX ? `${EXPLORER_TX_PREFIX}${hash}` : undefined;

  try {
    const rcpt = await publicClient.waitForTransactionReceipt({ hash, timeout: 12_000, pollingInterval: 800 });
    let tx = null; try { tx = await publicClient.getTransaction({ hash }); } catch {}
    const nonce = tx ? Number(tx.nonce) : null;
    const head = await publicClient.getBlockNumber();
    res.json({ ...serializeMined(hash, nonce, rcpt, head), explorerUrl });
  } catch {
    try {
      let tx = null; try { tx = await publicClient.getTransaction({ hash }); } catch {}
      if (!tx) {
        const head = await publicClient.getBlockNumber();
        return res.json({ stage:'queued', hash, nonce:null, blockNumber:null, confirmations:0, gasUsed:null, status:null, head:Number(head), explorerUrl });
      }
      const nonce = Number(tx.nonce);
      let rcpt = null; try { rcpt = await publicClient.getTransactionReceipt({ hash }); } catch {}
      if (!rcpt) {
        const head = await publicClient.getBlockNumber();
        return res.json({ stage:'pending', hash, nonce, blockNumber:null, confirmations:0, gasUsed:null, status:null, head:Number(head), explorerUrl });
      }
      const head = await publicClient.getBlockNumber();
      res.json({ ...serializeMined(hash, nonce, rcpt, head), explorerUrl });
    } catch (err) {
      res.status(500).json({ stage:'error', error: err.message, explorerUrl });
    }
  }
});

// data realtime (no-store)
app.get('/leaderboard', (req,res)=>{ noStore(res); res.json(getLeaderboard(50)); });
app.get('/player/:addr', (req,res)=>{ noStore(res); res.json(getPlayer(req.params.addr)); });

app.listen(PORT, () => console.log(`Server on :${PORT}`));
