"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "framer-motion";
import type { ParticleKind, Pointer } from "@/components/ParticleProduct";

/**
 * One particle field that morphs through a reel of products. Every product's
 * silhouette and colours are sampled once with the same particle count, so as
 * `position` moves from product k to k+1, particle i flies from its place in
 * one to its place in the next — dissolving outward mid-flight, re-forming,
 * blending colour, and switching between hair strands (tools) and mist (The
 * Numbers). A moving pointer blows them, like a hairdryer.
 */

interface Sampled {
  pts: Float32Array; // x,y per particle, 0-1 within the product's fitted box
  cols: Uint8Array; // r,g,b per particle
  aspect: number;
}

const SAMPLE_MAX = 220;
const INK = [27, 53, 119];
const WIND_RADIUS = 120;
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
  const cols = new Uint8Array(count * 3);
  for (let n = 0; n < count; n++) {
    const i = solid[Math.floor(Math.random() * solid.length)];
    pts[n * 2] = ((i % w) + Math.random()) / w;
    pts[n * 2 + 1] = (Math.floor(i / w) + Math.random()) / h;
    // Deepen toward the ink so particles read on the ivory paper.
    const deepen = Math.random() < 0.2 ? 0.45 : 0.15;
    for (let ch = 0; ch < 3; ch++) {
      const v = px[i * 4 + ch];
      cols[n * 3 + ch] = Math.round(v + (INK[ch] - v) * deepen);
    }
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
  position,
  pointer,
  count = 1200,
  pad = 0.3,
  className,
}: {
  srcs: string[];
  kinds: ParticleKind[];
  /** Float index into the reel: 2.5 is halfway from product 2 to product 3. */
  position: MotionValue<number>;
  pointer?: React.RefObject<Pointer | null>;
  count?: number;
  pad?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let reel: Sampled[] = [];
    let raf = 0;
    let visible = true;
    let cancelled = false;

    // Per-particle character, shared across every product.
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

    const box = (W: number, H: number, aspect: number) => {
      const iw = W / (1 + 2 * pad);
      const ih = H / (1 + 2 * pad);
      const bw = Math.min(iw, ih * aspect);
      const bh = bw / aspect;
      return { bx: (W - bw) / 2, by: (H - bh) / 2, bw, bh };
    };

    const draw = (time: number) => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);
      if (reel.length === 0) return;
      const n = reel.length;
      const s = Math.min(n - 1, Math.max(0, position.get()));
      const k = Math.min(Math.floor(s), Math.max(0, n - 2));
      const t = n === 1 ? 0 : s - k;
      const A = reel[k];
      const B = reel[Math.min(k + 1, n - 1)];
      const ba = box(W, H, A.aspect);
      const bb = box(W, H, B.aspect);
      const kind = kinds[t < 0.5 ? k : Math.min(k + 1, n - 1)];
      const sec = reduced ? 0 : time / 1000;

      let wx = 0;
      let wy = 0;
      let blowing = false;
      const ptr = pointer?.current;
      if (!reduced && ptr && time - ptr.t < WIND_FRESH_MS) {
        const r = canvas.getBoundingClientRect();
        wx = (ptr.x - r.left) * (W / r.width);
        wy = (ptr.y - r.top) * (H / r.height);
        blowing = true;
      }

      ctx.lineCap = "round";
      ctx.globalAlpha = 0.85;
      const spread = Math.min(W, H) * 0.32;
      for (let i = 0; i < count; i++) {
        // Each particle leaves in its own slice of the transition.
        const e = smooth(t * 1.35 - delay[i] * 0.35);
        const bulge = Math.sin(Math.PI * e);
        const axp = ba.bx + A.pts[i * 2] * ba.bw;
        const ayp = ba.by + A.pts[i * 2 + 1] * ba.bh;
        const bxp = bb.bx + B.pts[i * 2] * bb.bw;
        const byp = bb.by + B.pts[i * 2 + 1] * bb.bh;
        let x = axp + (bxp - axp) * e + dirX[i] * spread * bulge + Math.sin(sec * 0.8 + phase[i]) * 10 * bulge;
        let y = ayp + (byp - ayp) * e + dirY[i] * spread * bulge + Math.cos(sec * 0.7 + phase[i]) * 10 * bulge;

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

        const r = Math.round(A.cols[i * 3] + (B.cols[i * 3] - A.cols[i * 3]) * e);
        const g = Math.round(A.cols[i * 3 + 1] + (B.cols[i * 3 + 1] - A.cols[i * 3 + 1]) * e);
        const b = Math.round(A.cols[i * 3 + 2] + (B.cols[i * 3 + 2] - A.cols[i * 3 + 2]) * e);
        const color = `rgb(${r},${g},${b})`;

        if (kind === "strand") {
          const len = 8 + size[i] * 12;
          const a = Math.sin(x * 0.0045 + sec * 0.35) * 1.3 + Math.cos(y * 0.006 - sec * 0.28) - 0.4;
          const cx = Math.cos(a) * len * 0.5;
          const cy = Math.sin(a) * len * 0.5;
          const bend = curl[i] * len;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x - cx, y - cy);
          ctx.quadraticCurveTo(x - Math.sin(a) * bend, y + Math.cos(a) * bend, x + cx, y + cy);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, 1 + size[i] * 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (time: number) => {
      draw(time);
      if (visible && !reduced) raf = requestAnimationFrame(loop);
    };
    const kick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    const unsub = position.on("change", () => {
      if (reduced) draw(0);
    });

    Promise.all(srcs.map((s) => sampleTargets(s, count)))
      .then((res) => {
        if (cancelled) return;
        reel = res;
        resize();
        kick();
      })
      .catch((err) => console.warn(err));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      unsub();
    };
    // srcs/kinds are fixed for a reel; join them so a new array identity
    // with the same contents doesn't re-sample.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcs.join("|"), kinds.join("|"), count, pad, position, pointer]);

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
