const API = import.meta.env.VITE_API_URL;

export async function getTxStatus(hash, { wait = false, timeoutMs = 20000 } = {}) {
  const url = new URL(`${API}/tx/${hash}`);
  if (wait) url.searchParams.set('wait', '1');
  if (timeoutMs) url.searchParams.set('timeout_ms', String(timeoutMs));
  const r = await fetch(url, { cache: 'no-store' });
  return r.json();
}

export function streamTxStatus(hash, onUpdate, { timeoutMs = 30000, intervalMs = 1000 } = {}) {
  const sseUrl = new URL(`${API}/tx/stream/${hash}`);
  sseUrl.searchParams.set('timeout_ms', String(timeoutMs));

  if ('EventSource' in window) {
    const es = new EventSource(sseUrl);
    const timer = setTimeout(() => es.close(), timeoutMs + 2000);
    es.onmessage = ev => { try { onUpdate(JSON.parse(ev.data)); } catch {} };
    es.onerror = () => es.close();
    return () => { clearTimeout(timer); es.close(); };
  }

  let alive = true;
  (async function loop() {
    const t0 = Date.now();
    while (alive && Date.now() - t0 < timeoutMs) {
      try {
        const s = await getTxStatus(hash);
        onUpdate(s);
        if (s.stage === 'mined' || s.stage === 'error') break;
      } catch {}
      await new Promise(r => setTimeout(r, intervalMs));
    }
  })();
  return () => { alive = false; };
}
