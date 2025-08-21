// client/src/lib/tx.js
// Watcher status transaksi — langsung ke JSON-RPC (akurat & cepat).
// Tetap kompatibel dengan OnchainStatus.jsx milik kamu (tanpa ubah UI).

const API = import.meta.env.VITE_API_URL || ''; // fallback ke server (opsional)
const RPC = import.meta.env.VITE_MONAD_RPC_URL || ''; // Wajib di-set

function buildExplorer(hash, fromServer) {
  if (fromServer) return fromServer;
  const prefix = import.meta.env.VITE_EXPLORER_TX_PREFIX || '';
  return prefix ? `${prefix}${hash}` : undefined;
}

function hexToNum(hex) {
  if (!hex || typeof hex !== 'string') return null;
  try {
    return Number(BigInt(hex));
  } catch {
    return null;
  }
}

async function rpcCall(method, params = []) {
  if (!RPC) throw new Error('VITE_MONAD_RPC_URL is missing');
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // paksa no-cache
    cache: 'no-store',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error?.message || 'RPC error');
  return data.result;
}

function normalizeFromRPC(hash, tx, rcpt, headHex) {
  const head = headHex ? hexToNum(headHex) : null;

  // default pending
  let stage = 'pending';
  let blockNumber = null;
  let confirmations = 0;
  let status = null;
  let gasUsed = null;
  let nonce = null;

  if (tx && typeof tx.nonce !== 'undefined') {
    // nonce valid bisa 0
    const n = hexToNum(tx.nonce);
    if (n !== null) nonce = n;
  }

  if (rcpt && rcpt.blockNumber) {
    blockNumber = hexToNum(rcpt.blockNumber);
    gasUsed = rcpt.gasUsed ? String(hexToNum(rcpt.gasUsed)) : null;

    // EVM-like: status "0x1" success, "0x0" gagal
    const st = typeof rcpt.status === 'string' ? hexToNum(rcpt.status) : null;
    status = st;

    if (blockNumber && head !== null) {
      confirmations = Math.max(1, head - blockNumber + 1);
    }
    stage = 'mined';
    if (status === 0) stage = 'failed';
  } else {
    // belum receipt -> pending / queued
    // kalau tx null -> queued (tetap treat pending utk UI)
    stage = 'pending';
  }

  return {
    stage,
    hash,
    blockNumber,
    nonce,
    confirmations,
    gasUsed,
    status,
    head
  };
}

/**
 * Mulai pantau transaksi:
 * 1) Coba langsung ke RPC (eth_getTransactionByHash, eth_getTransactionReceipt, eth_blockNumber).
 * 2) Kalau RPC error (mis. CORS), fallback ke server endpoint (/tx/ensure dan /tx).
 * @param {string} hash
 * @param {(updater: (prev:any)=>any)} setState
 * @returns {() => void} stop
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

  async function tickDirect() {
    if (stopped) return;
    try {
      // panggil tiga RPC: tx, receipt, blockNumber
      const [tx, rcpt, headHex] = await Promise.all([
        rpcCall('eth_getTransactionByHash', [hash]),
        rpcCall('eth_getTransactionReceipt', [hash]).catch(() => null),
        rpcCall('eth_blockNumber', [])
      ]);

      const next = normalizeFromRPC(hash, tx, rcpt, headHex);
      setState((prev) => ({ ...(prev || {}), ...next, explorerUrl: buildExplorer(hash, prev?.explorerUrl) }));

      if (next.stage === 'mined' || next.stage === 'failed') {
        stopped = true;
        return;
      }
    } catch (e) {
      // Jika RPC gagal (CORS/limit), fallback ke server bila tersedia
      if (API) {
        await tickServerEnsure();
        if (!stopped) await tickServerPoll();
        return;
      } else {
        // tanpa server fallback, coba lagi nanti
      }
    }
    if (!stopped) setTimeout(tickDirect, 800);
  }

  async function tickServerEnsure() {
    if (stopped) return;
    try {
      const r = await fetch(`${API}/tx/ensure/${hash}?ts=${Date.now()}`, { cache: 'no-store' });
      const d = await r.json();
      const next = {
        stage: d?.stage || 'pending',
        hash: d?.hash || hash,
        blockNumber: d?.blockNumber ?? null,
        nonce: d?.nonce ?? null,
        confirmations: d?.confirmations ?? 0,
        gasUsed: d?.gasUsed ?? null,
        status: d?.status ?? null,
        head: d?.head ?? null,
        explorerUrl: buildExplorer(hash, d?.explorerUrl),
        error: d?.error || null,
      };
      setState((prev) => ({ ...(prev || {}), ...next }));
      if (next.stage === 'mined' || next.stage === 'failed') {
        stopped = true;
      }
    } catch {}
  }

  async function tickServerPoll() {
    if (stopped) return;
    async function loop() {
      if (stopped) return;
      try {
        const r = await fetch(`${API}/tx/${hash}?ts=${Date.now()}`, { cache: 'no-store' });
        const d = await r.json();
        const next = {
          stage: d?.stage || 'pending',
          hash: d?.hash || hash,
          blockNumber: d?.blockNumber ?? null,
          nonce: d?.nonce ?? null,
          confirmations: d?.confirmations ?? 0,
          gasUsed: d?.gasUsed ?? null,
          status: d?.status ?? null,
          head: d?.head ?? null,
          explorerUrl: buildExplorer(hash, d?.explorerUrl),
          error: d?.error || null,
        };
        setState((prev) => ({ ...(prev || {}), ...next }));
        if (next.stage === 'mined' || next.stage === 'failed') {
          stopped = true;
          return;
        }
      } catch (e) {
        setState((prev) => ({ ...(prev || {}), error: e.message }));
      }
      polls += 1;
      if (!stopped) setTimeout(loop, 800);
    }
    loop();
  }

  // mulai dengan direct RPC (paling akurat)
  tickDirect();

  return () => { stopped = true; };
}
