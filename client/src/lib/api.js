// client/src/lib/api.js
const BASE = import.meta.env.VITE_API_URL;

// helper: fetch dengan timeout + no-store + cache-buster
async function request(url, options = {}, { timeout = 8000, retries = 1 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);

  // cache buster untuk CDN/HP
  const sep = url.includes('?') ? '&' : '?';
  const finalUrl = `${url}${sep}t=${Date.now()}`;

  try {
    const res = await fetch(finalUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      credentials: 'omit',
      keepalive: true,
      ...options,
      signal: ac.signal,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(t);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    clearTimeout(t);
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 400));
      return request(url, options, { timeout, retries: retries - 1 });
    }
    throw err;
  }
}

export async function submitScore({ player, username, score }) {
  return request(`${BASE}/submit-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player, username, score }),
  }, { timeout: 10000, retries: 1 }); // submit boleh sedikit lebih lama
}

export async function fetchLeaderboard() {
  return request(`${BASE}/leaderboard`, {}, { timeout: 7000, retries: 1 });
}

export async function fetchPlayer(addr) {
  return request(`${BASE}/player/${addr}`, {}, { timeout: 7000, retries: 1 });
}

export async function fetchUsername(addr) {
  // service pihak ketiga juga dipaksa no-store + cache-buster
  const url = `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${addr}`;
  return request(url, {}, { timeout: 8000, retries: 1 });
}

export async function getTxStatus(hash) {
  return request(`${BASE}/tx/${hash}`, {}, { timeout: 7000, retries: 2 });
}
