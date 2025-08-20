import { useEffect, useState } from 'react';

export default function SettingsPanel({ open, onClose, value, onChange, onPauseToggle, paused }) {
  const [local, setLocal] = useState(value);
  useEffect(()=>{ setLocal(value); }, [value]);
  const apply = () => { onChange?.(local); onClose?.(); };

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="modal-card">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-bold">Settings</div>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>

        <div className="space-y-4">
          {/* Difficulty */}
          <div className="card">
            <div className="font-semibold mb-2">Difficulty</div>
            <div className="flex gap-2">
              {['normal','hard'].map(d => (
                <button key={d}
                  className={`btn ${local.difficulty===d?'btn-primary':'btn-ghost'}`}
                  onClick={()=> setLocal(s=>({ ...s, difficulty:d }))}
                >
                  {d === 'hard' ? 'Hard (x1.8)' : 'Normal'}
                </button>
              ))}
            </div>
          </div>

          {/* Drag sensitivity */}
          <div className="card">
            <div className="font-semibold mb-2">Drag Sensitivity</div>
            <input type="range" min="0.10" max="0.60" step="0.01"
              value={local.sensitivity}
              onChange={e=> setLocal(s=>({ ...s, sensitivity: Number(e.target.value) }))}
              className="w-full"
            />
            <div className="text-sm text-muted mt-1">{local.sensitivity.toFixed(2)}</div>
          </div>

          {/* Theme */}
          <div className="card">
            <div className="font-semibold mb-2">Theme</div>
            <div className="flex flex-wrap gap-2">
              {['auto','dark','neon','light'].map(t => (
                <button key={t}
                  className={`btn ${local.theme===t?'btn-primary':'btn-ghost'}`}
                  onClick={()=> setLocal(s=>({ ...s, theme:t }))}
                >
                  {t[0].toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted mt-1">Auto follows your OS preference.</div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={apply}>Save</button>
            <button className="btn btn-ghost" onClick={onPauseToggle}>
              {paused ? 'Resume Game' : 'Pause Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
