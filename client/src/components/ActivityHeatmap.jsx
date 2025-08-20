// client/src/components/ActivityHeatmap.jsx
export default function ActivityHeatmap({ grid }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const max = Math.max(1, ...(Array.isArray(grid) ? grid.flat() : [1]));
  const safeGrid = Array.isArray(grid) ? grid : Array.from({length:7},()=>Array(24).fill(0));

  return (
    <div className="card">
      <div className="font-semibold mb-2">Activity (7×24)</div>
      <div className="min-w-full">
        <div className="grid grid-rows-7 gap-[6px]">
          {safeGrid.map((row, r) => (
            <div key={r} className="flex items-center gap-2">
              <div className="w-4 text-[10px] text-zinc-500 text-right">{days[r]}</div>
              <div className="grid grid-cols-24 gap-[6px]">
                {row.map((v, c) => {
                  const ratio = v / max;
                  const step = ratio === 0 ? 0 : ratio < .25 ? 1 : ratio < .5 ? 2 : ratio < .75 ? 3 : 4;
                  const shades = [
                    'bg-zinc-900',
                    'bg-fuchsia-900/30',
                    'bg-fuchsia-800/60',
                    'bg-fuchsia-700/80',
                    'bg-fuchsia-500'
                  ];
                  return (
                    <div
                      key={c}
                      title={`${days[r]} ${c}:00 — ${v} plays`}
                      className={`w-2.5 h-2.5 rounded-[5px] ${shades[step]} border border-white/10`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
