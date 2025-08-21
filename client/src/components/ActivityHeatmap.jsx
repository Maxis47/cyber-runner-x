// client/src/components/ActivityHeatmap.jsx
import { useMemo } from 'react';

export default function ActivityHeatmap({ grid }) {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // --- Sanitasi & normalisasi 7x24 (non-negatif) ---
  const safeGrid = useMemo(() => {
    const isArray = Array.isArray(grid);
    const base = Array.from({ length: 7 }, () => Array(24).fill(0));
    if (!isArray) return base;

    for (let r = 0; r < 7; r++) {
      const row = Array.isArray(grid[r]) ? grid[r] : [];
      for (let c = 0; c < 24; c++) {
        const v = Number(row[c] ?? 0);
        base[r][c] = Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
      }
    }
    return base;
  }, [grid]);

  // --- Ambil semua nilai > 0 untuk skala (anti outlier) ---
  const { maxEff } = useMemo(() => {
    const values = [];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 24; c++) {
        const v = safeGrid[r][c];
        if (v > 0) values.push(v);
      }
    }
    if (values.length === 0) return { maxEff: 1 };

    // percentile-95 agar tidak bias outlier
    values.sort((a, b) => a - b);
    const idx = Math.min(values.length - 1, Math.floor(0.95 * values.length));
    const p95 = values[idx] || 1;
    // jangan terlalu kecil
    return { maxEff: Math.max(1, p95) };
  }, [safeGrid]);

  // palet (tetap fuchsia seperti sebelumnya; urutan & kelas tidak berubah)
  const shades = [
    'bg-zinc-900',
    'bg-fuchsia-900/30',
    'bg-fuchsia-800/60',
    'bg-fuchsia-700/80',
    'bg-fuchsia-500'
  ];

  // format jam HH:00 lokal
  const hLabel = (h) => `${String(h).padStart(2, '0')}:00`;

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
                  // rasio berdasarkan p95 (lebih akurat merepresentasikan sebaran)
                  const ratio = v <= 0 ? 0 : v / maxEff;
                  const step =
                    ratio === 0 ? 0 :
                    ratio < 0.25 ? 1 :
                    ratio < 0.5  ? 2 :
                    ratio < 0.75 ? 3 : 4;

                  return (
                    <div
                      key={c}
                      title={`${days[r]} ${hLabel(c)} — ${v} ${v === 1 ? 'play' : 'plays'}`}
                      aria-label={`${days[r]} ${hLabel(c)}: ${v} plays`}
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
