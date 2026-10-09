"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "framer-motion";

/**
 * A product drawn as hundreds of particles sampled from its own pixels, so
 * each one carries the product's colour. Two kinds, chosen by what the
 * product is:
 *   strand — tools: short curved hair strands, combed by a drifting flow field
 *            (the airflow of a dryer) while loose, lying down as they settle.
 *   mist   — The Numbers: soft droplets that rise like spray, then condense.
 * `form` drives assembly (0 loose field → 1 exact silhouette). A moving
 * pointer pushes nearby particles away — the cursor is the hairdryer.
 *
 * The canvas is laid out like an object-contain <img> in the same box, so a
 * real image on top lines up with the assembled silhouette.
 */

export type ParticleKind = "strand" | "mist";
export interface Pointer {
  x: number; // client coords
  y: number;
  t: number; // performance.now() of the last move
}

interface Particle {
  tx: number; // target, 0-1 within the fitted image box
  ty: number;
  sx: number; // loose position, 0-1 within the canvas
  sy: number;
  delay: number; // 0-1: when this particle starts to settle
  phase: number;
  size: number;
  curl: number; // strand wave, as a fraction of its length
  settle: number; // strand angle once settled
  color: string;
  ox: number; // wind displacement (px) and its velocity
  oy: number;
  vx: number;
  vy: number;
}

const SAMPLE_MAX = 240; // px, longest side of the alpha sample
const INK = [27, 53, 119];
const WIND_RADIUS = 120; // px
const WIND_FRESH_MS = 160; // only a moving pointer blows

function mix(c: number[], t: number) {
  return c.map((v, i) => Math.round(v + (INK[i] - v) * t));
}

async function sample(src: string, count: number, kind: ParticleKind) {
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
  if (!ctx) throw new Error("ParticleProduct: no 2d context");
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const solid: number[] = [];
  for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] > 140) solid.push(i);
  if (solid.length === 0) throw new Error(`ParticleProduct: ${src} has no opaque pixels`);

  // Strands settle combed in one direction, like hair after a brush.
  const comb = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
  const particles: Particle[] = [];
  for (let n = 0; n < count; n++) {
    const i = solid[Math.floor(Math.random() * solid.length)];
    const x = i % w;
    const y = Math.floor(i / w);
    const rgb = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
    const r = Math.random();
    // On the ivory canvas both kinds deepen the product's colour a little so
    // they read against the light; the odd strand is darker, like a shadow.
    const color = kind === "mist" ? mix(rgb, r < 0.25 ? 0.4 : 0.22) : mix(rgb, r < 0.2 ? 0.45 : 0.12);
    particles.push({
      tx: (x + Math.random()) / w,
      ty: (y + Math.random()) / h,
      sx: Math.random() * 1.4 - 0.2,
      sy: Math.random() * 1.4 - 0.2,
      delay: Math.random(),
      phase: Math.random() * Math.PI * 2,
      size: kind === "mist" ? (r < 0.12 ? 3.2 : 1 + Math.random() * 1.6) : 10 + Math.random() * 14,
      curl: (Math.random() - 0.5) * 0.9,
      settle: comb + (Math.random() - 0.5) * 0.5,
      color: `rgb(${color.join(",")})`,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
    });
  }
  return { particles, aspect: w / h };
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The dryer's airflow: a slowly drifting angle field. */
function flow(x: number, y: number, t: number) {
  return Math.sin(x * 0.0045 + t * 0.35) * 1.3 + Math.cos(y * 0.006 - t * 0.28) * 1.0 - 0.4;
}

export default function ParticleProduct({
  src,
  form,
  kind = "strand",
  pointer,
  count = 1100,
  pad = 0,
  className,
}: {
  src: string;
  form: MotionValue<number>;
  kind?: ParticleKind;
  /** Live pointer position; particles near a moving pointer get blown away. */
  pointer?: React.RefObject<Pointer | null>;
  count?: number;
  /** How far the canvas extends past its box on every side, as a fraction
   *  of the box — room for the loose field. The silhouette fills the box. */
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

    let particles: Particle[] = [];
    let aspect = 1;
    let raf = 0;
    let visible = true;
    let cancelled = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Layout size, not getBoundingClientRect(): the canvas sits inside a
      // rotated/scaled wrapper, and the transformed box is larger — a bitmap
      // sized from it never gets fully cleared, leaving frozen particles.
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.clearRect(0, 0, W, H);
      const iw = W / (1 + 2 * pad);
      const ih = H / (1 + 2 * pad);
      const bw = Math.min(iw, ih * aspect);
      const bh = bw / aspect;
      const bx = (W - bw) / 2;
      const by = (H - bh) / 2;
      const f = form.get();
      const t = reduced ? 0 : time / 1000;

      // Pointer in canvas coordinates (approximate under small rotations).
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
      for (const p of particles) {
        const local = ease(f * 1.35 - p.delay * 0.35);
        const loose = 1 - local;
        let x = p.sx * W + (bx + p.tx * bw - p.sx * W) * local;
        let y = p.sy * H + (by + p.ty * bh - p.sy * H) * local;

        if (kind === "strand") {
          x += Math.sin(t * 0.7 + p.phase) * 16 * loose;
          y += Math.cos(t * 0.6 + p.phase) * 16 * loose;
        } else {
          // Spray: droplets rise and loop, with a little sideways drift.
          const rise = ((t * 22 + p.phase * 40) % 80) - 40;
          x += Math.sin(t * 0.9 + p.phase) * 10 * loose;
          y -= rise * loose;
        }

        // Wind: push away from a moving pointer, then spring back.
        if (blowing) {
          const dx = x + p.ox - wx;
          const dy = y + p.oy - wy;
          const d = Math.hypot(dx, dy);
          if (d < WIND_RADIUS && d > 0.01) {
            const k = Math.pow(1 - d / WIND_RADIUS, 2) * 5.5;
            p.vx += (dx / d) * k - (dy / d) * k * 0.35; // with a little swirl
            p.vy += (dy / d) * k + (dx / d) * k * 0.35;
          }
        }
        p.vx *= 0.86;
        p.vy *= 0.86;
        p.ox = (p.ox + p.vx) * 0.95;
        p.oy = (p.oy + p.vy) * 0.95;
        x += p.ox;
        y += p.oy;

        ctx.globalAlpha = 0.5 + 0.45 * local;
        if (kind === "strand") {
          const loseAngle = flow(x, y, t) + Math.sin(t * 1.1 + p.phase) * 0.25;
          const a = loseAngle + (p.settle - loseAngle) * local;
          const len = p.size * (1 - 0.55 * local);
          const cx = Math.cos(a) * len * 0.5;
          const cy = Math.sin(a) * len * 0.5;
          const bend = p.curl * len * (0.7 + 0.3 * Math.sin(t * 1.4 + p.phase));
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.3 - 0.3 * local;
          ctx.beginPath();
          ctx.moveTo(x - cx, y - cy);
          ctx.quadraticCurveTo(x - Math.sin(a) * bend, y + Math.cos(a) * bend, x + cx, y + cy);
          ctx.stroke();
        } else {
          const rad = p.size * (1 - 0.3 * local);
          if (p.size > 3) ctx.globalAlpha *= 0.45; // the odd larger, softer droplet
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
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
    // With reduced motion there's no loop, so redraw when `form` moves.
    const unsub = form.on("change", () => {
      if (reduced) draw(0);
    });

    sample(src, count, kind)
      .then((res) => {
        if (cancelled) return;
        particles = res.particles;
        aspect = res.aspect;
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
  }, [src, count, form, pad, kind, pointer]);

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
