// ====== BASE URL sangat robust ======
const rawBase =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE ||
  (typeof window !== "undefined" ? window.__API_BASE__ : "") || "";

function normalizeBase(u) {
  if (!u) return "";
  const t = String(u).trim().replace(/\s+/g, "");
  const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return withProto.replace(/\/+$/, "");
}
export const BASE = normalizeBase(rawBase);

// ====== util: no-store keras + retry + coalescing + last-good + query-bust ======
const inflight = new Map();      // key -> Promise
const lastGood = new Map();      // key -> { ts, data }
const RETRIES = 3;
const BACKOFFS = [200, 500, 1200];

function addNoStoreQS(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}__ts=${Date.now()}`; // bust CDN/intermediate cache
}
async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url, opt = {}, keyForCoalesce, isGET = true) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Accept": "application/json",
    ...(opt.headers || {}),
  };
  const finalURL = isGET ? addNoStoreQS(url) : url;

  const doFetch = async () => {
    let err;
    for (let i = 0; i < RETRIES; i++) {
      try {
        const res = await fetch(finalURL, {
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
          keepalive: true,
          ...opt,
          headers,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || res.statusText || `HTTP ${res.status}`);
        }
        const data = await res.json();
        lastGood.set(keyForCoalesce || finalURL, { ts: Date.now(), data });
        return data;
      } catch (e) {
        err = e;
        if (i < RETRIES - 1) await sleep(BACKOFFS[i]);
      }
    }
    if (lastGood.has(keyForCoalesce || finalURL)) {
      return lastGood.get(keyForCoalesce || finalURL).data;
    }
    throw err || new Error("Network error");
  };

  const key = keyForCoalesce || finalURL;
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
  }, "POST:/submit-score", /* isGET */ false);
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
