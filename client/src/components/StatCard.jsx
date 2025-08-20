export default function StatCard({ label, value, hint, trend }){
  return (
    <div className="card-tight">
      <div className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-[28px] leading-none font-extrabold">{value}</div>
        {trend != null && (
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${trend>=0?'bg-emerald-500/15 text-emerald-400':'bg-rose-500/15 text-rose-400'}`}>
            {trend>=0?'+':''}{trend}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-[12px] text-zinc-400">{hint}</div>}
    </div>
  );
}
