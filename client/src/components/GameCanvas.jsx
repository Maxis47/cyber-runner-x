// client/src/components/GameCanvas.jsx
import React from "react";

/**
 * Kanvas pembungkus:
 * - 9:16 (portrait) dihitung di Game.jsx
 * - Selalu di TENGAH (mx-auto) terlepas dari grid parent
 * - Swipe mulus: touchAction: 'none'
 * - Anti “loncat-loncat” di mobile: pakai svh, contain, overscrollBehavior
 */
export default function GameCanvas({ wrapRef, canvasRef, className = "" }) {
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
        // tetap center
        marginLeft: "auto",
        marginRight: "auto",
        // stabilkan tinggi di mobile (hindari address bar naik-turun)
        // gunakan safe viewport units (svh) + batas dvh
        maxHeight: "min(86svh, calc(100dvh - 96px))",
        // hindari relayout besar di container parent
        contain: "layout paint size",
        // cegah overscroll/bounce yang memicu perubahan tinggi viewport
        overscrollBehavior: "none",
        // cegah autoscale teks Safari yang kadang mengubah metrik layout
        WebkitTextSizeAdjust: "100%",
        textSizeAdjust: "100%",
        // sentuhan di wrapper tetap natural (scroll), interaksi kanvas diatur di <canvas>
        touchAction: "manipulation",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          // tinggi & width akhir tetap di-set oleh Game.jsx → di sini hanya guard
          maxHeight: "100%",
          borderRadius: 12,
          // semua gesture diserahkan ke game (drag/swipe mulus)
          touchAction: "none",
          // cegah long-press popup/context menu mengganggu swipe di mobile
          WebkitTapHighlightColor: "transparent",
          WebkitTouchCallout: "none",
          userSelect: "none",
        }}
        // cegah context menu (klik kanan / long-press) di mobile
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
