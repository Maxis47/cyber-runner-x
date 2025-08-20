export const CROSS_APP_ID = 'cmd8euall0037le0my79qpz42';

export function extractCrossAppWallet(user){
  const cross = user?.linkedAccounts?.find(
    a => a.type === 'cross_app' && a?.providerApp?.id === CROSS_APP_ID
  );
  return cross?.embeddedWallets?.[0]?.address || null;
}

export function mgidRegisterUrl(returnTo){
  const u = new URL('https://monad-games-id-site.vercel.app/');
  if(returnTo) u.searchParams.set('return_to', returnTo);
  return u.toString();
}
