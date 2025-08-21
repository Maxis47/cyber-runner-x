// client/src/lib/api.js
const BASE = import.meta.env.VITE_API_URL;

const bust = () => `t=${Date.now()}`;
const getOpts = { method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } };

export async function submitScore({ player, username, score }) {
  const res = await fetch(`${BASE}/submit-score?${bust()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify({ player, username, score }),
    keepalive: true,
  });
  if (!res.ok) throw new Error(await res.text().catch(()=>'submit failed'));
  return res.json(); // { ok, tx, explorerUrl }
}

export async function fetchLeaderboard() {
  const r = await fetch(`${BASE}/leaderboard?${bust()}`, getOpts);
  if (!r.ok) throw new Error('leaderboard fetch failed');
  return r.json();
}

export async function fetchPlayer(a) {
  const r = await fetch(`${BASE}/player/${a}?${bust()}`, getOpts);
  if (!r.ok) throw new Error('player fetch failed');
  return r.json();
}

export async function fetchUsername(a) {
  const r = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}&${bust()}`, getOpts);
  if (!r.ok) throw new Error('username fetch failed');
  return r.json();
}

export async function getTxStatus(hash) {
  const r = await fetch(`${BASE}/tx/${hash}?${bust()}`, getOpts);
  if (!r.ok) throw new Error('tx status fetch failed');
  return r.json();
}
