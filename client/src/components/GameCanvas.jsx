// client/src/components/GameCanvas.jsx
import React from "react";

/**
 * Pembungkus kanvas game agar:
 * - Rasio 9:16 stabil (tidak ikut naik-turun address bar)
 * - Canvas selalu mengisi parent (CSS handle ukuran; Game.jsx tidak perlu berubah)
 */
export default function GameCanvas({ canvasRef, wrapRef }) {
  return (
    <div ref={wrapRef} className="game-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
