import { useMemo } from 'react';
import useDashboardLive from '../hooks/useDashboardLive';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function shortAddr(a = '') {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—';
}

function dateLabel(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso || '—';
  }
}

export default function Dashboard({ identity }) {
  const { leaderboard, global, player } = useDashboardLive(identity);

  const rows = useMemo(() => leaderboard ?? [], [leaderboard]);
  const history = useMemo(() => (player?.history ?? []).slice().reverse(), [player]);

  return (
    <div className="space-y-6">
      {/* Kartu ringkas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Players</div>
          <div className="text-2xl font-semibold mt-1">{global?.players ?? '—'}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Top Distance</div>
          <div className="text-2xl font-semibold mt-1">{global?.global_best ?? '—'}</div>
          <div className="text-[11px] text-zinc-500">Global best (m)</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Your PB</div>
          <div className="text-2xl font-semibold mt-1">{player?.best ?? '—'}</div>
          <div className="text-[11px] text-zinc-500">Personal best (m)</div>
        </div>
        <div className="card p-4">
          <div className="text-xs uppercase tracking-wide text-zinc-400">Sessions</div>
          <div className="text-2xl font-semibold mt-1">{global?.last24h ?? '—'}</div>
          <div className="text-[11px] text-zinc-500">24h total</div>
        </div>
      </div>

      {/* Leaderboard global */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Global Leaderboard</h3>
          <div className="text-xs text-zinc-500">
            {rows?.length || 0} entries
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-zinc-400">
              <tr className="border-b border-white/5">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Username</th>
                <th className="py-2 pr-3">Address</th>
                <th className="py-2 pr-3">Best Distance</th>
                <th className="py-2 pr-3">Last Played</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-zinc-500">
                    No entries yet.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.player + i} className="border-b border-white/5">
                  <td className="py-2 pr-3">{i + 1}</td>
                  <td className="py-2 pr-3">{r.username || '—'}</td>
                  <td className="py-2 pr-3 font-mono">{shortAddr(r.player)}</td>
                  <td className="py-2 pr-3">{r.high_score}</td>
                  <td className="py-2 pr-3">{dateLabel(r.last_played)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Progress pemain */}
      <div className="card p-4">
        <h3 className="text-lg font-semibold mb-3">Your Progress</h3>
        {history.length === 0 ? (
          <div className="text-sm text-zinc-500">No runs yet. Play to see your progress here.</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="c" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopOpacity={0.35}/>
                    <stop offset="95%" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis
                  dataKey="at"
                  tickFormatter={(v) => {
                    try {
                      const d = new Date(v);
                      return d.toLocaleTimeString();
                    } catch { return v; }
                  }}
                  minTickGap={24}
                />
                <YAxis width={40} />
                <Tooltip
                  formatter={(value, name) => [value, name === 'score' ? 'Distance (m)' : name]}
                  labelFormatter={(l) => dateLabel(l)}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  strokeOpacity={0.9}
                  fillOpacity={1}
                  fill="url(#c)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
