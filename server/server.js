import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createPublicClient, createWalletClient, http, parseAbi, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addScore, getLeaderboard, getPlayer } from './db.js';

process.on('unhandledRejection', e => console.error('UNHANDLED', e));
process.on('uncaughtException', e => { console.error('UNCAUGHT', e); process.exit(1); });

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const RPC = process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PK = process.env.SERVER_PRIVATE_KEY;
const CONTRACT = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';

const RAW_ALLOW = process.env.ALLOW_ORIGINS || process.env.ALLOW_ORIGIN || '*';
const ALLOW = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean);

console.log('[BOOT]', { HOST, PORT, DB_PATH: process.env.DB_PATH, RPC, ALLOW });

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.json());

function originOk(origin) {
  if (!origin || ALLOW.includes('*') || ALLOW.includes(origin)) return true;
  try { return new URL(origin).host.endsWith('.vercel.app'); } catch { return false; }
}

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

app.use(cors({
  origin: (origin, cb) => cb(null, originOk(origin)),
  credentials: true
}));
app.use(morgan('dev'));

const limiter = new RateLimiterMemory({ points: 8, duration: 10 });
app.use(async (req, res, next) => {
  try { await limiter.consume(req.ip); next(); }
  catch { res.status(429).json({ error: 'Too many requests' }); }
});

// Health selalu hidup
app.get('/health', (req, res) => res.json({ ok: true }));

// ===== Chain aman
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

// Routes
app.get('/leaderboard', (req, res) => res.json(getLeaderboard(50)));
app.get('/player/:addr', (req, res) => res.json(getPlayer(req.params.addr)));

app.post('/submit-score', async (req, res) => {
  try {
    const { player, username, score } = req.body || {};
    if (!player || typeof score !== 'number' || score <= 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    await addScore({ player, username, score });

    if (!walletClient) {
      return res.json({ ok: true, tx: null, note: 'saved locally (chain not ready)' });
    }

    const hash = await walletClient.writeContract({
      address: CONTRACT,
      abi: ABI,
      functionName: 'updatePlayerData',
      args: [player, BigInt(Math.floor(score)), 1n]
    });
    res.json({ ok: true, tx: hash });
  } catch (e) {
    res.status(500).json({ error: e?.shortMessage || e?.message || 'tx error' });
  }
});

app.listen(PORT, HOST, () => console.log(`Server on ${HOST}:${PORT}`));
