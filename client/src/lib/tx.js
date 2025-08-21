// client/src/lib/tx.js
// Watcher status transaksi: cepat, no-cache, sinkron dgn OnchainStatus.jsx

const API = import.meta.env.VITE_API_URL || '';

function buildExplorer(hash, fromServer) {
  if (fromServer) return fromServer;
  const prefix = import.meta.env.VITE_EXPLORER_TX_PREFIX || '';
  return prefix ? `${prefix}${hash}` : undefined;
}

/**
 * Mulai memantau transaksi.
 * @param {string} hash - tx hash
 * @param {(updater: (prev)=>any)} setState - React setState untuk OnchainStatus
 * @returns {() => void} stop function
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

  async function tick() {
    if (stopped) return;
    try {
      const url = `${API}/tx/${hash}?ts=${Date.now()}`;
      const r = await fetch(url, { cache: 'no-store' });
      const d = await r.json();

      const next = {
        stage: d.stage || 'pending',
        hash: d.hash || hash,
        blockNumber: d.blockNumber ?? null,
        nonce: d.nonce ?? null,
        confirmations: d.confirmations ?? 0,
        gasUsed: d.gasUsed ?? null,
        status: d.status ?? null,
        head: d.head ?? null,
        explorerUrl: buildExplorer(hash, d.explorerUrl),
        error: d.error || null,
      };

      setState((prev) => ({ ...(prev || {}), ...next }));

      if (next.stage === 'mined' || next.stage === 'failed') {
        stopped = true;
        return;
      }
    } catch (e) {
      setState((prev) => ({ ...(prev || {}), error: e.message }));
    }
    if (!stopped) setTimeout(tick, 800);
  }

  tick();
  return () => { stopped = true; };
}
