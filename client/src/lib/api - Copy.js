const BASE = import.meta.env.VITE_API_URL;
export async function submitScore({ player, username, score }){
  const res = await fetch(`${BASE}/submit-score`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, username, score })
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json(); // { ok, tx }
}
export async function fetchLeaderboard(){ const r = await fetch(`${BASE}/leaderboard`); return r.json(); }
export async function fetchPlayer(a){ const r = await fetch(`${BASE}/player/${a}`); return r.json(); }
export async function fetchUsername(a){ const r = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}`); return r.json(); }
export async function getTxStatus(hash){ const r = await fetch(`${BASE}/tx/${hash}`); return r.json(); }