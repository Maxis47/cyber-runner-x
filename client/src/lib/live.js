const API = import.meta.env.VITE_API_URL;

function openSSE(url, onData, { timeoutMs = 60000 } = {}) {
  const u = new URL(url);
  u.searchParams.set('ts', Date.now().toString()); // bust proxy
  if ('EventSource' in window) {
    const es = new EventSource(u);
    const timer = setTimeout(() => es.close(), timeoutMs + 2000);
    es.onmessage = ev => { try { onData(JSON.parse(ev.data)); } catch {} };
    es.onerror = () => es.close();
    return () => { clearTimeout(timer); es.close(); };
  }
  // fallback polling
  let alive = true;
  (async function loop() {
    while (alive) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        const d = await r.json();
        onData(d);
      } catch {}
      await new Promise(r => setTimeout(r, 1500));
    }
  })();
  return () => { alive = false; };
}

export function streamLeaderboard(onUpdate) {
  return openSSE(`${API}/stream/leaderboard`, (msg) => {
    if (msg?.type === 'leaderboard') onUpdate(msg.data);
  });
}

export function streamGlobalStats(onUpdate) {
  return openSSE(`${API}/stream/stats/global`, (msg) => {
    if (msg?.type === 'global') onUpdate(msg.data);
  });
}

export function streamPlayer(addr, onUpdate) {
  const a = String(addr || '').toLowerCase();
  if (!a) return () => {};
  return openSSE(`${API}/stream/player/${a}`, (msg) => {
    if (msg?.type === 'player') onUpdate(msg.data);
  });
}

// sekali fetch awal (buat render pertama)
export async function fetchLeaderboard() {
  const r = await fetch(`${API}/leaderboard`, { cache: 'no-store' });
  return r.json();
}
export async function fetchGlobalStats() {
  const r = await fetch(`${API}/stats/global`, { cache: 'no-store' });
  return r.json();
}
export async function fetchPlayer(addr) {
  const r = await fetch(`${API}/player/${addr}`, { cache: 'no-store' });
  return r.json();
}
