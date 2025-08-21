// server/server.js — fast & realtime for dashboard + tx
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createPublicClient, createWalletClient, http, parseAbi, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addScore, getLeaderboard, getPlayer, getGlobalStats } from './db.js';

// Guards
process.on('unhandledRejection', e => console.error('UNHANDLED', e));
process.on('uncaughtException', e => { console.error('UNCAUGHT', e); process.exit(1); });

// Env
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const RPC  = process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PK   = process.env.SERVER_PRIVATE_KEY;
const CONTRACT = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';

const RAW_ALLOW = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*';
const ALLOW = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean);
console.log('[BOOT]', { HOST, PORT, DB_PATH: process.env.DB_PATH, RPC, ALLOW });

// App
const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());

// CORS
const originOk = (origin) => {
  if (!origin || ALLOW.includes('*') || ALLOW.includes(origin)) return true;
  try { return new URL(origin).host.endsWith('.vercel.app'); } catch { return false; }
};
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

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Rate-limit hanya submit
const submitLimiter = new RateLimiterMemory({ points: 5, duration: 10 });

// Chain
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

// Head block cache (untuk confirmations cepat)
let HEAD = 0n;
setInterval(async () => {
  try { if (publicClient) HEAD = await publicClient.getBlockNumber(); } catch {}
}, 1000);

// Cache ringan dashboard
let lbCache = null, lbTS = 0;
const playerCache = new Map();
const TTL = 2000;

// SSE — simple pubsub
const sseClients = {
  leaderboard: new Set(),              // Set<res>
  globalStats: new Set(),              // Set<res>
  player: new Map()                    // Map<addr, Set<res>>
};
function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Connection', 'keep-alive');
}
function sseSend(res, data) { res.write(`data: ${JSON.stringify(data)}\n\n`); }
function sseKeepAlive(res) { res.write(': keep-alive\n\n'); }
setInterval(() => {
  for (const res of sseClients.leaderboard) sseKeepAlive(res);
  for (const res of sseClients.globalStats) sseKeepAlive(res);
  for (const set of sseClients.player.values()) for (const res of set) sseKeepAlive(res);
}, 15000);

// ======== REST endpoints (tetap ada untuk fallback) ========
app.get('/leaderboard', (req, res) => {
  const now = Date.now();
  if (lbCache && now - lbTS < TTL) return res.json(lbCache);
  const data = getLeaderboard(50);
  lbCache = data; lbTS = now;
  res.json(data);
});
app.get('/player/:addr', (req, res) => {
  const key = String(req.params.addr).toLowerCase();
  const now = Date.now();
  const ent = playerCache.get(key);
  if (ent && now - ent.ts < TTL) return res.json(ent.data);
  const data = getPlayer(key);
  playerCache.set(key, { ts: now, data });
  res.json(data);
});
app.get('/stats/global', (req, res) => res.json(getGlobalStats()));

// ======== SSE endpoints (realtime) ========
app.get('/stream/leaderboard', (req, res) => {
  sseHeaders(res);
  sseClients.leaderboard.add(res);
  // kirim data awal
  sseSend(res, { type: 'leaderboard', data: getLeaderboard(50), ts: Date.now() });
  req.on('close', () => { sseClients.leaderboard.delete(res); });
});
app.get('/stream/stats/global', (req, res) => {
  sseHeaders(res);
  sseClients.globalStats.add(res);
  sseSend(res, { type: 'global', data: getGlobalStats(), ts: Date.now() });
  req.on('close', () => { sseClients.globalStats.delete(res); });
});
app.get('/stream/player/:addr', (req, res) => {
  sseHeaders(res);
  const addr = String(req.params.addr).toLowerCase();
  if (!sseClients.player.has(addr)) sseClients.player.set(addr, new Set());
  const set = sseClients.player.get(addr);
  set.add(res);
  sseSend(res, { type: 'player', addr, data: getPlayer(addr), ts: Date.now() });
  req.on('close', () => { set.delete(res); if (set.size === 0) sseClients.player.delete(addr); });
});

// ======== Submit score ========
app.post('/submit-score', async (req, res) => {
  try {
    try { await submitLimiter.consume(req.ip); }
    catch { return res.status(429).json({ error: 'Too many requests' }); }

    const { player, username, score } = req.body || {};
    if (!player || typeof score !== 'number' || score <= 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const addr = String(player).toLowerCase();
    await addScore({ player: addr, username, score });

    // Invalidate cache
    lbCache = null; playerCache.delete(addr);

    // 🔔 Push SSE ke semua klien
    const lbData = getLeaderboard(50);
    for (const r of sseClients.leaderboard) sseSend(r, { type: 'leaderboard', data: lbData, ts: Date.now() });
    const gs = getGlobalStats();
    for (const r of sseClients.globalStats) sseSend(r, { type: 'global', data: gs, ts: Date.now() });
    const pData = getPlayer(addr);
    const set = sseClients.player.get(addr);
    if (set) for (const r of set) sseSend(r, { type: 'player', addr, data: pData, ts: Date.now() });

    // On-chain
    if (!walletClient) return res.json({ ok: true, tx: null, note: 'saved locally (chain not ready)' });
    const hash = await walletClient.writeContract({
      address: CONTRACT, abi: ABI, functionName: 'updatePlayerData',
      args: [addr, BigInt(Math.floor(score)), 1n]
    });
    res.json({ ok: true, tx: hash });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.shortMessage || e?.message || 'tx error' });
  }
});

// ======== TX status (akurat + SSE lain tetap dipertahankan) ========
function txReply(res, hash, stage, extra = {}) {
  res.json({
    stage, hash,
    blockNumber: extra.blockNumber ?? null,
    nonce: extra.nonce ?? null,
    status: extra.status ?? null,
    confirmations: extra.confirmations ?? null,
    gasUsed: extra.gasUsed ?? null,
    head: HEAD ? Number(HEAD) : null,
    ts: Date.now()
  });
}
app.get('/tx/:hash', async (req, res) => {
  try {
    const hash = /** @type {`0x${string}`} */ (req.params.hash);
    const wait = String(req.query.wait || '').toLowerCase();
    const doWait = wait === '1' || wait === 'true';
    const timeoutMs = Math.min(Number(req.query.timeout_ms) || 20000, 120000);
    if (!publicClient) return txReply(res, hash, 'queued');

    if (doWait) {
      try {
        const rcpt = await publicClient.waitForTransactionReceipt({
          hash, confirmations: 1, timeout: timeoutMs, pollingInterval: 800
        });
        const head = HEAD || await publicClient.getBlockNumber();
        const conf = Number(head - rcpt.blockNumber + 1n);
        return txReply(res, hash, 'mined', {
          blockNumber: Number(rcpt.blockNumber),
          status: rcpt.status === 'success' ? 1 : 0,
          confirmations: conf,
          gasUsed: rcpt.gasUsed?.toString?.()
        });
      } catch {}
    }

    let rcpt = null;
    try { rcpt = await publicClient.getTransactionReceipt({ hash }); } catch {}
    if (rcpt) {
      const head = HEAD || await publicClient.getBlockNumber();
      const conf = Number(head - rcpt.blockNumber + 1n);
      return txReply(res, hash, 'mined', {
        blockNumber: Number(rcpt.blockNumber),
        status: rcpt.status === 'success' ? 1 : 0,
        confirmations: conf,
        gasUsed: rcpt.gasUsed?.toString?.()
      });
    }

    let tx = null;
    try { tx = await publicClient.getTransaction({ hash }); } catch {}
    if (!tx) return txReply(res, hash, 'queued');
    return txReply(res, hash, 'pending', { nonce: tx.nonce });
  } catch (e) {
    res.status(500).json({ stage: 'error', hash: req.params.hash, error: e.message });
  }
});
app.get('/tx/stream/:hash', async (req, res) => {
  try {
    const hash = /** @type {`0x${string}`} */ (req.params.hash);
    const timeoutMs = Math.min(Number(req.query.timeout_ms) || 30000, 120000);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const pack = (stage, extra={}) => ({
      stage, hash,
      blockNumber: extra.blockNumber ?? null,
      nonce: extra.nonce ?? null,
      status: extra.status ?? null,
      confirmations: extra.confirmations ?? null,
      gasUsed: extra.gasUsed ?? null,
      head: HEAD ? Number(HEAD) : null,
      ts: Date.now()
    });

    if (!publicClient) { send(pack('queued')); return res.end(); }

    let alive = true; req.on('close', () => { alive = false; });
    const start = Date.now();
    const tick = async () => {
      if (!alive) return;

      let rcpt = null;
      try { rcpt = await publicClient.getTransactionReceipt({ hash }); } catch {}
      if (rcpt) {
        const head = HEAD || await publicClient.getBlockNumber();
        const conf = Number(head - rcpt.blockNumber + 1n);
        send(pack('mined', {
          blockNumber: Number(rcpt.blockNumber),
          status: rcpt.status === 'success' ? 1 : 0,
          confirmations: conf,
          gasUsed: rcpt.gasUsed?.toString?.()
        }));
        res.end(); return;
      }

      let tx = null;
      try { tx = await publicClient.getTransaction({ hash }); } catch {}
      if (tx) send(pack('pending', { nonce: tx.nonce })); else send(pack('queued'));

      if (Date.now() - start > timeoutMs) { res.end(); return; }
      setTimeout(tick, 800);
    };
    tick();
  } catch { res.end(); }
});

// Listen
app.listen(PORT, HOST, () => console.log(`Server on ${HOST}:${PORT}`));
