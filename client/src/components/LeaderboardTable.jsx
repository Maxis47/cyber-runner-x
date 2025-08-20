export default function LeaderboardTable({ rows=[] }){
  const safe = Array.isArray(rows) ? rows : [];
  return (
    <div className="card">
      <div className="panel-title">Global Leaderboard</div>
      <div className="max-h-[320px] overflow-auto rounded-2xl border border-white/10 bg-white/5 no-scrollbar">
        <table className="table table-compact">
          <thead className="bg-black/50 sticky top-0 backdrop-blur text-zinc-300">
            <tr>
              <th className="text-left px-3 py-2">#</th>
              <th className="text-left px-3 py-2">Username</th>
              <th className="text-left px-3 py-2">Address</th>
              <th className="text-right px-3 py-2">Best Distance</th>
              <th className="text-left px-3 py-2">Last Played</th>
            </tr>
          </thead>
          <tbody>
            {safe.length===0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                  No entries yet.
                </td>
              </tr>
            )}
            {safe.map((r,i)=>(
              <tr
                key={r.player + i}
                className="border-t border-white/10 hover:bg-white/5 transition"
              >
                <td className="px-3 py-2">{i+1}</td>
                <td className="px-3 py-2">
                  {r.username? (
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400/80 shadow-[0_0_12px_rgba(177,140,255,.6)]" />
                      @{r.username}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-[12px] text-zinc-300">
                  {r.player.slice(0,6)}…{r.player.slice(-4)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-400/20">
                    {r.high_score}
                  </span>
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {r.last_played ? new Date(r.last_played).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
