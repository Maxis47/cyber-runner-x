export function connectWS(baseUrl, onMessage){
  const url = (baseUrl||'').replace(/^http/,'ws');
  const ws = new WebSocket(url);
  ws.onmessage = (e)=>{ try{ const m=JSON.parse(e.data); onMessage?.(m); }catch{} };
  return ws;
}