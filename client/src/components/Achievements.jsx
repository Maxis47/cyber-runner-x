const defs = [
  { id:'laser_dodger', name:'Laser Dodger', cond:(p)=>p.best>=20, desc:'Survive 20 lasers' },
  { id:'speed_demon', name:'Speed Demon', cond:(p)=>p.best>=60, desc:'Reach extreme speed' },
  { id:'survivor', name:'Survivor', cond:(p)=>p.best>=100, desc:'100m distance' },
  { id:'perfect_10', name:'Perfect 10', cond:(p)=>p.best>=40, desc:'10 perfect dodges' },
  { id:'night_runner', name:'Night Runner', cond:(p)=>p.plays>=20, desc:'20 sessions' },
];
export default function Achievements({ playerStats }){
  return (
    <div className="card">
      <div className="font-semibold mb-2">Achievements</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {defs.map(a=>{
          const ok = a.cond(playerStats||{best:0, plays:0});
          return (
            <div key={a.id} className={`p-3 rounded-xl border ${ok? 'border-fuchsia-500 bg-fuchsia-500/10':'border-zinc-800 bg-zinc-900/60'}`}>
              <div className="font-semibold">{a.name}</div>
              <div className="text-xs text-zinc-400">{a.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}