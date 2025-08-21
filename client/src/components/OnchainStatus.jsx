// client/src/components/OnchainStatus.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

export default function OnchainStatus({ state }) {
  const s = state || {};

  // ====== LIVE POLLING (mandiri) ======
  // Kalau ada s.hash tapi data belum lengkap, kita poll langsung ke RPC.
  const RPC = import.meta.env.VITE_MONAD_RPC_URL || "";
  const [live, setLive] = useState(null); // { stage, blockNumber, confirmations, gasUsed, status, head, nonce }
  const stopRef = useRef(false);
  const hash = s.hash || null;

  // helper JSON-RPC
  async function rpcCall(method, params = []) {
    if (!RPC) throw new Error("VITE_MONAD_RPC_URL missing");
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });
    const data = await res.json();
    if (data?.error) throw new Error(data.error.message || "RPC error");
    return data.result;
  }
  const hexToNum = (hex) => {
    if (!hex || typeof hex !== "string") return null;
    try { return Number(BigInt(hex)); } catch { return null; }
  };

  // normalisasi hasil RPC
  function normalizeFromRPC(h, tx, rcpt, headHex) {
    const head = headHex ? hexToNum(headHex) : null;
    let stage = "pending";
    let blockNumber = null;
    let confirmations = 0;
    let status = null;
    let gasUsed = null;
    let nonce = null;

    if (tx && typeof tx.nonce !== "undefined") {
      const n = hexToNum(tx.nonce);
      if (n !== null) nonce = n;
    }
    if (rcpt && rcpt.blockNumber) {
      blockNumber = hexToNum(rcpt.blockNumber);
      gasUsed = rcpt.gasUsed ? String(hexToNum(rcpt.gasUsed)) : null;
      const st = typeof rcpt.status === "string" ? hexToNum(rcpt.status) : null;
      status = st;
      if (blockNumber && head !== null) confirmations = Math.max(1, head - blockNumber + 1);
      stage = status === 0 ? "failed" : "mined";
    }
    return { stage, hash: h, blockNumber, confirmations, gasUsed, status, head, nonce };
  }

  // kapan perlu polling?
  const needLive = useMemo(() => {
    if (!hash) return false;
    const stage = s.stage || "pending";
    // kalau belum mined/failed → kita bantu polling
    return !(stage === "mined" || stage === "failed");
  }, [hash, s.stage]);

  useEffect(() => {
    stopRef.current = false;
    setLive(null);

    if (!hash || !needLive) return;
    let timer;

    async function tick() {
      if (stopRef.current) return;
      try {
        const [tx, rcpt, headHex] = await Promise.all([
          rpcCall("eth_getTransactionByHash", [hash]),
          rpcCall("eth_getTransactionReceipt", [hash]).catch(() => null),
          rpcCall("eth_blockNumber", []),
        ]);
        const next = normalizeFromRPC(hash, tx, rcpt, headHex);
        setLive(next);
        if (next.stage === "mined" || next.stage === "failed") {
          stopRef.current = true;
          return;
        }
      } catch {
        // diamkan; coba lagi
      }
      if (!stopRef.current) timer = setTimeout(tick, 800);
    }

    tick();
    return () => { stopRef.current = true; clearTimeout(timer); };
  }, [hash, needLive, /* RPC url change */ RPC]);

  // gabungkan sumber data: live override s (tanpa ubah UI)
  const merged = useMemo(() => ({ ...(s || {}), ...(live || {}) }), [s, live]);

  // ===== Normalisasi & sinkronisasi nilai untuk UI =====
  const blockNumber =
    (merged.stage === "mined" || merged.stage === "failed") && merged.blockNumber != null && Number(merged.blockNumber) > 0
      ? Number(merged.blockNumber)
      : null;

  const nonce =
    merged.nonce != null
      ? (typeof merged.nonce === "bigint" ? Number(merged.nonce) : Number(merged.nonce))
      : null;

  let confirmations =
    merged.confirmations != null ? Number(merged.confirmations) : null;
  if (
    confirmations == null &&
    (merged.stage === "mined" || merged.stage === "failed") &&
    blockNumber != null &&
    merged.head != null
  ) {
    confirmations = Math.max(1, Number(merged.head) - blockNumber + 1);
  }
  if (!(merged.stage === "mined" || merged.stage === "failed")) confirmations = null;

  const gasUsed =
    (merged.stage === "mined" || merged.stage === "failed") && merged.gasUsed != null && String(merged.gasUsed) !== "0"
      ? String(merged.gasUsed)
      : null;

  const stageNorm =
    merged.stage === "mined" && merged.status === 0 ? "failed" : merged.stage || "idle";

  const explorerUrl = merged.explorerUrl || null;

  const badge = (txt, cls) => (
    <span className={`px-2 py-0.5 rounded-full text-[11px] ${cls}`}>{txt}</span>
  );

  const stageBadge =
    stageNorm === "mined"
      ? badge("mined", "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30")
      : stageNorm === "pending"
      ? badge("pending", "bg-amber-500/15 text-amber-300 border border-amber-400/30")
      : stageNorm === "failed"
      ? badge("failed", "bg-rose-500/15 text-rose-300 border border-rose-400/30")
      : badge("idle", "bg-white/10 text-white/70 border border-white/15");

  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-black/20">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">On-chain Submission Status</div>
        {stageBadge}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        <Info label="Hash" value={hash ? short(hash) : "—"} link={explorerUrl} />
        <Info label="Block" value={numOrDash(blockNumber)} />
        <Info label="Nonce" value={numOrDash(nonce)} />
        <Info label="Confirmations" value={numOrDash(confirmations)} />
        <Info label="Gas Used" value={gasUsed ?? "—"} />
        <Info label="Explorer" value={explorerUrl ? "Open" : "—"} link={explorerUrl} />
      </div>

      {merged.error ? (
        <div className="mt-3 text-xs text-rose-300">
          <b>Error:</b> {merged.error}
        </div>
      ) : null}

      {stageNorm === "idle" && (
        <div className="mt-2 text-[11px] opacity-70">
          Scores are auto-submitted when you lose a run.
        </div>
      )}
    </div>
  );
}

function Info({ label, value, link }) {
  const v = value ?? "—"; // 0 tetap tampil 0
  return (
    <div className="rounded-lg border border-white/10 px-3 py-2 bg-white/5">
      <div className="opacity-60 mb-0.5">{label}</div>
      {link ? (
        <a className="underline underline-offset-2 hover:opacity-80" href={link} target="_blank" rel="noreferrer">
          {v}
        </a>
      ) : (
        <div>{v}</div>
      )}
    </div>
  );
}

const short = (h) => (h?.length > 12 ? `${h.slice(0, 6)}…${h.slice(-4)}` : h || "—");
function numOrDash(n) {
  return (n === 0 || Number.isFinite(Number(n))) ? Number(n) : null;
}
