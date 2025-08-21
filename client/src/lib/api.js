// Base URL yang robust + no-store agar data muncul di semua device
const rawBase =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||      // fallback env lama
  (typeof window !== "undefined" ? window.__API_BASE__ : "") ||
  "";

// normalisasi ke https://host tanpa slash akhir
function normalizeBase(u) {
  if (!u) return "";
  const trimmed = String(u).trim().replace(/\s+/g, "");
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProto.replace(/\/+$/, "");
}

export const BASE = normalizeBase(rawBase);

// helper fetch JSON (selalu no-store)
async function j(url, opt = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    referrerPolicy: "no-referrer",
    ...opt,
    headers: {
      "Content-Type": "application/json",
      ...(opt.headers || {}),
    },
    // Hindari proxy caching agresif di mobile
    credentials: "omit",
  });
  if (!res.ok) {
    let msg = "";
    try { msg = await res.text(); } catch {}
    throw new Error(msg || res.statusText || "Request failed");
  }
  return res.json();
}

// ===== APIs =====
export async function submitScore({ player, username, score }) {
  if (!BASE) throw new Error("VITE_API_URL (atau __API_BASE__) belum diset");
  return j(`${BASE}/submit-score`, {
    method: "POST",
    body: JSON.stringify({ player, username, score }),
  });
}

export async function fetchLeaderboard() {
  if (!BASE) throw new Error("VITE_API_URL (atau __API_BASE__) belum diset");
  return j(`${BASE}/leaderboard`);
}

export async function fetchPlayer(a) {
  if (!BASE) throw new Error("VITE_API_URL (atau __API_BASE__) belum diset");
  return j(`${BASE}/player/${a}`);
}

// MGID username lookup (selalu no-store)
export async function fetchUsername(a) {
  return j(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}`);
}

// Tx status dari server (no-store)
export async function getTxStatus(hash) {
  if (!BASE) throw new Error("VITE_API_URL (atau __API_BASE__) belum diset");
  return j(`${BASE}/tx/${hash}`);
}
