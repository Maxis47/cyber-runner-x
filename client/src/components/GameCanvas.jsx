import React from "react";

/**
 * Kanvas pembungkus:
 * - 9:16 (portrait) dihitung di Game.jsx
 * - Selalu di TENGAH (mx-auto) terlepas dari grid parent
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
         flex items-center justify-center ${className}`
      }
      style={{
        marginLeft: "auto",
        marginRight: "auto",
        // kunci tinggi container terhadap vh beku → tidak "zoomed" saat scroll
        height: "auto",
        maxHeight: "calc(var(--app-vh, 100svh) - 24px)",
        touchAction: "manipulation",
        overscrollBehavior: "contain",
      }}
    >
      <canvas
        ref={canvasRef}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
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
