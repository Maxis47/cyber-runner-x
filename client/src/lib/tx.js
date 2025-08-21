// client/src/lib/tx.js
// Watcher status transaksi: cepat, ensure dulu (12s), lalu polling cepat.

const API = import.meta.env.VITE_API_URL || '';

function buildExplorer(hash, fromServer) {
  if (fromServer) return fromServer;
  const prefix = import.meta.env.VITE_EXPLORER_TX_PREFIX || '';
  return prefix ? `${prefix}${hash}` : undefined;
}

function normalizeServer(d, hash) {
  // Pastikan null untuk nilai yang belum ada (jangan 0 palsu)
  const stage = d?.stage || 'pending';
  const blockNumber = d?.blockNumber ?? null;
  const nonce = d?.nonce ?? null;
  const confirmations = d?.confirmations ?? 0;
  const gasUsed = d?.gasUsed ?? null;
  const status = d?.status ?? null;
  const head = d?.head ?? null;

  return {
    stage,
    hash: d?.hash || hash,
    blockNumber,
    nonce,
    confirmations,
    gasUsed,
    status,
    head,
    explorerUrl: buildExplorer(hash, d?.explorerUrl),
    error: d?.error || null,
  };
}

/**
 * Mulai memantau transaksi: coba ensure (12s) -> fallback polling /tx
 * @param {string} hash
 * @param {(updater: (prev)=>any)} setState - setState utk OnchainStatus
 * @returns {() => void} stop()
 */
export function startTxWatcher(hash, setState) {
  if (!hash || typeof setState !== 'function') return () => {};

  // state awal
  setState((prev) => ({
    ...(prev || {}),
    stage: 'pending',
    hash,
    blockNumber: null,
    nonce: null,
    confirmations: 0,
    gasUsed: null,
    status: null,
    explorerUrl: buildExplorer(hash),
  }));

  let stopped = false;
  let polls = 0;

  // 1) Coba ENSURE (maks 12s)
  (async () => {
    try {
      const r = await fetch(`${API}/tx/ensure/${hash}?ts=${Date.now()}`, { cache: 'no-store' });
      const d = await r.json();
      const next = normalizeServer(d, hash);
      setState((prev) => ({ ...(prev || {}), ...next }));

      if (next.stage === 'mined' || next.stage === 'failed') {
        stopped = true;
        return;
      }
    } catch (e) {
      // lanjut ke polling biasa
    }

    // 2) Polling cepat /tx
    async function tick() {
      if (stopped) return;
      try {
        const r = await fetch(`${API}/tx/${hash}?ts=${Date.now()}`, { cache: 'no-store' });
        const d = await r.json();
        const next = normalizeServer(d, hash);
        setState((prev) => ({ ...(prev || {}), ...next }));

        if (next.stage === 'mined' || next.stage === 'failed') {
          stopped = true;
          return;
        }
      } catch (e) {
        setState((prev) => ({ ...(prev || {}), error: e.message }));
      }

      polls += 1;
      // setiap ~10 kali (±8 detik), coba ENSURE lagi sebagai booster
      if (!stopped && polls % 10 === 0) {
        try {
          const r2 = await fetch(`${API}/tx/ensure/${hash}?ts=${Date.now()}`, { cache: 'no-store' });
          const d2 = await r2.json();
          const next2 = normalizeServer(d2, hash);
          setState((prev) => ({ ...(prev || {}), ...next2 }));
          if (next2.stage === 'mined' || next2.stage === 'failed') {
            stopped = true;
            return;
          }
        } catch {}
      }

      if (!stopped) setTimeout(tick, 800);
    }

    tick();
  })();

  return () => { stopped = true; };
}
