// client/src/components/Game.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import OnchainStatus from "./OnchainStatus";
import GameCanvas from "./GameCanvas";
import { submitScore as apiSubmitScore, getTxStatus } from "../lib/api";

/** ======================
 * THEMES
 * ====================== */
const THEMES = {
  neon: {
    name: "neon",
    bgA: "#0B0B12",
    bgB: "#1a1430",
    grid: "rgba(167,155,255,0.12)",
    player: "#00F0FF",
    playerGlow: "#39F3FF",
    obstacle: "#FF3B57",
    obstacleGlow: "#FF7A8A",
    power: "#B388FF",
    powerGlow: "#D5C2FF",
    hud: "#D6D4FF",
    vignette: "rgba(0,0,0,0.35)",
    speedline: "rgba(147,112,219,0.18)",
  },
  dark: {
    name: "dark",
    bgA: "#0F1116",
    bgB: "#1B1F2A",
    grid: "rgba(255,255,255,0.07)",
    player: "#E2E8F0",
    playerGlow: "#A7B8D4",
    obstacle: "#F87171",
    obstacleGlow: "#FCA5A5",
    power: "#A78BFA",
    powerGlow: "#C4B5FD",
    hud: "#E5E7EB",
    vignette: "rgba(0,0,0,0.28)",
    speedline: "rgba(148,163,184,0.14)",
  },
  light: {
    name: "light",
    bgA: "#F8FAFC",
    bgB: "#E9EEF6",
    grid: "rgba(2,6,23,0.09)",
    player: "#0F172A",
    playerGlow: "#64748B",
    obstacle: "#DC2626",
    obstacleGlow: "#F87171",
    power: "#6D28D9",
    powerGlow: "#A78BFA",
    hud: "#0F172A",
    vignette: "rgba(0,0,0,0.10)",
    speedline: "rgba(2,6,23,0.12)",
  },
};

/** ======================
 * MODES (easy/medium/hard)
 * ====================== */
const MODES = {
  // Perbedaan mode dibuat sangat jelas:
  // - spawnMs: interval spawn (lebih kecil = lebih sering)
  // - accel: percepatan jatuh
  // - speedMul: multiplier ke base speed
  // - pickChance: peluang muncul pickup
  // - obsSizeMul: skala ukuran obstacle (semakin kecil = lebih susah dodge)
  // - rotMul: putaran obstacle
  // - patternChance: peluang spawn pola premium (double/triple, zigzag)
  easy:   { speed: 0.75, spawnMs: 1300, accel: 0.00014, speedMul: 0.85, pickChance: 0.45, obsSizeMul: 1.0,  rotMul: 0.8,  patternChance: 0.08 },
  medium: { speed: 1.00, spawnMs:  820, accel: 0.00026, speedMul: 1.00, pickChance: 0.28, obsSizeMul: 0.85, rotMul: 1.2,  patternChance: 0.18 },
  hard:   { speed: 1.65, spawnMs:  480, accel: 0.00046, speedMul: 1.25, pickChance: 0.16, obsSizeMul: 0.70, rotMul: 1.8,  patternChance: 0.32 },
};

/** utils */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

/** ——— smaller & accurate distance ——— */
const DISTANCE_SCALE = 24; // angka meter jadi lebih kecil & stabil
const DEFAULT_EXPLORER_BASE = "https://testnet.monadexplorer.com/tx/";

export default function Game({
  onDistanceChange,
  submitScore,                 // kompat: async ({ distance }) => ({ hash|tx|txHash, explorerUrl })
  defaultTheme = "neon",
  defaultMode = "medium",
  identity,                    // { address, username } — opsional, pola temanmu
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  // UI
  const [themeName, setThemeName] = useState(() => localStorage.getItem("crx_theme") || defaultTheme);
  const [modeName, setModeName]   = useState(() => localStorage.getItem("crx_mode")  || defaultMode);
  const [paused, setPaused]       = useState(false);
  const [distance, setDistance]   = useState(0);
  const distanceRef = useRef(0);
  useEffect(() => { distanceRef.current = distance; }, [distance]);

  // on-chain panel
  const [chainState, setChainState] = useState({
    stage: "idle", hash: "", nonce: "", block: "", confirmations: 0, gasUsed: "", explorerUrl: "", error: "",
  });

  const theme   = useMemo(() => THEMES[themeName] || THEMES.neon,   [themeName]);
  const modeCfg = useMemo(() => MODES[modeName]   || MODES.medium,  [modeName]);

  // WORLD
  const W = useRef({
    tLast: 0,
    fall: 0.32,                     // base vertical factor
    lanes: 5,
    laneX: [],
    player: { lane: 2, size: 36, x: 0, y: 0, targetX: null }, // size sedikit lebih kecil
    obstacles: [],
    pickups: [],
    particles: [],
    rings: [],
    spawnT: 0,
    grid: 56,
    alive: true,
    dpr: 1,
    shake: { mag: 0, decay: 0.92 },
    flash: 0,
    vignettePulse: 0,
    speedlines: [],
    dist: 0,                        // sumber kebenaran jarak (meter)
    stars: [],                      // parallax starfield premium
    glowBursts: [],                 // efek burst kecil
  });

  // cegah double submit & polling timer
  const submittedRef = useRef(false);
  const pollTimer = useRef(null);

  /** ===== Resize: 9:16 dan center ===== */
  const resize = () => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;

    // DPR: batasi di layar kecil agar ringan & anti "zoomed"
    const isSmall = (window.innerWidth || 360) <= 480;
    const dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2);
    W.current.dpr = dpr;

    // Tinggi viewport stabil (address bar mobile)
    const visualH = (window.visualViewport && window.visualViewport.height) || 0;
    const viewportH = visualH || window.innerHeight || document.documentElement.clientHeight || 800;

    const rect = wrap.getBoundingClientRect ? wrap.getBoundingClientRect() : { top: 0, height: wrap.clientHeight };
    const availH = Math.max(300, (viewportH - rect.top - 24)); // 24px margin bawah
    const maxW = wrap.clientWidth || 360;

    let cssW = Math.floor(Math.min(maxW, (availH * 9) / 16));
    let cssH = Math.floor((cssW * 16) / 9);
    if (cssH > availH) {
      cssH = Math.floor(availH);
      cssW = Math.floor((cssH * 9) / 16);
    }
    cssW = Math.max(220, cssW);
    cssH = Math.max(392, cssH);

    c.width = Math.floor(cssW * dpr);
    c.height = Math.floor(cssH * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${cssH}px`;

    // lane X positions
    const n = W.current.lanes;
    const arr = [];
    for (let i = 0; i < n; i++) {
      arr.push(Math.floor(c.width * (0.12 + (i * 0.76) / (n - 1))));
    }
    W.current.laneX = arr;
    W.current.player.y = Math.floor(c.height * 0.78);
    if (W.current.player.targetX == null) {
      W.current.player.x = arr[W.current.player.lane] || Math.floor(c.width * 0.5);
    }

    // regenerate parallax stars relative to size
    const stars = [];
    const count = Math.floor((cssW * cssH) / 16000); // density
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        r: rnd(0.6, 1.8) * dpr,
        a: rnd(0.2, 0.75),
        z: rnd(0.5, 1.75), // parallax factor
      });
    }
    W.current.stars = stars;
  };

  useEffect(() => {
    // throttle ke animation frame supaya tidak "lompat"
    let alive = true;
    const schedule = (() => {
      let ticking = false;
      return () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          if (!alive) return;
          ticking = false;
          resize();
        });
      };
    })();

    schedule(); // initial

    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("orientationchange", schedule, { passive: true });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", schedule, { passive: true });
    }

    let ro;
    if ("ResizeObserver" in window && wrapRef.current) {
      ro = new ResizeObserver(() => schedule());
      ro.observe(wrapRef.current);
    }

    return () => {
      alive = false;
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", schedule);
      if (ro && wrapRef.current) ro.unobserve(wrapRef.current);
    };
  }, []);

  /** ===== Controls ===== */
  const moveLane = (d) => {
    const w = W.current;
    w.player.lane = clamp(w.player.lane + d, 0, w.lanes - 1);
    w.player.targetX = null; // keyboard snap ke lane center (tetap lerp halus)
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "arrowleft")  moveLane(-1);
      if (k === "arrowright") moveLane(1);
      if (k === "p") setPaused((p) => !p);
      if (k === "r") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pointer Events → swipe/drag analog SANGAT MULUS (tanpa langkah)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    const toX = (clientX) => {
      const rect = c.getBoundingClientRect();
      return (clientX - rect.left) * (c.width / rect.width);
    };

    let dragging = false;

    const down = (e) => {
      dragging = true;
      c.setPointerCapture?.(e.pointerId);
      const x = toX(e.clientX);
      W.current.player.targetX = clamp(x, c.width * 0.08, c.width * 0.92);
    };
    const move = (e) => {
      if (!dragging) return;
      const x = toX(e.clientX);
      W.current.player.targetX = clamp(x, c.width * 0.08, c.width * 0.92);
    };
    const up = (e) => {
      dragging = false;
      c.releasePointerCapture?.(e.pointerId);
      // snap mulus ke lane terdekat
      const w = W.current;
      const nearest = w.laneX.reduce((best, lx, i) => {
        const d = Math.abs((w.player.x || lx) - lx);
        return d < best.d ? { i, d } : best;
      }, { i: w.player.lane, d: 1e9 }).i;
      w.player.lane = nearest;
      w.player.targetX = null;
    };

    c.addEventListener("pointerdown", down);
    c.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    return () => {
      c.removeEventListener("pointerdown", down);
      c.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  /** ===== Poll tx status (API kamu atau window.getTxStatus) ===== */
  const startPollingTx = (hash, explorerUrl) => {
    if (!hash) {
      setChainState((s) => ({ ...s, stage: "idle" }));
      return;
    }
    if (pollTimer.current) clearTimeout(pollTimer.current);

    const baseExplorer = DEFAULT_EXPLORER_BASE;
    const initialExplorer = explorerUrl || `${baseExplorer}${hash}`;

    const poll = async () => {
      try {
        const src = (typeof window !== "undefined" && typeof window.getTxStatus === "function")
          ? window.getTxStatus
          : getTxStatus;
        const info = await src(hash);
        setChainState((s) => ({
          ...s,
          stage: info?.stage || s.stage || "pending",
          hash: info?.hash || hash || s.hash,
          nonce: info?.nonce ?? s.nonce,
          block: info?.blockNumber ?? s.block,
          confirmations: info?.confirmations ?? s.confirmations,
          gasUsed: info?.gasUsed ?? s.gasUsed,
          explorerUrl: info?.explorerUrl || s.explorerUrl || `${baseExplorer}${hash}`,
          error: info?.error || "",
        }));
        if (info?.stage === "mined" || info?.stage === "error") {
          pollTimer.current = null;
          return;
        }
      } catch {
        // keep polling
      }
      pollTimer.current = setTimeout(poll, 1500);
    };

    setChainState((s) => ({ ...s, stage: "pending", hash, explorerUrl: initialExplorer }));
    poll();
  };

  /** ===== Submit on-chain ===== */
  const submitOnchainNow = async (score) => {
    if (submittedRef.current) return;  // cegah double submit per run
    submittedRef.current = true;

    try {
      // 1) Prop submitScore (kompat)
      if (typeof submitScore === "function") {
        const tx = await submitScore({ distance: score });
        const hash = tx?.hash || tx?.tx || tx?.txHash || (typeof tx === "string" ? tx : "");
        const ex = tx?.explorerUrl || (hash ? `${DEFAULT_EXPLORER_BASE}${hash}` : "");
        startPollingTx(hash, ex);
        return;
      }

      // 2) identity → API resmi kamu
      if (identity?.address) {
        setChainState((s) => ({ ...s, stage: "pending", error: "" }));
        const res = await apiSubmitScore({
          player: identity.address,
          username: identity.username || "guest",
          score,
        });
        const hash = res?.tx || res?.hash || res?.txHash || "";
        const ex = res?.explorerUrl || (hash ? `${DEFAULT_EXPLORER_BASE}${hash}` : "");
        startPollingTx(hash, ex);
        return;
      }

      // 3) Fallback window.*
      if (typeof window !== "undefined" && typeof window.submitScore === "function") {
        setChainState((s) => ({ ...s, stage: "pending", error: "" }));
        const tx = await window.submitScore({ distance: score });
        const hash = tx?.hash || tx?.tx || tx?.txHash || (typeof tx === "string" ? tx : "");
        const ex = tx?.explorerUrl || (hash ? `${DEFAULT_EXPLORER_BASE}${hash}` : "");
        startPollingTx(hash, ex);
        return;
      }

      // 4) Tidak ada mekanisme → idle (tanpa error)
      setChainState((s) => ({ ...s, stage: "idle" }));
    } catch (err) {
      setChainState({
        stage: "error",
        hash: "",
        nonce: "",
        block: "",
        confirmations: 0,
        gasUsed: "",
        explorerUrl: "",
        error: String(err?.message || err),
      });
    }
  };

  /** ===== Restart ===== */
  const restart = () => {
    const c = canvasRef.current; if (!c) return;

    // Submit juga saat restart, berapapun skor
    const last = Math.floor(distanceRef.current);
    submitOnchainNow(last);

    // reset world
    const w = W.current;
    w.obstacles = [];
    w.pickups = [];
    w.particles = [];
    w.rings = [];
    w.speedlines = [];
    w.spawnT = 0;
    w.tLast = performance.now();
    w.fall = 0.32 * (MODES[modeName]?.speed || 1) * (modeCfg.speedMul || 1);
    w.alive = true;
    w.shake.mag = 0;
    w.flash = 0;
    w.player.lane = Math.floor(w.lanes / 2);
    w.player.x = w.laneX[w.player.lane] || Math.floor(c.width * 0.5);
    w.player.targetX = null;
    w.dist = 0;

    setDistance(0);
    setPaused(false);
    setChainState((s) => ({ ...s, stage: "idle" }));
    submittedRef.current = false;

    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  };

  useEffect(() => { localStorage.setItem("crx_theme", themeName); }, [themeName]);
  useEffect(() => { localStorage.setItem("crx_mode",  modeName ); restart(); }, [modeName]);

  /** ===== Draw helpers ===== */
  const rounded = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const drawStarfield = (ctx, dt) => {
    const w = W.current;
    const drift = (w.fall * 0.06) * (dt / 16.6667);
    for (const s of w.stars) {
      s.y += drift * s.z;
      if (s.y > ctx.canvas.height + 6 * w.dpr) {
        s.y = -6 * w.dpr;
        s.x = Math.random() * ctx.canvas.width;
      }
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = theme.grid;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const drawBG = (ctx, t) => {
    const { width, height } = ctx.canvas;
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, theme.bgA);
    g.addColorStop(1, theme.bgB);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    const w = W.current;
    w.vignettePulse = (Math.sin(t * 0.004) + 1) * 0.5;
    const r = Math.hypot(width, height) * (0.55 + 0.05 * w.vignettePulse);
    const vg = ctx.createRadialGradient(width * 0.5, height * 0.42, r * 0.2, width * 0.5, height * 0.42, r);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, theme.vignette);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);
  };

  const drawGrid = (ctx) => {
    const g = W.current.grid * W.current.dpr;
    ctx.save();
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < ctx.canvas.width; x += g) {
      ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, ctx.canvas.height); ctx.stroke();
    }
    for (let y = 0; y < ctx.canvas.height; y += g) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(ctx.canvas.width, y + 0.5); ctx.stroke();
    }
    ctx.restore();
  };

  const drawPlayer = (ctx) => {
    const w = W.current;
    const laneX = w.laneX[w.player.lane] || Math.floor(ctx.canvas.width * 0.5);
    const desiredX = w.player.targetX != null ? w.player.targetX : laneX;

    // super smooth (tanpa langkah): lerp kuat
    w.player.x = (w.player.x ?? desiredX) + (desiredX - (w.player.x ?? desiredX)) * 0.33;

    const base = (w.player.size * ctx.canvas.height) / (900 * (1 / w.dpr));
    const size = Math.max(24 * w.dpr, Math.floor(base)); // lebih kecil & gesit
    const x = w.player.x, y = w.player.y;

    if (!paused && w.alive) {
      // trail yang lebih premium (dua layer)
      w.particles.push({ x, y, r: size * 0.24, life: 1, vx: rnd(-0.04, 0.04) * w.dpr, vy: 0.16 * w.dpr, c: theme.playerGlow });
      w.particles.push({ x, y, r: size * 0.16, life: 1, vx: rnd(-0.03, 0.03) * w.dpr, vy: 0.22 * w.dpr, c: theme.player });
    }

    // glow burst halus
    if (Math.random() < 0.04 && !paused && w.alive) {
      w.glowBursts.push({ x, y, r: size * rnd(0.8, 1.2), life: 1.0 });
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.05);

    // edge highlight
    const grad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    grad.addColorStop(0, theme.player);
    grad.addColorStop(1, theme.playerGlow);

    ctx.shadowColor = theme.playerGlow; ctx.shadowBlur = 22 * w.dpr;
    ctx.fillStyle = grad;
    rounded(ctx, -size / 2, -size / 2, size, size, 10 * w.dpr);
    ctx.fill();

    // inner shine
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = theme.playerGlow;
    rounded(ctx, -size / 2 + 6 * w.dpr, -size / 2 + 6 * w.dpr, size - 12 * w.dpr, size - 12 * w.dpr, 8 * w.dpr);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  const drawParticles = (ctx, dt) => {
    const ps = W.current.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= (dt / 1000) * 1.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life)) * 0.6;
      ctx.fillStyle = p.c || theme.playerGlow;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // glow bursts
    const bs = W.current.glowBursts;
    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      b.life -= (dt / 1000) * 0.9;
      if (b.life <= 0) { bs.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.life) * 0.45;
      ctx.strokeStyle = theme.playerGlow;
      ctx.lineWidth = 2 * W.current.dpr;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1.6 - b.life * 0.6), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  };

  /** ===== Obstacles: kecil, variatif, premium ===== */
  const spawnSingleObstacle = (lane, base, speedMul, rotMul) => {
    const w = W.current;
    const sizeMul = (MODES[modeName]?.obsSizeMul || 1);
    const ow = Math.floor(rnd(18, 44) * base * sizeMul); // objek lebih kecil
    const oh = Math.floor(rnd(18, 44) * base * sizeMul);
    const x = w.laneX[lane] || Math.floor(canvasRef.current.width * 0.5);
    const y = -oh - 30 * w.dpr;

    const types = ["rect", "diamond", "pill", "triangle", "ring", "hex", "shard", "bolt", "star"];
    const type = types[Math.floor(Math.random() * types.length)];

    const o = {
      type, x, y, w: ow, h: oh, lane,
      vy: w.fall * rnd(11.2, 14.5) * w.dpr * speedMul,
      rot: rnd(-0.2, 0.2),
      vr: rnd(-0.003, 0.003) * rotMul,
      sway: Math.random() < 0.25 ? rnd(4, 10) * w.dpr : 0, // sedikit zigzag
      swayT: Math.random() * Math.PI * 2,
      pulse: Math.random() < 0.35, // pulsating size
    };
    w.obstacles.push(o);
  };

  const spawnPattern = () => {
    const w = W.current;
    const base = (canvasRef.current.height / 900) * w.dpr;
    const speedMul = modeCfg.speedMul || 1;
    const rotMul = modeCfg.rotMul || 1;

    const patternRoll = Math.random();
    if (patternRoll < 0.34) {
      // double adjacent
      const lane = Math.floor(Math.random() * (w.lanes - 1));
      spawnSingleObstacle(lane, base, speedMul, rotMul);
      spawnSingleObstacle(lane + 1, base, speedMul, rotMul);
    } else if (patternRoll < 0.67) {
      // triple alternating
      const lane = Math.floor(Math.random() * (w.lanes - 2));
      spawnSingleObstacle(lane, base, speedMul, rotMul);
      spawnSingleObstacle(lane + 2, base, speedMul, rotMul);
      spawnSingleObstacle(lane + 1, base, speedMul, rotMul);
    } else {
      // rain (zigzag vertical)
      const lane = Math.floor(Math.random() * w.lanes);
      for (let i = 0; i < 3; i++) {
        spawnSingleObstacle((lane + i) % w.lanes, base, speedMul * 1.05, rotMul * 1.1);
      }
    }
  };

  const spawnObstacle = () => {
    const w = W.current;
    const base = (canvasRef.current.height / 900) * w.dpr;
    const speedMul = modeCfg.speedMul || 1;
    const rotMul = modeCfg.rotMul || 1;

    if (Math.random() < (modeCfg.patternChance || 0)) {
      spawnPattern();
    } else {
      const lane = Math.floor(Math.random() * w.lanes);
      spawnSingleObstacle(lane, base, speedMul, rotMul);
    }

    // pickups lebih dermawan di easy
    if (Math.random() < (modeCfg.pickChance || 0.25)) {
      const lane = Math.floor(Math.random() * w.lanes);
      const x = w.laneX[lane] || Math.floor(canvasRef.current.width * 0.5);
      const y = -rnd(60, 140) * w.dpr;
      w.pickups.push({
        x: x + rnd(-32, 32) * w.dpr,
        y,
        r: rnd(10, 16) * w.dpr,
        vy: w.fall * 10.5 * w.dpr * speedMul,
      });
    }
  };

  const drawObstacles = (ctx, dt) => {
    const w = W.current;
    for (let i = w.obstacles.length - 1; i >= 0; i--) {
      const o = w.obstacles[i];
      o.y += o.vy * (dt / 16.6667);
      o.rot += o.vr * dt;
      if (o.sway) {
        o.swayT += 0.0035 * dt;
        o.x += Math.sin(o.swayT) * 0.6; // sway halus
      }

      // pulsating
      const pulseScale = o.pulse ? (1 + Math.sin(o.swayT * 1.8) * 0.08) : 1;

      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);

      ctx.shadowColor = theme.obstacleGlow; ctx.shadowBlur = 20 * w.dpr;
      ctx.fillStyle = theme.obstacle;

      const drawHex = (size) => {
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (Math.PI / 3) * a;
          const px = Math.cos(ang) * size, py = Math.sin(ang) * size;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      };

      const drawShard = (ow, oh) => {
        ctx.beginPath();
        ctx.moveTo(-ow * 0.4, -oh * 0.5);
        ctx.lineTo(ow * 0.5, -oh * 0.2);
        ctx.lineTo(ow * 0.2, oh * 0.5);
        ctx.lineTo(-ow * 0.5, oh * 0.1);
        ctx.closePath(); ctx.fill();
      };

      const drawBolt = (ow, oh) => {
        ctx.beginPath();
        ctx.moveTo(-ow * 0.3, -oh * 0.5);
        ctx.lineTo(ow * 0.1, -oh * 0.1);
        ctx.lineTo(-ow * 0.05, -oh * 0.1);
        ctx.lineTo(ow * 0.3, oh * 0.5);
        ctx.lineTo(-ow * 0.1, oh * 0.1);
        ctx.lineTo(ow * 0.05, oh * 0.1);
        ctx.closePath(); ctx.fill();
      };

      const drawStar = (size) => {
        const spikes = 5;
        const outer = size, inner = size * 0.45;
        let rot = Math.PI / 2 * 3;
        let x = 0, y = 0;
        ctx.beginPath();
        ctx.moveTo(0, -outer);
        for (let ii = 0; ii < spikes; ii++) {
          x = Math.cos(rot) * outer; y = Math.sin(rot) * outer; ctx.lineTo(x, y); rot += Math.PI / spikes;
          x = Math.cos(rot) * inner; y = Math.sin(rot) * inner; ctx.lineTo(x, y); rot += Math.PI / spikes;
        }
        ctx.lineTo(0, -outer);
        ctx.closePath();
        ctx.fill();
      };

      const ow = o.w * pulseScale;
      const oh = o.h * pulseScale;

      switch (o.type) {
        case "diamond": {
          const hw = ow / 2, hh = oh / 2;
          ctx.beginPath();
          ctx.moveTo(0, -hh); ctx.lineTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(-hw, 0);
          ctx.closePath(); ctx.fill();
          break;
        }
        case "pill": {
          const r = Math.min(ow, oh) * 0.45;
          rounded(ctx, -ow / 2, -oh / 2, ow, oh, r); ctx.fill();
          break;
        }
        case "triangle": {
          const hw = ow / 2, hh = oh / 2;
          ctx.beginPath();
          ctx.moveTo(0, -hh); ctx.lineTo(hw, hh); ctx.lineTo(-hw, hh);
          ctx.closePath(); ctx.fill();
          break;
        }
        case "ring": {
          const rIn = Math.min(ow, oh) * 0.25;
          const rOut = Math.min(ow, oh) * 0.48;
          ctx.lineWidth = (rOut - rIn) * 0.9;
          ctx.strokeStyle = theme.obstacle;
          ctx.beginPath(); ctx.arc(0, 0, (rIn + rOut) / 2, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case "hex": {
          drawHex(Math.min(ow, oh) * 0.48);
          break;
        }
        case "shard": {
          drawShard(ow, oh);
          break;
        }
        case "bolt": {
          drawBolt(ow, oh);
          break;
        }
        case "star": {
          drawStar(Math.min(ow, oh) * 0.48);
          break;
        }
        default: {
          rounded(ctx, -ow / 2, -oh / 2, ow, oh, 10 * w.dpr); ctx.fill();
        }
      }

      // premium outline glow
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = theme.obstacleGlow;
      ctx.lineWidth = 2 * w.dpr;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();

      if (o.y - oh / 2 > ctx.canvas.height + 90 * w.dpr) w.obstacles.splice(i, 1);
    }

    // power-up rings
    for (let i = w.pickups.length - 1; i >= 0; i--) {
      const p = w.pickups[i];
      p.y += p.vy * (dt / 16.6667);
      ctx.save();
      ctx.shadowColor = theme.powerGlow; ctx.shadowBlur = 22 * w.dpr;
      ctx.strokeStyle = theme.power; ctx.lineWidth = 4 * w.dpr;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (p.y - p.r > ctx.canvas.height + 70 * w.dpr) w.pickups.splice(i, 1);
    }
  };

  // efek ring (pickup)
  const drawRings = (ctx, dt) => {
    const rings = W.current.rings;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt * 0.0012;
      r.radius += dt * 0.22 * W.current.dpr;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.life) * 0.6;
      ctx.strokeStyle = theme.power;
      ctx.lineWidth = 3 * W.current.dpr;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  };

  // speedlines
  const drawSpeedlines = (ctx, dt) => {
    const w = W.current;
    const want = Math.min(28, Math.floor(w.fall * 1.4)); // sedikit lebih padat
    while (w.speedlines.length < want) {
      w.speedlines.push({
        x: rnd(0, ctx.canvas.width), y: rnd(-ctx.canvas.height, 0),
        len: rnd(36, 120) * w.dpr, vy: (w.fall * rnd(12, 22)) * w.dpr * (modeCfg.speedMul || 1), alpha: rnd(0.05, 0.22)
      });
    }
    for (let i = w.speedlines.length - 1; i >= 0; i--) {
      const s = w.speedlines[i];
      s.y += s.vy * (dt / 16.6667);
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = theme.speedline;
      ctx.lineWidth = 2 * w.dpr;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x, s.y + s.len); ctx.stroke();
      ctx.restore();
      if (s.y > ctx.canvas.height + 20 * w.dpr) w.speedlines.splice(i, 1);
    }
  };

  // score boost 2s setelah pickup
  const scoreBoostRef = useRef(0);

  const collide = (ctx) => {
    const w = W.current;
    const size = Math.max(24 * w.dpr, Math.floor((w.player.size * ctx.canvas.height) / (900 * (1 / w.dpr))));
    const px = w.player.x, py = w.player.y, pr = size * 0.5;

    // obstacles
    for (const o of w.obstacles) {
      const cx = clamp(px, o.x - o.w / 2, o.x + o.w / 2);
      const cy = clamp(py, o.y - o.h / 2, o.y + o.h / 2);
      const dx = px - cx, dy = py - cy;
      if (dx * dx + dy * dy < pr * pr) {
        w.alive = false;
        setPaused(true);
        w.shake.mag = 12 * w.dpr;
        w.flash = 0.6;

        // AUTO SUBMIT ON-CHAIN (selalu)
        const score = Math.floor(distanceRef.current);
        submitOnchainNow(score);

        break;
      }
    }

    // pickups
    for (let i = w.pickups.length - 1; i >= 0; i--) {
      const p = w.pickups[i];
      const dx = px - p.x, dy = py - p.y;
      if (dx * dx + dy * dy < (pr + p.r) * (pr + p.r)) {
        scoreBoostRef.current = performance.now();
        w.rings.push({ x: p.x, y: p.y, radius: p.r, life: 1 });

        // efek shock ring + mini burst
        w.glowBursts.push({ x: p.x, y: p.y, r: p.r * 1.6, life: 0.9 });

        w.pickups.splice(i, 1);
      }
    }
  };

  const drawHUD = (ctx) => {
    ctx.save();
    ctx.fillStyle = theme.hud;
    ctx.textBaseline = "top";

    const fontMain = Math.floor(ctx.canvas.height * 0.036);
    ctx.font = `${fontMain}px ui-sans-serif, system-ui`;
    ctx.fillText(`${Math.floor(distance)} m`, 14 * W.current.dpr, 12 * W.current.dpr);

    const tag = modeName.toUpperCase();
    const fontSmall = Math.floor(ctx.canvas.height * 0.03);
    ctx.font = `${fontSmall}px ui-sans-serif`;
    const w = ctx.measureText(tag).width + 20 * W.current.dpr;
    const x = ctx.canvas.width - w - 16 * W.current.dpr, y = 12 * W.current.dpr;
    ctx.globalAlpha = 0.22; ctx.fillRect(x, y, w, 28 * W.current.dpr); ctx.globalAlpha = 1;
    ctx.fillText(tag, x + 10 * W.current.dpr, y + 6 * W.current.dpr);

    const th = themeName.toUpperCase();
    const w2 = ctx.measureText(th).width + 20 * W.current.dpr;
    const y2 = y + 32 * W.current.dpr;
    ctx.globalAlpha = 0.18; ctx.fillRect(x, y2, w2, 24 * W.current.dpr); ctx.globalAlpha = 1;
    ctx.fillText(th, x + 10 * W.current.dpr, y2 + 4 * W.current.dpr);
    ctx.restore();
  };

  /** ===== LOOP ===== */
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    const w = W.current;

    w.tLast = performance.now();

    let raf = 0;
    const loop = (t) => {
      if (!w.tLast) w.tLast = t;
      const dt = t - w.tLast;
      w.tLast = t;

      if (!paused && w.alive) {
        w.fall += modeCfg.accel * dt;
        w.spawnT += dt;
        if (w.spawnT >= modeCfg.spawnMs) { w.spawnT = 0; spawnObstacle(); }

        // Jarak akurat & lebih kecil
        const boost = (t - scoreBoostRef.current) < 2000 ? 2 : 1;
        w.dist += ((w.fall * dt) / DISTANCE_SCALE) * boost;
        const uiDist = Math.floor(w.dist);
        if (uiDist !== distanceRef.current) {
          setDistance(uiDist);
          onDistanceChange?.(uiDist);
        }
      }

      // CAMERA SHAKE
      let shakeX = 0, shakeY = 0;
      if (w.shake.mag > 0.1) {
        shakeX = rnd(-w.shake.mag, w.shake.mag);
        shakeY = rnd(-w.shake.mag, w.shake.mag);
        w.shake.mag *= w.shake.decay;
      } else w.shake.mag = 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // render
      drawBG(ctx, t);
      drawStarfield(ctx, dt);
      drawGrid(ctx);
      drawSpeedlines(ctx, dt);
      drawObstacles(ctx, dt);
      drawPlayer(ctx);
      drawParticles(ctx, dt);
      drawRings(ctx, dt);
      drawHUD(ctx);

      ctx.restore();

      // flash saat crash
      if (w.flash > 0.01) {
        ctx.save();
        ctx.globalAlpha = w.flash;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.restore();
        w.flash *= 0.86;
      } else w.flash = 0;

      if (!paused && w.alive) collide(ctx);

      if (paused) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = theme.hud;
        ctx.textBaseline = "alphabetic";
        ctx.font = `${Math.floor(c.height * 0.042)}px ui-sans-serif`;
        const msg = w.alive ? "Paused — press P to resume" : "Game Over — press R to retry";
        const m = ctx.measureText(msg).width;
        ctx.fillText(msg, (c.width - m) / 2, c.height * 0.55);
        ctx.restore();
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeName, modeName, paused]);

  /** ===== Toolbar UI (format dipertahankan) ===== */
  const Toolbar = () => (
    <div className="flex flex-wrap items-center gap-3 mb-3">
      {/* Theme */}
      <div className="flex items-center gap-2">
        {["neon", "dark", "light"].map((t) => (
          <button
            key={t}
            onClick={() => setThemeName(t)}
            className={`px-3 py-1 rounded-full text-sm border ${
              themeName === t ? "border-white/60 bg-white/10" : "border-white/15 hover:bg-white/5"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {/* Mode */}
      <div className="flex items-center gap-2 ml-2">
        {["easy", "medium", "hard"].map((m) => (
          <button
            key={m}
            onClick={() => setModeName(m)}
            className={`px-3 py-1 rounded-full text-sm border ${
              modeName === m ? "border-white/60 bg-white/10" : "border-white/15 hover:bg-white/5"
            }`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {/* Pause/Restart */}
      <div className="flex items-center gap-2 ml-2">
        <button onClick={() => setPaused((p) => !p)} className="px-3 py-1 rounded-md text-sm border border-white/15 hover:bg-white/5">
          {paused ? "Resume" : "Pause"}
        </button>
        <button onClick={restart} className="px-3 py-1 rounded-md text-sm border border-white/15 hover:bg-white/5">
          Restart (R)
        </button>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <Toolbar />

      <GameCanvas canvasRef={canvasRef} wrapRef={wrapRef} />

      <div className="mt-3 text-xs opacity-80 flex items-center gap-6">
        <div><span className="opacity-60">Distance:</span> <b>{Math.floor(distance)} m</b></div>
        <div>Theme: {themeName}</div>
        <div>Mode: {modeName.toUpperCase()}</div>
        <div className="opacity-60">Tip: use ← → or swipe to switch lanes.</div>
      </div>

      {/* On-chain Panel */}
      <div className="mt-4">
        <OnchainStatus state={chainState} />
      </div>
    </div>
  );
}
