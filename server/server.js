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
const ALLOW = (process.env.ALLOW_ORIGIN || '*').split(',');
const RPC = process.env.MONAD_TESTNET_RPC_URL || 'https://testnet-rpc.monad.xyz';
const PK = process.env.SERVER_PRIVATE_KEY; // address ini harus didaftarkan sebagai _game
const CONTRACT = '0xceCBFF203C8B6044F52CE23D914A1bfD997541A4';

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
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: ALLOW }));
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

app.get('/health', (req, res) => res.json({ ok: true }));

// Debug signer (cek balance & address yang dipakai)
app.get('/debug/signer', async (req, res) => {
  try {
    const bal = await publicClient.getBalance({ address: account.address });
    res.json({ address: account.address, balanceWei: bal.toString() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Submit score → simpan ke DB → kirim tx on-chain (incremental)
app.post('/submit-score', async (req, res) => {
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

    return res.json({ ok: true, tx: hash });
  } catch (e) {
    console.error(e);
    const msg = e?.shortMessage || e?.message || 'tx error';
    res.status(500).json({ stage: 'error', error: msg });
  }
});

// Status tx detail (queued → pending → mined)
app.get('/tx/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    // getTransaction akan throw jika belum ada; jadi bungkus try
    let tx;
    try { tx = await publicClient.getTransaction({ hash }); } catch { tx = null; }
    if (!tx) return res.json({ stage: 'queued', hash });

    let rcpt;
    try { rcpt = await publicClient.getTransactionReceipt({ hash }); } catch { rcpt = null; }
    if (!rcpt) return res.json({ stage: 'pending', hash, nonce: tx.nonce });

    const head = await publicClient.getBlockNumber();
    const conf = Number(head - rcpt.blockNumber + 1n);

    res.json({
      stage: 'mined',
      hash,
      blockNumber: Number(rcpt.blockNumber),
      status: rcpt.status === 'success' ? 1 : 0,
      confirmations: conf,
      gasUsed: rcpt.gasUsed?.toString?.()
    });
  } catch (e) {
    res.status(500).json({ stage: 'error', error: e.message });
  }
});

// Leaderboard & player stats
app.get('/leaderboard', (req, res) => res.json(getLeaderboard(50)));
app.get('/player/:addr', (req, res) => res.json(getPlayer(req.params.addr)));

app.listen(PORT, () => console.log(`Server on :${PORT}`));
