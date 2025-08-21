// ====== BASE URL sangat robust ======
const rawBase =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||                           // fallback env lama
  (typeof window !== "undefined" ? window.__API_BASE__ : "") || "";

function normalizeBase(u) {
  if (!u) return "";
  const t = String(u).trim().replace(/\s+/g, "");
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return withProto.replace(/\/+$/, "");
}
export const BASE = normalizeBase(rawBase);

// ====== util: no-store kuat + retry + coalescing + last-good ======
const inflight = new Map();      // key -> Promise
const lastGood = new Map();      // key -> { ts, data }
const TTL = 0;                   // selalu fresh (tanpa cache mem), tapi simpan last good untuk anti-flicker
const RETRIES = 3;
const BACKOFFS = [200, 500, 1200];

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url, opt = {}, keyForCoalesce) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Accept": "application/json",
    ...(opt.headers || {}),
  };

  const doFetch = async () => {
    let err;
    for (let i = 0; i < RETRIES; i++) {
      try {
        const res = await fetch(url, {
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          ...opt,
          headers,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || res.statusText || `HTTP ${res.status}`);
        }
        const data = await res.json();
        lastGood.set(keyForCoalesce || url, { ts: Date.now(), data });
        return data;
      } catch (e) {
        err = e;
        // kalau masih ada kesempatan, tunggu lalu ulang
        if (i < RETRIES - 1) await sleep(BACKOFFS[i]);
      }
    }
    // Gagal semua → coba kembalikan last good agar UI tidak jadi kosong
    if (lastGood.has(keyForCoalesce || url)) {
      return lastGood.get(keyForCoalesce || url).data;
    }
    throw err || new Error("Network error");
  };

  // coalescing: kalau request ke key yang sama sedang jalan, tunggu saja
  const key = keyForCoalesce || url;
  if (inflight.has(key)) return inflight.get(key);
  const p = doFetch().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ====== API publik (signature tetap) ======
export async function submitScore({ player, username, score }) {
  if (!BASE) throw new Error("VITE_API_URL (atau __API_BASE__) belum diset");
  return fetchJSON(`${BASE}/submit-score`, {
    method: "POST",
    body: JSON.stringify({ player, username, score }),
  }, "POST:/submit-score");
}

export async function fetchLeaderboard() {
  if (!BASE) throw new Error("VITE_API_URL (atau __API_BASE__) belum diset");
  return fetchJSON(`${BASE}/leaderboard`, {}, "GET:/leaderboard");
}

export async function fetchPlayer(a) {
  if (!BASE) throw new Error("VITE_API_URL (atau __API_BASE__) belum diset");
  return fetchJSON(`${BASE}/player/${a}`, {}, `GET:/player/${a}`);
}

export async function fetchUsername(a) {
  // endpoint eksternal (MGID) — juga dipaksa no-store + retry
  return fetchJSON(
    `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}`,
    {},
    `GET:/mgid/${a}`
  );
}

export async function getTxStatus(hash) {
  if (!BASE) throw new Error("VITE_API_URL (atau __API_BASE__) belum diset");
  return fetchJSON(`${BASE}/tx/${hash}`, {}, `GET:/tx/${hash}`);
}
