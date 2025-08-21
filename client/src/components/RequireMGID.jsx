"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { extractCrossAppWallet, CROSS_APP_ID, mgidRegisterUrl } from "../lib/privy";

/**
 * Gate wajib MGID:
 * - Tampil full-screen gate jika belum login
 * - Setelah login, wajib punya username MGID; jika belum, diarahkan ke halaman register
 * - Jika semua ok => render children(identity)
 *
 * Penggunaan:
 * <RequireMGID>
 *   {(identity)=> (<Game identity={identity} />)}
 * </RequireMGID>
 */
export default function RequireMGID({ children }) {
  const { ready, authenticated, user, login, loginWithCrossAppAccount, logout } = usePrivy();
  const [checking, setChecking] = useState(false);
  const [identity, setIdentity] = useState(null); // { address, username }

  const openMGIDModal = useCallback(async () => {
    try {
      // Prefer direct cross-app if SDK mendukung; fallback ke login() biasa
      if (typeof loginWithCrossAppAccount === "function") {
        await loginWithCrossAppAccount({
          providerAppId: CROSS_APP_ID,
          createAccount: true,
          // 🔧 PENTING UNTUK MOBILE: pastikan redirect kembali ke app
          redirectTo: window.location.origin,
        });
      } else {
        await login({
          // 🔧 sama: redirect balik ke app
          redirectTo: window.location.origin,
        });
      }
    } catch (e) {
      console.error("MGID login error:", e);
    }
  }, [login, loginWithCrossAppAccount]);

  // Saat status auth berubah, validasi wallet & username
  useEffect(() => {
    let alive = true;
    async function run() {
      if (!ready) return;
      setChecking(true);

      // Belum login -> identity null
      if (!authenticated || !user) {
        setIdentity(null);
        setChecking(false);
        return;
      }

      // Sudah login: ambil wallet MGID
      const addr = extractCrossAppWallet(user);
      if (!addr) {
        // Kasus langka: akun tidak memuat cross_app; paksa logout agar user login ulang dengan MGID
        console.warn("No MGID cross_app wallet found; forcing re-login.");
        setIdentity(null);
        setChecking(false);
        await logout();
        return;
      }

      // Cek username MGID
      try {
        const r = await fetch(
          `https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${addr}`
        );
        const d = await r.json();
        const username = d?.user?.username || null;

        if (!alive) return;

        if (!username) {
          // Wajib username → arahkan ke halaman register, lalu kembali ke app
          const returnTo = window.location.href;
          window.location.href = mgidRegisterUrl(returnTo);
          return;
        }

        setIdentity({ address: addr, username });
      } catch (err) {
        console.error("MGID username check failed:", err);
        setIdentity({ address: addr, username: null }); // fallback, tapi gate tetap menolak di bawah
      } finally {
        if (alive) setChecking(false);
      }
    }
    run();
    return () => { alive = false; };
  }, [ready, authenticated, user, logout]);

  // Loading state
  if (!ready || checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="card text-center">
          <div className="text-sm text-zinc-400 mb-2">Checking Monad Games ID…</div>
          <div className="text-lg font-semibold">Please wait</div>
        </div>
      </div>
    );
  }

  // Belum login: tampilkan gate dengan tombol MGID
  if (!authenticated) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center space-y-3">
          <div className="text-2xl font-bold">Sign in Required</div>
          <p className="text-sm text-zinc-400">
            You must sign in with <b>Monad Games ID</b> to play and submit scores.
          </p>
          <div className="pt-2">
            <button className="btn btn-primary w-full" onClick={openMGIDModal}>
              Sign in with Monad Games ID
            </button>
          </div>
          <div className="text-[11px] text-zinc-500">
            Make sure pop-ups are allowed and test in a clean browser profile if the modal doesn’t show.
          </div>
        </div>
      </div>
    );
  }

  // Sudah login tapi belum ada username (fallback proteksi – normalnya sudah redirect)
  if (!identity?.username) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center space-y-3">
          <div className="text-xl font-semibold">Complete your MGID</div>
          <p className="text-sm text-zinc-400">
            You need a <b>Monad Games ID username</b> to continue.
          </p>
          <a
            href={mgidRegisterUrl(window.location.href)}
            className="btn btn-primary w-full text-center block"
          >
            Register Username
          </a>
          <button className="btn w-full" onClick={() => window.location.reload()}>
            I’ve registered – Refresh
          </button>
        </div>
      </div>
    );
  }

  // Lolos gate → render konten (game, dashboard, dll)
  return typeof children === "function" ? children(identity) : children;
}
