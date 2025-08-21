// client/src/components/GameCanvas.jsx
import React from "react";

/**
 * Kanvas pembungkus:
 * - 9:16 dihitung di Game.jsx (file ini gak ubah format/UI)
 * - Tambah minHeight agar tidak kolaps di mobile first paint
 * - Swipe mulus: touchAction: 'none'
 */
export default function GameCanvas({ wrapRef, canvasRef, className = "" }) {
  return (
    <div
      ref={wrapRef}
      className={
        `mx-auto w-full max-w-[1040px]
         rounded-2xl border border-white/10 bg-black/20 p-3
         shadow-[0_0_80px_rgba(0,0,0,0.25)]
         overflow-hidden flex items-center justify-center ${className}`
      }
      style={{ marginLeft: "auto", marginRight: "auto", minHeight: "420px" }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          minHeight: "392px",
          borderRadius: 12,
          touchAction: "none",
        }}
      />
    </div>
  );
}
