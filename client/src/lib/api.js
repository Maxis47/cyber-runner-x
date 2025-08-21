const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

function json(body) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    mode: 'cors',
    cache: 'no-store',
  };
}

function withTimeout(promise, ms = 15000) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => (t = setTimeout(() => rej(new Error('timeout')), ms))),
  ]);
}

export async function submitScore(payload) {
  const res = await withTimeout(fetch(`${BASE}/submit-score`, json(payload)), 15000);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function fetchLeaderboard() {
  const r = await withTimeout(fetch(`${BASE}/leaderboard`, { mode: 'cors', cache: 'no-store' }), 12000);
  return r.json();
}

export async function fetchPlayer(a) {
  const r = await withTimeout(fetch(`${BASE}/player/${a}`, { mode: 'cors', cache: 'no-store' }), 12000);
  return r.json();
}

export async function fetchUsername(a) {
  const r = await withTimeout(fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}`, { cache: 'no-store' }), 12000);
  return r.json();
}

// penting: pakai endpoint /tx/ensure untuk cepat/akurat
export async function getTxStatus(hash) {
  const r = await withTimeout(fetch(`${BASE}/tx/ensure/${hash}`, { mode: 'cors', cache: 'no-store' }), 15000);
  return r.json();
}
