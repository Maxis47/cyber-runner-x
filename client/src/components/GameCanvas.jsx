// client/src/components/GameCanvas.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Kanvas pembungkus:
 * - 9:16 (portrait) dihitung di Game.jsx
 * - Selalu di TENGAH (mx-auto) terlepas dari grid parent
 * - Swipe mulus: touchAction: 'none'
 *
 * Tambahan: kontrol ukuran (+ / -)
 * - Langsung mengubah lebar wrapper → Game.jsx (ResizeObserver) otomatis menyesuaikan ukuran canvas.
 * - Persist di localStorage: "crx_canvas_step"
 */
export default function GameCanvas({ wrapRef, canvasRef, className = "" }) {
  // 5 langkah ukuran: dari kompak → ekstra besar (aman di HP/Tablet/Desktop)
  const SIZE_STEPS = [
    { id: 0, width: "min(84vw, 480px)", maxPx: 480 },
    { id: 1, width: "min(92vw, 560px)", maxPx: 560 }, // DEFAULT (sama seperti sebelumnya)
    { id: 2, width: "min(96vw, 640px)", maxPx: 640 },
    { id: 3, width: "min(98vw, 720px)", maxPx: 720 },
    { id: 4, width: "min(100vw, 820px)", maxPx: 820 },
  ];

  const [step, setStep] = useState(() => {
    const saved = Number(localStorage.getItem("crx_canvas_step"));
    return Number.isFinite(saved) ? Math.max(0, Math.min(SIZE_STEPS.length - 1, saved)) : 1;
  });

  useEffect(() => {
    localStorage.setItem("crx_canvas_step", String(step));
  }, [step]);

  const sz = useMemo(() => SIZE_STEPS[step] || SIZE_STEPS[1], [step]);

  return (
    <div
      ref={wrapRef}
      className={
        `mx-auto w-full max-w-[1040px]
         rounded-2xl border border-white/10 bg-black/20 p-3
         shadow-[0_0_80px_rgba(0,0,0,0.25)]
         flex items-center justify-center ${className}`
      }
      style={{
        marginLeft: "auto",
        marginRight: "auto",
        // RESPONSIF berbasis pilihan user:
        width: sz.width,
        maxWidth: `${sz.maxPx}px`,
        minWidth: "300px",
        // Pastikan kanvas tidak menutupi komponen lain
        overflow: "hidden",
        position: "relative",
        zIndex: 0,
      }}
    >
      {/* Kontrol ukuran (pojok kanan atas) */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          display: "flex",
          gap: 6,
          zIndex: 2,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 999,
          padding: "4px 6px",
          backdropFilter: "blur(6px)",
        }}
      >
        <button
          title="Shrink"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          style={{
            width: 28, height: 28, lineHeight: "28px",
            borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "#e8e8f6", fontSize: 16, cursor: "pointer"
          }}
        >
          –
        </button>
        <div
          style={{
            alignSelf: "center",
            fontSize: 12,
            color: "rgba(232,232,246,0.8)",
            padding: "0 4px",
            minWidth: 44,
            textAlign: "center"
          }}
        >
          {["S","M","L","XL","XXL"][step] || "M"}
        </div>
        <button
          title="Enlarge"
          onClick={() => setStep((s) => Math.min(SIZE_STEPS.length - 1, s + 1))}
          style={{
            width: 28, height: 28, lineHeight: "28px",
            borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.06)",
            color: "#e8e8f6", fontSize: 16, cursor: "pointer"
          }}
        >
          +
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          display: "block",
          width: "100%",
          borderRadius: 12,
          // cegah browser gestures → swipe analog super mulus
          touchAction: "none",
          // ekstra stabil di mobile:
          userSelect: "none",
          WebkitUserSelect: "none",
          msUserSelect: "none",
          WebkitTouchCallout: "none",
          position: "relative",
          zIndex: 0,
        }}
      />
    </div>
  );
}
