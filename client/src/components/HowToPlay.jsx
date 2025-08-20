// client/src/components/HowToPlay.jsx
export default function HowToPlay() {
  return (
    <div className="card">
      <div className="font-semibold mb-2">How to Play</div>
      <ul className="list-disc pl-5 space-y-1.5 text-[13px] leading-6">
        <li>
          Use <b>Left/Right Arrow</b> or tap/drag left–right to switch lanes.
        </li>
        <li>
          Avoid <b>obstacles</b> and grab <b>power‑ups</b>
          <span className="opacity-70"> (Shield, Slow‑mo, Double Score)</span>.
        </li>
        <li>
          Your score is <b>distance (m)</b>. The game speeds up non‑linearly (watch the pace).
        </li>
        <li>
          On death, your score is <b>submitted on‑chain automatically</b>.
        </li>
        <li>
          Press <b>R</b> to retry.
        </li>
      </ul>
    </div>
  );
}
