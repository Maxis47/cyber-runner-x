// server/db.js - Lowdb (pure JS, no native build)
// NOTE: lowdb v6 uses JSONPreset (NOT JSONFilePreset)
import { JSONPreset } from 'lowdb/node';

// Struktur data: { scores: [ { player, username, score, at } ] }
const defaultData = { scores: [] };

// Path file DB bisa diset via env (opsional)
const DB_PATH = process.env.DB_PATH || './scores.json';

// Inisialisasi DB (Top-level await OK di Node 23)
export const db = await JSONPreset(DB_PATH, defaultData);

/** Tambah skor satu baris */
export async function addScore({ player, username, score }) {
  const row = {
    player: String(player).toLowerCase(),
    username: username ?? null,
    score: Math.floor(score),
    at: new Date().toISOString(),
  };
  db.data.scores.push(row);
  await db.write();
}

/** Ambil leaderboard: agregasi best score per player + last played + last username */
export function getLeaderboard(limit = 50) {
  const map = new Map();
  for (const s of db.data.scores) {
    const key = s.player;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        player: key,
        high_score: s.score,
        last_played: s.at,
        username: s.username,
      });
    } else {
      if (s.score > prev.high_score) prev.high_score = s.score;
      if (s.at > prev.last_played) {
        prev.last_played = s.at;
        prev.username = s.username ?? prev.username;
      }
    }
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => {
    if (b.high_score !== a.high_score) return b.high_score - a.high_score;
    return b.last_played.localeCompare(a.last_played);
  });
  return arr.slice(0, limit);
}

/** Statistik untuk satu player */
export function getPlayer(addr) {
  const p = String(addr).toLowerCase();
  const rows = db.data.scores.filter((s) => s.player === p);
  const best = rows.reduce((m, r) => Math.max(m, r.score), 0);
  const plays = rows.length;
  const history = rows
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 50)
    .map((r) => ({ score: r.score, at: r.at }));
  return { best, plays, history };
}
