// server/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { createPublicClient, createWalletClient, http, parseAbi, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { addScore, getLeaderboard, getPlayer } from './db.js';

// ===== Debug Boot =====
process.on('unhandledRejection', e => console.error('UNHANDLED', e));
process.on('uncaughtException', e => { console.error('UNCAUGHT', e); process.exit(1); });

const PORT = process.env.PORT || 3000;
const RPC = process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PK = process.env.SERVER_PRIVATE_KEY;
const CONTRACT = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';

// Allow Origins
const RAW_ALLOW = process.env.ALLOW_ORIGINS || '*';
const ALLOW = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean);

// ===== Express app =====
const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOW.includes('*') || ALLOW.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(morgan('dev'));

const limiter = new RateLimiterMemory({ points: 8, duration: 10 });
app.use(async (req, res, next) => {
  try { await limiter.consume(req.ip); next(); }
  catch { res.status(429).json({ error: 'Too many requests' }); }
});

// ===== Health route selalu hidup =====
app.get('/health', (req, res) => res.json({ ok: true }));

// ===== Chain client init =====
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

async function initChain() {
  try {
    if (!PK) throw new Error('SERVER_PRIVATE_KEY missing');
    account = privateKeyToAccount(PK);
    publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
    walletClient = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) });
    console.log('[CHAIN READY]', account.address);
  } catch (e) {
    console.error('[CHAIN INIT ERROR]', e.message);
  }
}
initChain();

// ===== Routes lainnya =====
app.get('/leaderboard', (req, res) => res.json(getLeaderboard(50)));
app.get('/player/:addr', (req, res) => res.json(getPlayer(req.params.addr)));

app.post('/submit-score', async (req, res) => {
  try {
    const { player, username, score } = req.body;
    if (!player || typeof score !== 'number' || score <= 0) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    await addScore({ player, username, score });

    if (!walletClient) return res.json({ ok: true, tx: null, note: 'saved locally' });

    const hash = await walletClient.writeContract({
      address: CONTRACT,
      abi: ABI,
      functionName: 'updatePlayerData',
      args: [player, BigInt(Math.floor(score)), 1n]
    });
    res.json({ ok: true, tx: hash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server on :${PORT}`));
