// client/src/components/OnchainStatus.jsx
import React from "react";

export default function OnchainStatus({ state }) {
  const s = state || {};
  const badge = (txt, cls) => (
    <span className={`px-2 py-0.5 rounded-full text-[11px] ${cls}`}>{txt}</span>
  );

  const stageBadge =
    s.stage === "mined"
      ? badge("mined", "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30")
      : s.stage === "pending"
      ? badge("pending", "bg-amber-500/15 text-amber-300 border border-amber-400/30")
      : s.stage === "failed"
      ? badge("failed", "bg-rose-500/15 text-rose-300 border border-rose-400/30")
      : badge("idle", "bg-white/10 text-white/70 border border-white/15");

  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-black/20">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">On‑chain Submission Status</div>
        {stageBadge}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
        <Info label="Hash" value={s.hash ? short(s.hash) : "—"} link={s.explorerUrl} />
        <Info label="Block" value={s.block || "—"} />
        <Info label="Nonce" value={s.nonce || "—"} />
        <Info label="Confirmations" value={s.confirmations || "—"} />
        <Info label="Gas Used" value={s.gasUsed || "—"} />
        <Info label="Explorer" value={s.explorerUrl ? "Open" : "—"} link={s.explorerUrl} />
      </div>

      {s.error ? (
        <div className="mt-3 text-xs text-rose-300">
          <b>Error:</b> {s.error}
        </div>
      ) : null}

      {s.stage === "idle" && (
        <div className="mt-2 text-[11px] opacity-70">
          Scores are auto‑submitted when you lose a run.
        </div>
      )}
    </div>
  );
}

function Info({ label, value, link }) {
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
