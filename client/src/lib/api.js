// client/src/lib/api.js
const RAW_BASE =
  (import.meta?.env?.VITE_API_URL ?? "") ||
  (import.meta?.env?.VITE_API_BASE ?? "");

function normalizeBase(v) {
  if (!v) return "";
  let s = String(v).trim();
  // buang trailing slash
  s = s.replace(/\/+$/, "");
  // kalau belum ada protokol, anggap https
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  return s;
}

// 1) coba dari env (URL lengkap atau host)
// 2) kalau kosong, fallback ke origin saat ini (berguna utk dev)
const BASE = normalizeBase(RAW_BASE) || `${window.location.protocol}//${window.location.host}`;

// optional: mudahin debug tanpa ubah UI
// (bisa diliat di DevTools -> console -> window.__API_BASE__)
window.__API_BASE__ = BASE;

// helper buat compose url
const to = (p) => `${BASE}${p}`;

export async function submitScore({ player, username, score }) {
  const res = await fetch(to(`/submit-score`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player, username, score }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `submit failed: ${res.status}`);
  }
  return res.json(); // { ok, tx, explorerUrl? }
}

export async function fetchLeaderboard() {
  const r = await fetch(to(`/leaderboard`), { cache: "no-store" });
  if (!r.ok) throw new Error(`leaderboard ${r.status}`);
  return r.json();
}

export async function fetchPlayer(a) {
  const r = await fetch(to(`/player/${a}`), { cache: "no-store" });
  if (!r.ok) throw new Error(`player ${r.status}`);
  return r.json();
}

export async function fetchUsername(a) {
  const r = await fetch(
    `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error(`username ${r.status}`);
  return r.json();
}

// pakai endpoint cepat agar value muncul lebih sigap
export async function getTxStatus(hash) {
  const r = await fetch(to(`/tx/ensure/${hash}`), { cache: "no-store" });
  if (!r.ok) throw new Error(`tx ${r.status}`);
  return r.json();
}
