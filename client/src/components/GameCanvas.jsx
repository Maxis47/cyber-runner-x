// client/src/components/GameCanvas.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * Kanvas pembungkus:
 * - 9:16 (portrait) dihitung di Game.jsx
 * - Selalu di TENGAH (mx-auto) terlepas dari grid parent
 * - Swipe mulus: touchAction: 'none'
 *
 * Penyesuaian ukuran (HANYA di sini):
 * - Di desktop/laptop, bila lebar kanvas terlalu kecil (kolom grid sempit),
 *   kanvas otomatis di-scale up (CSS transform) sampai target ~420–520px
 *   atau ~28vw (maks 1.6x). Mapping pointer tetap akurat karena
 *   Game.jsx menghitung koordinat via getBoundingClientRect().
 */
export default function GameCanvas({ wrapRef, canvasRef, className = "" }) {
  const [scale, setScale] = useState(1);
  const roRef = useRef(null);

  useEffect(() => {
    const canvasEl = canvasRef?.current;
    const wrapEl = wrapRef?.current;
    if (!canvasEl) return;

    const computeScale = () => {
      const rect = canvasEl.getBoundingClientRect();
      const vw = window.innerWidth || 0;

      // Default: tidak discale
      let next = 1;

      // Hanya perbesar di layar lebar
      if (vw >= 1024 && rect.width > 0) {
        // Target lebar visual: 28vw, dibatasi 420–520px
        const targetByVw = Math.round(vw * 0.28);
        const target = Math.max(420, Math.min(520, targetByVw));
        next = Math.max(1, Math.min(1.6, target / rect.width));
      }

      setScale(next);

      // Reserve ruang wrapper agar tidak overlap ketika discale
      if (wrapEl) {
        const scaledH = rect.height * next;
        // +16px buffer agar bayangan/outline tak terpotong
        wrapEl.style.minHeight = `${Math.ceil(scaledH) + 16}px`;
      }
    };

    // Observe perubahan ukuran canvas dari Game.jsx (resize dinamis)
    const ro = new ResizeObserver(() => computeScale());
    ro.observe(canvasEl);
    roRef.current = ro;

    // Recompute saat resize/orientasi
    window.addEventListener("resize", computeScale);
    window.addEventListener("orientationchange", computeScale);

    // run sekali saat mount
    computeScale();

    return () => {
      window.removeEventListener("resize", computeScale);
      window.removeEventListener("orientationchange", computeScale);
      if (roRef.current && canvasEl) roRef.current.disconnect();
    };
  }, [canvasRef, wrapRef]);

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
        // izinkan kanvas membesar keluar sedikit tanpa memotong
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
          // scale up khusus desktop (lihat useEffect)
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top center",
        }}
      />
    </div>
  );
}
