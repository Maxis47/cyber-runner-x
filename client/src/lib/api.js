const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// helper GET no-store + bust cache param
async function get(path) {
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}ts=${Date.now()}`;
  const r = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    headers: { 'Cache-Control': 'no-store' },
  });
  if (!r.ok) throw new Error(`API ${path} ${r.status}`);
  return r.json();
}

export async function submitScore({ player, username, score }){
  const url = `${BASE}/submit-score?ts=${Date.now()}`;
  const res = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ player, username, score })
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json(); // { ok, tx, explorerUrl? }
}

export const fetchLeaderboard = () => get('/leaderboard');
export const fetchPlayer = (a) => get(`/player/${a}`);

// MGID username – tambahkan ts agar tak di-cache di mobile
export async function fetchUsername(a){
  const r = await fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}&ts=${Date.now()}`, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-store' }
  });
  return r.json();
}

// Status TX – coba ensure dulu (menunggu mined hingga 12s), kalau belum → fallback polling biasa
export async function getTxStatus(hash){
  try {
    const ensured = await get(`/tx/ensure/${hash}`);
    if (ensured && (ensured.stage === 'mined' || ensured.stage === 'failed')) return ensured;
  } catch {}
  return get(`/tx/${hash}`);
}
