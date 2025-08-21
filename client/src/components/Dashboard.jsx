// client/src/components/Dashboard.jsx
import { useEffect, useRef, useState } from 'react';
import { fetchLeaderboard, fetchPlayer } from '../lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import HowToPlay from './HowToPlay';

function StatCard({ label, value, hint }) {
  return (
    <div className="card-tight">
      <div className="metric">{label}</div>
      <div className="metric-xl mt-1">{value}</div>
      {hint && <div className="text-[11px] text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
}

function Leaderboard({ rows=[] }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">Global Leaderboard</div>
        <div className="text-xs text-zinc-400">{rows.length} entries</div>
      </div>
      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="min-w-full text-[13px]">
          <thead className="bg-black/70 backdrop-blur text-zinc-400">
            <tr>
              <th className="text-left p-2">#</th>
              <th className="text-left p-2">Username</th>
              <th className="text-left p-2">Address</th>
              <th className="text-right p-2">Best Distance</th>
              <th className="text-left p-2">Last Played</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0,8).map((r,i)=>(
              <tr key={r.player} className="border-t border-zinc-800">
                <td className="p-2 w-8">{i+1}</td>
                <td className="p-2">{r.username ? `@${r.username}` : '—'}</td>
                <td className="p-2 font-mono">{r.player.slice(0,6)}…{r.player.slice(-4)}</td>
                <td className="p-2 text-right font-semibold">{r.high_score}</td>
                <td className="p-2 text-zinc-400">{new Date(r.last_played).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length>8 && <div className="mt-1 text-[11px] text-zinc-500">Showing top 8</div>}
    </div>
  );
}

export default function Dashboard({ identity }) {
  const [rows, setRows] = useState([]);
  const [me, setMe] = useState(null);

  // ====== SSE URLs ======
  const API = import.meta.env.VITE_API_URL;
  const lbESRef = useRef(null);
  const meESRef = useRef(null);
  const lbPollRef = useRef(null);
  const mePollRef = useRef(null);

  // ====== Initial fetch (render pertama cepat) ======
  useEffect(()=>{ fetchLeaderboard().then((list)=>{
    // Pastikan urut & bersih
    const sorted = (list||[]).slice().sort((a,b)=> (b.high_score - a.high_score) || b.last_played.localeCompare(a.last_played));
    setRows(sorted);
  }).catch(()=>{}); },[]);

  useEffect(()=>{
    if(identity?.address){
      fetchPlayer(identity.address).then(setMe).catch(()=>{});
    }
  },[identity]);

  // ====== SSE Leaderboard (realtime) + fallback polling ======
  useEffect(()=>{
    // Bersihkan kalau ada sesi sebelumnya
    if(lbESRef.current){ lbESRef.current.close(); lbESRef.current = null; }
    if(lbPollRef.current){ clearInterval(lbPollRef.current); lbPollRef.current = null; }

    // Coba SSE kalau tersedia API
    if(API && 'EventSource' in window){
      try{
        const es = new EventSource(`${API}/stream/leaderboard?ts=${Date.now()}`);
        lbESRef.current = es;
        es.onmessage = (ev)=>{
          try{
            const msg = JSON.parse(ev.data);
            // server kirim { type: 'leaderboard', data: [...] }
            const data = Array.isArray(msg) ? msg : msg?.data;
            if(Array.isArray(data)){
              const sorted = data.slice().sort((a,b)=> (b.high_score - a.high_score) || b.last_played.localeCompare(a.last_played));
              setRows(sorted);
            }
          }catch{}
        };
        es.onerror = ()=>{ try{ es.close(); }catch{}; lbESRef.current = null; };
        return ()=>{ try{ es.close(); }catch{}; lbESRef.current = null; };
      }catch{/* fallback below */}
    }

    // Fallback: polling ringan tiap 1.2s
    lbPollRef.current = setInterval(()=>{
      fetchLeaderboard().then((list)=>{
        const sorted = (list||[]).slice().sort((a,b)=> (b.high_score - a.high_score) || b.last_played.localeCompare(a.last_played));
        setRows(sorted);
      }).catch(()=>{});
    },1200);

    return ()=>{ if(lbPollRef.current) clearInterval(lbPollRef.current); lbPollRef.current = null; };
  },[API]);

  // ====== SSE Player (realtime) + fallback polling ======
  useEffect(()=>{
    // Bersihkan sesi lama
    if(meESRef.current){ meESRef.current.close(); meESRef.current = null; }
    if(mePollRef.current){ clearInterval(mePollRef.current); mePollRef.current = null; }
    const addr = identity?.address;
    if(!addr) return;

    // SSE
    if(API && 'EventSource' in window){
      try{
        const es = new EventSource(`${API}/stream/player/${addr.toLowerCase()}?ts=${Date.now()}`);
        meESRef.current = es;
        es.onmessage = (ev)=>{
          try{
            const msg = JSON.parse(ev.data);
            // server kirim { type: 'player', addr, data: {...} }
            const data = msg?.data ?? msg;
            if(data && typeof data === 'object') setMe(data);
          }catch{}
        };
        es.onerror = ()=>{ try{ es.close(); }catch{}; meESRef.current = null; };
        return ()=>{ try{ es.close(); }catch{}; meESRef.current = null; };
      }catch{/* fallback below */}
    }

    // Fallback polling tiap 1.2s
    mePollRef.current = setInterval(()=>{
      fetchPlayer(addr).then(setMe).catch(()=>{});
    },1200);

    return ()=>{ if(mePollRef.current) clearInterval(mePollRef.current); mePollRef.current = null; };
  },[API, identity]);

  // ====== Nilai kartu (akurat) ======
  // Players: jumlah address unik pada leaderboard
  const playersCount = new Set((rows||[]).map(r=>r.player)).size;

  // Top Distance: ambil max dari semua high_score (lebih aman daripada rows[0])
  const topDistance = (rows||[]).reduce((m,r)=> Math.max(m, r?.high_score ?? 0), 0);

  // Your PB
  const yourPB = me?.best ?? 0;

  // Sessions(24h) — akurat: hitung dari history user 24 jam terakhir
  const sessions24h = (() => {
    const hist = me?.history || [];
    if(hist.length === 0) return 0;
    const since = Date.now() - 24*60*60*1000;
    return hist.filter(h => {
      const t = new Date(h.at).getTime();
      return Number.isFinite(t) && t >= since;
    }).length;
  })();

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
      {/* LEFT: Stats + Leaderboard */}
      <div className="2xl:col-span-2 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Players" value={playersCount} />
          <StatCard label="Top Distance" value={topDistance} hint="Global best (m)" />
          <StatCard label="Your PB" value={yourPB} hint="Personal best (m)" />
          <StatCard label="Sessions" value={sessions24h} hint="24h total" />
        </div>

        <Leaderboard rows={rows} />

        <div className="card">
          <div className="font-semibold mb-2">Your Progress</div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={(me?.history??[])
                  .slice()
                  .reverse()
                  .map(h=>({ t:new Date(h.at).toLocaleTimeString(), s:h.score }))}
              >
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c084fc" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#c084fc" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" hide/>
                <YAxis hide/>
                <Tooltip/>
                <Area type="monotone" dataKey="s" stroke="#c084fc" fillOpacity={1} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* RIGHT: only How to Play now */}
      <div className="space-y-6">
        <HowToPlay />
      </div>
    </div>
  );
}
