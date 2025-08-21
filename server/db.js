// server/db.js - Lowdb v6 (JSONPreset)
import { JSONPreset } from 'lowdb/node';
import fs from 'fs/promises';
import path from 'path';

const defaultData = { scores: [] };
const DB_PATH = process.env.DB_PATH || './scores.db';

async function ensureDir(p) {
  const dir = path.dirname(p);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
}
await ensureDir(DB_PATH);

// Inisialisasi DB
export const db = await JSONPreset(DB_PATH, defaultData);

/** Tambah skor satu baris */
export async function addScore({ player, username, score }) {
  const row = {
    player: String(player).toLowerCase(),
    username: username ?? null,
    score: Math.floor(score),
    at: new Date().toISOString()
  };
  db.data.scores.push(row);
  await db.write();
}

/** Leaderboard agregasi */
export function getLeaderboard(limit = 50) {
  const map = new Map();
  for (const s of db.data.scores) {
    const key = s.player;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { player: key, high_score: s.score, last_played: s.at, username: s.username });
    } else {
      if (s.score > prev.high_score) prev.high_score = s.score;
      if (s.at > prev.last_played) {
        prev.last_played = s.at;
        prev.username = s.username ?? prev.username;
      }
    }
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => b.high_score - a.high_score || b.last_played.localeCompare(a.last_played));
  return arr.slice(0, limit);
}

/** Statistik satu player */
export function getPlayer(addr) {
  const p = String(addr).toLowerCase();
  const rows = db.data.scores.filter(s => s.player === p);
  const best = rows.reduce((m, r) => Math.max(m, r.score), 0);
  const plays = rows.length;
  const history = rows
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 50)
    .map(r => ({ score: r.score, at: r.at }));
  return { best, plays, history };
}

/** Global stats untuk kartu dashboard */
export function getGlobalStats() {
  const rows = db.data.scores;
  const playersSet = new Set(rows.map(r => r.player));
  const players = playersSet.size;
  const global_best = rows.reduce((m, r) => Math.max(m, r.score), 0);
  const total_plays = rows.length;
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const last24h = rows.filter(r => new Date(r.at).getTime() >= since).length;
  return { players, global_best, total_plays, last24h };
}
