// server/server.js — fast & friendly
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createPublicClient, createWalletClient, http, parseAbi, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addScore, getLeaderboard, getPlayer } from './db.js';

// ===== Boot guards =====
process.on('unhandledRejection', e => console.error('UNHANDLED', e));
process.on('uncaughtException', e => { console.error('UNCAUGHT', e); process.exit(1); });

// ===== Env =====
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const RPC  = process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PK   = process.env.SERVER_PRIVATE_KEY;
const CONTRACT = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';

const RAW_ALLOW = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*';
const ALLOW = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean);

console.log('[BOOT]', { HOST, PORT, DB_PATH: process.env.DB_PATH, RPC, ALLOW });

// ===== App =====
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());

// CORS (terima vercel & localhost)
const originOk = (origin) => {
  if (!origin || ALLOW.includes('*') || ALLOW.includes(origin)) return true;
  try { return new URL(origin).host.endsWith('.vercel.app'); } catch { return false; }
};
// Preflight
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (originOk(origin)) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.sendStatus(204);
    }
    return res.status(403).send('CORS preflight blocked');
  }
  next();
});
app.use(cors({ origin: (o, cb) => cb(null, originOk(o)), credentials: true }));
app.use(morgan('dev'));

// ===== Health: selalu hidup =====
app.get('/health', (req, res) => res.json({ ok: true }));

// ===== Rate limit HANYA untuk POST /submit-score =====
const submitLimiter = new RateLimiterMemory({
  points: 5,       // max 5 submit per 10 detik per IP
  duration: 10
});

// ===== Chain clients (aman kalau gagal init) =====
let publicClient = null, walletClient = null, account = null;

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [RPC] }, public: { http: [RPC] } }
});

const ABI = parseAbi([
  'function updatePlayerData(address player, uint256 scoreAmount, uint256 transactionAmount)'
]);

(async () => {
  try {
    if (!PK) throw new Error('SERVER_PRIVATE_KEY missing');
    account = privateKeyToAccount(PK);
    publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
    walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) });
    console.log('[CHAIN READY]', account.address);
  } catch (e) {
    console.error('[CHAIN INIT ERROR]', e?.message || e);
  }
})();

// ===== Tiny cache (2 detik) untuk leaderboard & player =====
let lbCache = null, lbTS = 0;
const playerCache = new Map(); // key: addr, val: { ts, data }
const TTL = 2000;

// Leaderboard
app.get('/leaderboard', (req, res) => {
  const now = Date.now();
  if (lbCache && now - lbTS < TTL) return res.json(lbCache);
  const data = getLeaderboard(50);
  lbCache = data; lbTS = now;
  res.json(data);
});

// Player
app.get('/player/:addr', (req, res) => {
  const key = String(req.params.addr).toLowerCase();
  const now = Date.now();
  const ent = playerCache.get(key);
  if (ent && now - ent.ts < TTL) return res.json(ent.data);
  const data = getPlayer(key);
  playerCache.set(key, { ts: now, data });
  res.json(data);
});

// Submit score (rate-limited)
app.post('/submit-score', async (req, res) => {
  try {
    // rate limit hanya di endpoint ini
    try { await submitLimiter.consume(req.ip); }
    catch { return res.status(429).json({ error: 'Too many requests' }); }

    const { player, username, score } = req.body || {};
    if (!player || typeof score !== 'number' || score <= 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // simpan lokal buat dashboard
    await addScore({ player, username, score });
    // invalidasi cache
    lbCache = null; playerCache.delete(String(player).toLowerCase());

    // kirim on-chain (kalau walletClient belum siap, tetap sukses lokal)
    if (!walletClient) return res.json({ ok: true, tx: null, note: 'saved locally (chain not ready)' });

    const hash = await walletClient.writeContract({
      address: CONTRACT,
      abi: ABI,
      functionName: 'updatePlayerData',
      args: [player, BigInt(Math.floor(score)), 1n]
    });

    res.json({ ok: true, tx: hash });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.shortMessage || e?.message || 'tx error' });
  }
});

// Status transaksi (tanpa rate-limit ketat)
app.get('/tx/:hash', async (req, res) => {
  try {
    if (!publicClient) return res.json({ stage: 'queued', hash: req.params.hash });

    const { hash } = req.params;

    // Cek receipt dulu (lebih cepat kalau sudah mined)
    let rcpt;
    try { rcpt = await publicClient.getTransactionReceipt({ hash }); } catch { rcpt = null; }
    if (rcpt) {
      const head = await publicClient.getBlockNumber();
      const conf = Number(head - rcpt.blockNumber + 1n);
      return res.json({
        stage: 'mined',
        hash,
        blockNumber: Number(rcpt.blockNumber),
        status: rcpt.status === 'success' ? 1 : 0,
        confirmations: conf,
        gasUsed: rcpt.gasUsed?.toString?.()
      });
    }

    // Kalau belum ada receipt, cek apakah tx sudah terlihat
    let tx;
    try { tx = await publicClient.getTransaction({ hash }); } catch { tx = null; }
    if (!tx) return res.json({ stage: 'queued', hash });

    // Sudah terlihat tapi belum mined
    return res.json({ stage: 'pending', hash, nonce: tx.nonce });
  } catch (e) {
    res.status(500).json({ stage: 'error', error: e.message });
  }
});

// ===== Listen =====
app.listen(PORT, HOST, () => console.log(`Server on ${HOST}:${PORT}`));
