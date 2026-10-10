"use client";

import { useEffect, useRef } from "react";
import type { ParticleKind, Pointer } from "@/components/ParticleProduct";

/**
 * One particle field that morphs between products in a reel. It is driven by
 * a target index, not by scroll position: when the target changes, every
 * particle flies from wherever it is *right now* to its place in the new
 * product, over a fixed duration. So a fast scroll past five products is one
 * clean morph to the last, and a change of mind mid-flight simply re-routes
 * the particles — nothing jumps, nothing replays.
 *
 * Tools travel as hair strands, The Numbers as mist; a moving pointer blows
 * them while they're in the air. The loop only runs during a morph.
 */

interface Sampled {
  pts: Float32Array; // x,y per particle, 0-1 within the product's fitted box
  cols: string[]; // CSS colour per particle (precomputed: no per-frame strings)
  aspect: number;
}

const SAMPLE_MAX = 220;
const INK = [27, 53, 119];
const WIND_RADIUS = 120;
// Velocity carried into a reroute decays over this (s) — no "brick wall"
// when a morph is interrupted (designs/SKILL.md §3).
const CARRY_TAU = 0.16;
const WIND_FRESH_MS = 160;

async function sampleTargets(src: string, count: number): Promise<Sampled> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const k = SAMPLE_MAX / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("ParticleReel: no 2d context");
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const solid: number[] = [];
  for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] > 140) solid.push(i);
  if (solid.length === 0) throw new Error(`ParticleReel: ${src} has no opaque pixels`);
  const pts = new Float32Array(count * 2);
  const cols: string[] = new Array(count);
  for (let n = 0; n < count; n++) {
    const i = solid[Math.floor(Math.random() * solid.length)];
    pts[n * 2] = ((i % w) + Math.random()) / w;
    pts[n * 2 + 1] = (Math.floor(i / w) + Math.random()) / h;
    // Deepen toward the ink so particles read on the ivory paper.
    const deepen = Math.random() < 0.2 ? 0.45 : 0.15;
    const rgb = [0, 1, 2].map((ch) => Math.round(px[i * 4 + ch] + (INK[ch] - px[i * 4 + ch]) * deepen));
    cols[n] = `rgb(${rgb.join(",")})`;
  }
  return { pts, cols, aspect: w / h };
}

const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

export default function ParticleReel({
  srcs,
  kinds,
  target,
  duration,
  pointer,
  count = 1100,
  pad = 0.3,
  className,
}: {
  srcs: string[];
  kinds: ParticleKind[];
  /** Index of the product the field should become. */
  target: number;
  /** Seconds per morph — keep in step with the image crossfade. */
  duration: number;
  pointer?: React.RefObject<Pointer | null>;
  count?: number;
  pad?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Lets the target effect reach into the running engine.
  const engine = useRef<{ retarget: (t: number) => void } | null>(null);
  const targetRef = useRef(target);
  // Read at each retarget, so a change of duration never rebuilds the field.
  const durationRef = useRef(duration);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let reel: Sampled[] = [];
    let raf = 0;
    let cancelled = false;

    // Morph state.
    let to = targetRef.current;
    let fromCols: string[] = [];
    let fromKind: ParticleKind = kinds[to];
    let t0 = 0;
    let dur = durationRef.current;
    const sx = new Float32Array(count); // start positions (px)
    const sy = new Float32Array(count);
    const cx = new Float32Array(count); // last drawn positions (px)
    const cy = new Float32Array(count);
    const pcx = new Float32Array(count); // the frame before, for velocity
    const pcy = new Float32Array(count);
    const v0x = new Float32Array(count); // velocity at the last retarget (px/s)
    const v0y = new Float32Array(count);
    let lastFrameAt = 0;
    let lastFrameDt = 16;
    let dirSign = 1; // +1 forward through the reel, -1 back
    const shown: string[] = new Array(count).fill("rgb(27,53,119)");

    // Per-particle character.
    const phase = new Float32Array(count);
    const size = new Float32Array(count);
    const curl = new Float32Array(count);
    const delay = new Float32Array(count);
    const dirX = new Float32Array(count);
    const dirY = new Float32Array(count);
    const ox = new Float32Array(count);
    const oy = new Float32Array(count);
    const vx = new Float32Array(count);
    const vy = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      phase[i] = Math.random() * Math.PI * 2;
      size[i] = Math.random();
      curl[i] = (Math.random() - 0.5) * 0.9;
      delay[i] = Math.random();
      const a = Math.random() * Math.PI * 2;
      const r = 0.4 + Math.random() * 0.6;
      dirX[i] = Math.cos(a) * r;
      dirY[i] = Math.sin(a) * r;
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const box = (aspect: number) => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      const iw = W / (1 + 2 * pad);
      const ih = H / (1 + 2 * pad);
      const bw = Math.min(iw, ih * aspect);
      const bh = bw / aspect;
      return { bx: (W - bw) / 2, by: (H - bh) / 2, bw, bh };
    };

    const draw = (now: number) => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);
      if (reel.length === 0) return false;
      const B = reel[to];
      const bb = box(B.aspect);
      const progress = reduced ? 1 : (now - t0) / (dur * 1000);
      const sec = now / 1000;
      const since = Math.max(0, (now - t0) / 1000);
      const carry = CARRY_TAU * (1 - Math.exp(-since / CARRY_TAU));
      if (lastFrameAt) lastFrameDt = Math.max(1, now - lastFrameAt);
      lastFrameAt = now;
      const spread = Math.min(W, H) * 0.3;

      let wx = 0;
      let wy = 0;
      let blowing = false;
      const ptr = pointer?.current;
      if (!reduced && ptr && now - ptr.t < WIND_FRESH_MS) {
        const r = canvas.getBoundingClientRect();
        wx = (ptr.x - r.left) * (W / r.width);
        wy = (ptr.y - r.top) * (H / r.height);
        blowing = true;
      }

      ctx.lineCap = "round";
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < count; i++) {
        // Each particle travels in its own slice of the morph.
        const e = smooth(progress * 1.3 - delay[i] * 0.3);
        const bulge = Math.sin(Math.PI * e);
        const tx = bb.bx + B.pts[i * 2] * bb.bw;
        const ty = bb.by + B.pts[i * 2 + 1] * bb.bh;
        // Hint the direction (SKILL.md §8): the cloud streams the way you're
        // scrolling — up when moving forward, down when going back.
        const lean = -dirSign * spread * 0.35 * bulge;
        // Carried velocity, fading out as the particle lands (§3).
        const keep = (1 - e) * carry;
        let x = sx[i] + (tx - sx[i]) * e + dirX[i] * spread * bulge + Math.sin(sec * 0.8 + phase[i]) * 8 * bulge + v0x[i] * keep;
        let y = sy[i] + (ty - sy[i]) * e + dirY[i] * spread * bulge + Math.cos(sec * 0.7 + phase[i]) * 8 * bulge + lean + v0y[i] * keep;
        pcx[i] = cx[i];
        pcy[i] = cy[i];
        cx[i] = x;
        cy[i] = y;

        if (blowing) {
          const dx = x + ox[i] - wx;
          const dy = y + oy[i] - wy;
          const d = Math.hypot(dx, dy);
          if (d < WIND_RADIUS && d > 0.01) {
            const f = Math.pow(1 - d / WIND_RADIUS, 2) * 5.5;
            vx[i] += (dx / d) * f - (dy / d) * f * 0.35;
            vy[i] += (dy / d) * f + (dx / d) * f * 0.35;
          }
        }
        vx[i] *= 0.86;
        vy[i] *= 0.86;
        ox[i] = (ox[i] + vx[i]) * 0.95;
        oy[i] = (oy[i] + vy[i]) * 0.95;
        x += ox[i];
        y += oy[i];

        const late = e >= 0.5;
        const color = late ? B.cols[i] : fromCols[i] ?? B.cols[i];
        shown[i] = color;
        const kind = late ? kinds[to] : fromKind;
        if (kind === "strand") {
          const len = 8 + size[i] * 12;
          const a = Math.sin(x * 0.0045 + sec * 0.35) * 1.3 + Math.cos(y * 0.006 - sec * 0.28) - 0.4;
          const hx = Math.cos(a) * len * 0.5;
          const hy = Math.sin(a) * len * 0.5;
          const bend = curl[i] * len;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x - hx, y - hy);
          ctx.quadraticCurveTo(x - Math.sin(a) * bend, y + Math.cos(a) * bend, x + hx, y + hy);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 1 + size[i] * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      return progress < 1.05 || blowing;
    };

    const loop = (now: number) => {
      if (draw(now)) raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    /** Start a morph from wherever the particles are now to product `t`. */
    const retarget = (t: number) => {
      if (reel.length === 0) {
        to = t;
        return;
      }
      // Start from the live on-screen positions, carrying their velocity.
      const running = performance.now() - t0 < dur * 1000;
      for (let i = 0; i < count; i++) {
        v0x[i] = running ? ((cx[i] - pcx[i]) / lastFrameDt) * 1000 : 0;
        v0y[i] = running ? ((cy[i] - pcy[i]) / lastFrameDt) * 1000 : 0;
      }
      sx.set(cx);
      sy.set(cy);
      fromCols = shown.slice();
      fromKind = kinds[to];
      dirSign = t >= to ? 1 : -1;
      to = t;
      dur = durationRef.current;
      t0 = performance.now();
      kick();
    };
    engine.current = { retarget };

    const ro = new ResizeObserver(() => {
      resize();
      // At rest, keep the remembered positions on the product at the new size.
      if (reel.length) {
        const bb = box(reel[to].aspect);
        for (let i = 0; i < count; i++) {
          cx[i] = bb.bx + reel[to].pts[i * 2] * bb.bw;
          cy[i] = bb.by + reel[to].pts[i * 2 + 1] * bb.bh;
        }
      }
    });
    ro.observe(canvas);

    Promise.all(srcs.map((s) => sampleTargets(s, count)))
      .then((res) => {
        if (cancelled) return;
        reel = res;
        resize();
        // Opening assembly: start scattered across the canvas.
        const W = canvas.clientWidth;
        const H = canvas.clientHeight;
        for (let i = 0; i < count; i++) {
          cx[i] = pcx[i] = Math.random() * W;
          cy[i] = pcy[i] = Math.random() * H;
          shown[i] = res[to].cols[i];
        }
        fromKind = kinds[to];
        const first = to;
        to = first;
        retarget(first);
      })
      .catch((err) => console.warn(err));

    return () => {
      cancelled = true;
      engine.current = null;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // The reel's contents are fixed for its lifetime; join to compare by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs.join("|"), kinds.join("|"), count, pad, pointer]);

  useEffect(() => {
    targetRef.current = target;
    durationRef.current = duration;
    engine.current?.retarget(target);
  }, [target, duration]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: `${-pad * 100}%`,
        width: `${100 + 200 * pad}%`,
        height: `${100 + 200 * pad}%`,
        pointerEvents: "none",
      }}
    />
  );
}
