import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState, useCallback } from 'react';
import { extractCrossAppWallet, CROSS_APP_ID, mgidRegisterUrl } from '../lib/privy';

export default function Navbar({ onIdentity }){
  const { login, loginWithCrossAppAccount, logout, authenticated, ready, user } = usePrivy();
  const [addr, setAddr] = useState(null);
  const [uname, setUname] = useState(null);
  const [busy, setBusy] = useState(false);

  const openMGIDModal = useCallback(async ()=>{
    setBusy(true);
    try{
      // Prefer cross-app direct if available in this SDK build
      if (typeof loginWithCrossAppAccount === 'function') {
        await loginWithCrossAppAccount({ providerAppId: CROSS_APP_ID, createAccount: true });
      } else {
        // Fallback: open the standard modal (it will show MGID because of Provider config)
        await login();
      }
    } finally { setBusy(false); }
  }, [login, loginWithCrossAppAccount]);

  useEffect(()=>{
    if(!ready){ onIdentity?.(null); return; }
    if(!authenticated || !user){ setAddr(null); setUname(null); onIdentity?.(null); return; }

    const a = extractCrossAppWallet(user);
    if(!a){
      setAddr(null); setUname(null);
      return;
    }
    setAddr(a);

    fetch(`https://monad-games-id-site.vercel.app/api/check-wallet?wallet=${a}`)
      .then(r=>r.json())
      .then(d=>{
        const name = d?.user?.username || null;
        if(!name){
          // Enforce username: redirect user to register, then return back to this page
          window.location.href = mgidRegisterUrl(window.location.href);
          return;
        }
        setUname(name);
        onIdentity?.({ address: a, username: name });
      })
      .catch(()=> onIdentity?.({ address: a, username: null }));
  },[authenticated, ready, user, onIdentity]);

  return (
    <div className="w-full flex items-center justify-between p-3 xs:p-4 border-b border-zinc-800 sticky top-0 bg-black/70 backdrop-blur z-40">
      <div className="text-lg xs:text-xl font-bold tracking-wide">
        <span className="text-fuchsia-500">Cyber</span> Runner X
      </div>
      <div className="flex items-center gap-3">
        {addr && (
          <div className="hidden md:block text-right leading-tight">
            <div className="text-[11px] text-zinc-400">Signed in</div>
            <div className="text-sm font-mono">{uname ? `@${uname}` : addr.slice(0,6)+'…'+addr.slice(-4)}</div>
          </div>
        )}
        {!authenticated ? (
          <button
            className="btn btn-primary disabled:opacity-60"
            disabled={busy}
            onClick={openMGIDModal}
            aria-label="Sign in with Monad Games ID"
          >
            {busy ? 'Opening…' : 'Sign in with Monad Games ID'}
          </button>
        ) : (
          <button className="btn" onClick={logout}>Logout</button>
        )}
      </div>
    </div>
  );
}
