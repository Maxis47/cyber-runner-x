// Robust base URL resolver + no-store caching → data muncul di semua device
const rawBase =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE || // fallback kalau env kamu pakai nama ini
  "";

function normalizeBase(u) {
  if (!u) return "";
  const trimmed = u.replace(/\s+/g, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  // kalau user isi domain tanpa skema di Vercel (mis: cyber-runner-x-production.up.railway.app)
  return `https://${trimmed}`.replace(/\/+$/, "");
}

export const BASE = normalizeBase(rawBase);

// helper fetch JSON
async function j(url, opt = {}) {
  const res = await fetch(url, {
    cache: "no-store",
    ...opt,
    headers: {
      "Content-Type": "application/json",
      ...(opt.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = "";
    try { msg = await res.text(); } catch {}
    throw new Error(msg || res.statusText || "Request failed");
  }
  return res.json();
}

// API utama (server Railway)
export async function submitScore({ player, username, score }) {
  if (!BASE) throw new Error("VITE_API_URL is not set");
  return j(`${BASE}/submit-score`, {
    method: "POST",
    body: JSON.stringify({ player, username, score }),
  });
}

export async function fetchLeaderboard() {
  if (!BASE) throw new Error("VITE_API_URL is not set");
  return j(`${BASE}/leaderboard`);
}

export async function fetchPlayer(a) {
  if (!BASE) throw new Error("VITE_API_URL is not set");
  return j(`${BASE}/player/${a}`);
}

// MGID username lookup (selalu no-store)
export async function fetchUsername(a) {
  return j(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}`);
}

// Tx status dari server (no-store)
export async function getTxStatus(hash) {
  if (!BASE) throw new Error("VITE_API_URL is not set");
  return j(`${BASE}/tx/${hash}`);
}
