// client/src/components/OnchainStatus.jsx
import React from "react";

export default function OnchainStatus({ state }) {
  const s = state || {};

  // ===== Normalisasi & sinkronisasi nilai dari server =====
  // server kirim: { stage, hash, blockNumber, nonce, status, confirmations, gasUsed, head }
  const hash = s.hash || null;

  // block bisa datang sebagai blockNumber / block
  const block =
    s.blockNumber != null
      ? Number(s.blockNumber)
      : s.block != null
      ? Number(s.block)
      : null;

  // nonce bisa 0 -> harus tetap tampil
  const nonce =
    s.nonce != null
      ? (typeof s.nonce === "bigint" ? Number(s.nonce) : s.nonce)
      : null;

  // confirmations: pakai yang dari server; kalau null & mined, hitung dari HEAD
  let confirmations =
    s.confirmations != null
      ? Number(s.confirmations)
      : null;
  if (confirmations == null && s.stage === "mined" && block != null && s.head != null) {
    const headNum = Number(s.head);
    confirmations = Math.max(1, headNum - Number(block) + 1);
  }

  // gasUsed bisa string/bignum -> tampilkan apa adanya
  const gasUsed =
    s.gasUsed != null
      ? String(s.gasUsed)
      : null;

  // stage: jika mined tapi status=0 => failed
  const stageNorm =
    s.stage === "mined" && s.status === 0 ? "failed" : s.stage || "idle";

  // (opsional) explorer url jika sudah disediakan di state
  const explorerUrl = s.explorerUrl || null;

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
        <Info label="Block" value={numOrDash(block)} />
        <Info label="Nonce" value={numOrDash(nonce)} />
        <Info label="Confirmations" value={numOrDash(confirmations)} />
        <Info label="Gas Used" value={gasUsed ?? "—"} />
        <Info label="Explorer" value={explorerUrl ? "Open" : "—"} link={explorerUrl} />
      </div>

      {s.error ? (
        <div className="mt-3 text-xs text-rose-300">
          <b>Error:</b> {s.error}
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
  // penting: gunakan nullish coalescing agar 0 tidak jadi "—"
  const v = value ?? "—";
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

// helper: tampilkan angka termasuk 0; selain angka -> "—"
function numOrDash(n) {
  return (n === 0 || Number.isFinite(Number(n))) ? Number(n) : null;
}
