// client/src/lib/mgidClient.js

/**
 * Shim MGID ringan. Jika halaman sudah inject window.mgid dari SDK aslinya,
 * kita pakai itu; kalau tidak, sediakan fallback (redirect ke URL).
 */

export function getIdentityFromWindow() {
  // Prioritas: SDK → window.identity → localStorage (opsional)
  if (window.mgid?.getIdentity) return window.mgid.getIdentity();
  if (window.identity) return window.identity;
  try {
    const raw = localStorage.getItem("mgid_identity");
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function isSignedIn() {
  if (window.mgid?.isSignedIn) return !!window.mgid.isSignedIn();
  const id = getIdentityFromWindow();
  return !!(id?.address);
}

export function hasUsername() {
  const id = getIdentityFromWindow();
  return !!(id?.username && String(id.username).trim());
}

export async function signInWithMGID() {
  if (window.mgid?.signIn) return window.mgid.signIn();
  // fallback ke route auth kamu
  window.location.href = "/auth/mgid";
}

export function openUsernameRegistration() {
  if (window.mgid?.openUsernameRegistration) return window.mgid.openUsernameRegistration();
  // fallback ke halaman username kamu
  window.location.href = "/mgid/register-username";
}

// (Opsional) dengarkan event identitas berubah dari SDK
export function onIdentityChanged(cb) {
  const handler = (e) => cb(e?.detail || getIdentityFromWindow());
  window.addEventListener("mgid:identity", handler);
  return () => window.removeEventListener("mgid:identity", handler);
}
