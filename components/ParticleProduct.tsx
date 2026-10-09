"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "framer-motion";

/**
 * The constellation: a product drawn as hundreds of tiny outlined triangles
 * (after the Dala reference), sampled from the cutout's own pixels so each
 * particle carries the product's colour. `form` drives it — 0 is a loose
 * ambient field, 1 is the exact silhouette. The canvas is laid out like an
 * object-contain <img> in the same box, so a real image on top lines up.
 */

interface Particle {
  tx: number; // target, 0-1 within the fitted image box
  ty: number;
  sx: number; // scattered position, 0-1 within the canvas
  sy: number;
  delay: number; // 0-1: when this particle starts to settle
  phase: number;
  size: number;
  spin: number;
  color: string;
}

const SAMPLE_MAX = 240; // px, longest side of the alpha sample
const CREAM: [number, number, number] = [255, 237, 215];
const EMBER = "rgb(220,80,0)";

function mix(c: number[], t: number) {
  return c.map((v, i) => Math.round(v + (CREAM[i] - v) * t));
}

async function sample(src: string, count: number): Promise<{ particles: Particle[]; aspect: number }> {
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

  const particles: Particle[] = [];
  for (let n = 0; n < count; n++) {
    const i = solid[Math.floor(Math.random() * solid.length)];
    const x = i % w;
    const y = Math.floor(i / w);
    const rgb = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
    const accent = Math.random();
    particles.push({
      tx: (x + Math.random()) / w,
      ty: (y + Math.random()) / h,
      sx: Math.random() * 1.4 - 0.2,
      sy: Math.random() * 1.4 - 0.2,
      delay: Math.random(),
      phase: Math.random() * Math.PI * 2,
      size: 1.6 + Math.random() * 2.2,
      spin: (Math.random() - 0.5) * 4,
      color:
        accent < 0.06
          ? EMBER
          : `rgb(${mix(rgb, accent < 0.2 ? 0.75 : 0.3).join(",")})`,
    });
  }
  return { particles, aspect: w / h };
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export default function ParticleProduct({
  src,
  form,
  count = 1100,
  pad = 0,
  className,
}: {
  src: string;
  form: MotionValue<number>;
  count?: number;
  /** How far the canvas extends past its box on every side, as a fraction
   *  of the box — room for the scattered field. The silhouette fills the box. */
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
      // object-contain box for the silhouette, inside the padded centre
      const iw = W / (1 + 2 * pad);
      const ih = H / (1 + 2 * pad);
      const bw = Math.min(iw, ih * aspect);
      const bh = bw / aspect;
      const bx = (W - bw) / 2;
      const by = (H - bh) / 2;
      const f = form.get();
      const t = reduced ? 0 : time / 1000;

      for (const p of particles) {
        // Each particle settles in its own slice of the 0→1 range.
        const local = ease((f * 1.35 - p.delay * 0.35) / 1);
        const drift = (1 - local) * 18;
        const x =
          p.sx * W + (bx + p.tx * bw - p.sx * W) * local + Math.sin(t * 0.7 + p.phase) * drift;
        const y =
          p.sy * H + (by + p.ty * bh - p.sy * H) * local + Math.cos(t * 0.6 + p.phase) * drift;
        const s = p.size * (1.15 - 0.45 * local);
        const a = p.phase + t * p.spin * (1 - local);
        ctx.globalAlpha = 0.25 + 0.7 * local;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        ctx.lineTo(x + Math.cos(a + 2.094) * s, y + Math.sin(a + 2.094) * s);
        ctx.lineTo(x + Math.cos(a + 4.189) * s, y + Math.sin(a + 4.189) * s);
        ctx.closePath();
        ctx.stroke();
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

    sample(src, count)
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
  }, [src, count, form, pad]);

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
