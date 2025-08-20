// client/src/components/Dashboard.jsx
import { useEffect, useMemo, useState } from 'react';
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
                <td className="p-2 font-mono">{r.player?.slice(0,6)}…{r.player?.slice(-4)}</td>
                <td className="p-2 text-right font-semibold">{Number(r.high_score||0).toLocaleString()}</td>
                <td className="p-2 text-zinc-400">
                  {r.last_played ? new Date(r.last_played).toLocaleString() : '—'}
                </td>
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

  useEffect(()=>{ fetchLeaderboard().then(setRows); },[]);
  useEffect(()=>{ if(identity?.address) fetchPlayer(identity.address).then(setMe); },[identity]);

  // ======= Nilai yang AKURAT (tidak bergantung urutan data) =======
  const playersCount = useMemo(
    () => new Set(rows.map(r => r.player)).size,
    [rows]
  );

  const topDistance = useMemo(
    () => rows.reduce((m, r) => Math.max(m, Number(r.high_score||0)), 0),
    [rows]
  );

  const myPB = useMemo(() => {
    const fromBest = Number(me?.best ?? 0);
    const fromHistory = Array.isArray(me?.history) && me.history.length
      ? Math.max(...me.history.map(h => Number(h.score||0)))
      : 0;
    return Math.max(fromBest, fromHistory);
  }, [me]);

  const mySessions = useMemo(() => {
    if (typeof me?.plays === 'number') return me.plays;
    if (Array.isArray(me?.history)) return me.history.length;
    return 0;
  }, [me]);

  const chartData = useMemo(() => {
    const src = Array.isArray(me?.history) ? me.history : [];
    return src.slice().reverse().map(h => ({
      t: new Date(h.at).toLocaleTimeString(),
      s: Number(h.score||0)
    }));
  }, [me]);

  return (
    <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
      {/* LEFT: Stats + Leaderboard */}
      <div className="2xl:col-span-2 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Players" value={playersCount.toLocaleString()} />
          <StatCard label="Top Distance" value={topDistance.toLocaleString()} hint="Global best (m)" />
          <StatCard label="Your PB" value={myPB.toLocaleString()} hint="Personal best (m)" />
          <StatCard label="Sessions" value={mySessions.toLocaleString()} hint="24h total" />
        </div>

        <Leaderboard rows={rows} />

        <div className="card">
          <div className="font-semibold mb-2">Your Progress</div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
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
