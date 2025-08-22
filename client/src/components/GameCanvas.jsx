// client/src/components/GameCanvas.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * Kanvas pembungkus:
 * - 9:16 (portrait) dihitung di Game.jsx
 * - Selalu di TENGAH (mx-auto) terlepas dari grid parent
 * - Swipe mulus: touchAction: 'none'
 *
 * Penyesuaian ukuran (HANYA di sini):
 * - Kita batasi lebar wrapper secara responsif supaya Game.jsx selalu
 *   menghitung kanvas 9:16 pada ukuran yang pas di semua device.
 */
export default function GameCanvas({ wrapRef, canvasRef, className = "" }) {
  const [maxW, setMaxW] = useState(520); // px, responsif
  const roRef = useRef(null);

  useEffect(() => {
    const compute = () => {
      const vw = Math.max(320, Math.floor(window.innerWidth || 320));

      // Target responsif:
      // - Mobile/Tablet: ~92vw (biar penuh & tidak kecil)
      // - Desktop: ~26–30vw namun dibatasi agar tidak kebesaran
      const idealByVw =
        vw >= 1024 ? Math.round(vw * 0.28) : Math.round(vw * 0.92);

      // Batas aman universal
      const MIN = vw >= 1024 ? 380 : 300; // min visual px
      const MAX = 560;                    // max supaya desktop tidak terlalu besar

      const next = Math.max(MIN, Math.min(idealByVw, MAX));
      setMaxW(next);
    };

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);

    // Observe perubahan lebar kolom parent → trigger ulang hitung di Game.jsx
    const el = wrapRef?.current;
    if (el && "ResizeObserver" in window) {
      const ro = new ResizeObserver(() => compute());
      ro.observe(el);
      roRef.current = ro;
    }

    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
      if (roRef.current && wrapRef?.current) roRef.current.disconnect();
    };
  }, [wrapRef]);

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
        // KUNCI: batasi lebar wrapper secara responsif (dipakai Game.jsx untuk hitung 9:16)
        maxWidth: `${maxW}px`,
        // Jangan potong kanvas/glow
        overflow: "visible",
      }}
    >
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
        }}
      />
    </div>
  );
}
