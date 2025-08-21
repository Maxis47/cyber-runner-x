// client/src/lib/api.js
function normalizeBase(v) {
  if (!v) return "";
  let u = String(v).trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/+$/,"");
}

// Dukung dua nama env: VITE_API_URL atau VITE_API_BASE
const BASE = normalizeBase(
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  import.meta.env.VITE_API
);

const noStore = { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } };

export async function submitScore({ player, username, score }){
  const res = await fetch(`${BASE}/submit-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify({ player, username, score })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchLeaderboard(){ const r = await fetch(`${BASE}/leaderboard`, noStore); return r.json(); }
export async function fetchPlayer(a){ const r = await fetch(`${BASE}/player/${a}`, noStore); return r.json(); }
export async function fetchUsername(a){ const r = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}`, noStore); return r.json(); }
export async function getTxStatus(hash){ const r = await fetch(`${BASE}/tx/${hash}`, noStore); return r.json(); }
