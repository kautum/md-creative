"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Botanical engravings in ink — trees, sprigs and a grove — drawn by code
 * from a seed, so each is natural-looking but identical on every visit.
 * When one scrolls into view it grows: the trunk draws first, then each
 * level of branches, then the leaves unfurl. Hairline strokes in the
 * current text colour (ink blue), after the fine line art on mdlondon's
 * own Numbers packaging.
 */

type Kind = "tree" | "sprig" | "grove";

interface Stroke {
  d: string;
  w: number; // px (non-scaling)
  delay: number; // s
  leaf: boolean;
}

const STEP = 0.2; // s between branch levels
const DRAW = 0.9; // s per stroke

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

function leafPath(x: number, y: number, a: number, len: number) {
  const tx = x + Math.cos(a) * len;
  const ty = y + Math.sin(a) * len;
  const c1x = x + Math.cos(a - 0.55) * len * 0.6;
  const c1y = y + Math.sin(a - 0.55) * len * 0.6;
  const c2x = x + Math.cos(a + 0.55) * len * 0.6;
  const c2y = y + Math.sin(a + 0.55) * len * 0.6;
  return `M${f(x)} ${f(y)}Q${f(c1x)} ${f(c1y)} ${f(tx)} ${f(ty)}Q${f(c2x)} ${f(c2y)} ${f(x)} ${f(y)}`;
}

/** A tree rooted at (x, y): curved, tapering branches, leaves at the tips. */
function tree(seed: number, x: number, y: number, size: number, maxDepth = 6): Stroke[] {
  const r = rng(seed);
  const out: Stroke[] = [];
  const lean = (r() - 0.5) * 0.25;
  const grow = (x0: number, y0: number, a: number, len: number, depth: number, w: number, t0: number) => {
    const ex = x0 + Math.cos(a) * len;
    const ey = y0 + Math.sin(a) * len;
    const bend = (r() - 0.5) * 0.4;
    const mx = (x0 + ex) / 2 + Math.cos(a + Math.PI / 2) * len * bend;
    const my = (y0 + ey) / 2 + Math.sin(a + Math.PI / 2) * len * bend;
    out.push({ d: `M${f(x0)} ${f(y0)}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`, w, delay: t0, leaf: false });
    if (depth >= maxDepth) {
      const leaves = 1 + Math.floor(r() * 3);
      for (let i = 0; i < leaves; i++) {
        const la = a + (r() - 0.5) * 2.2;
        out.push({ d: leafPath(ex, ey, la, size * (0.035 + r() * 0.03)), w: 0.7, delay: t0 + STEP + r() * 0.5, leaf: true });
      }
      return;
    }
    const kids = depth < 1 ? 2 : r() < 0.3 ? 3 : 2;
    const spread = depth < 2 ? 0.2 + r() * 0.12 : 0.42 + r() * 0.3;
    for (let i = 0; i < kids; i++) {
      const pos = i / (kids - 1) - 0.5;
      const ca = a + pos * spread * 2 + (r() - 0.5) * 0.25 + lean * 0.3;
      grow(ex, ey, ca, len * (0.68 + r() * 0.14), depth + 1, Math.max(0.5, w * 0.68), t0 + STEP + r() * 0.08);
    }
  };
  grow(x, y, -Math.PI / 2 + lean, size * 0.34, 0, 2.2, 0);
  return out;
}

/** A sprig: one curved stem with alternating leaves, smaller toward the tip. */
function sprig(seed: number, x: number, y: number, size: number): Stroke[] {
  const r = rng(seed);
  const out: Stroke[] = [];
  const bend = (r() - 0.5) * 0.6;
  const steps = 7;
  let px = x;
  let py = y;
  let a = -Math.PI / 2 + (r() - 0.5) * 0.3;
  for (let i = 0; i < steps; i++) {
    const len = (size / steps) * (1 - i * 0.05);
    a += bend / steps;
    const ex = px + Math.cos(a) * len;
    const ey = py + Math.sin(a) * len;
    out.push({ d: `M${f(px)} ${f(py)}L${f(ex)} ${f(ey)}`, w: 1.1, delay: i * 0.08, leaf: false });
    if (i > 0) {
      const side = i % 2 ? 1 : -1;
      const leafLen = size * 0.22 * (1 - i / (steps + 2));
      out.push({ d: leafPath(px, py, a + side * 0.9, leafLen), w: 0.8, delay: i * 0.08 + 0.3, leaf: true });
    }
    px = ex;
    py = ey;
  }
  out.push({ d: leafPath(px, py, a, size * 0.12), w: 0.8, delay: steps * 0.08 + 0.3, leaf: true });
  return out;
}

function build(kind: Kind, seed: number): { strokes: Stroke[]; viewBox: string } {
  if (kind === "sprig") return { strokes: sprig(seed, 50, 100, 90), viewBox: "0 0 100 105" };
  if (kind === "tree") return { strokes: tree(seed, 200, 400, 400, 5), viewBox: "0 0 400 405" };
  // A grove: trees of different sizes along a horizon line.
  const r = rng(seed);
  const strokes: Stroke[] = [{ d: "M0 300L1200 300", w: 0.8, delay: 0, leaf: false }];
  const spots = [90, 260, 470, 640, 820, 1010, 1130];
  spots.forEach((sx, i) => {
    const size = 140 + r() * 190;
    for (const s of tree(seed * 31 + i, sx + (r() - 0.5) * 50, 300, size, 5)) {
      strokes.push({ ...s, delay: s.delay + 0.3 + i * 0.12 });
    }
  });
  return { strokes, viewBox: "0 0 1200 305" };
}

export default function Botanical({
  kind,
  seed,
  className,
  style,
}: {
  kind: Kind;
  seed: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<SVGSVGElement>(null);
  // null until mounted (client-only: decoration never risks a hydration
  // mismatch); `instant` honours reduced motion.
  const [env, setEnv] = useState<{ instant: boolean } | null>(null);
  const [grown, setGrown] = useState(false);
  const mounted = env !== null;
  const instant = env?.instant ?? false;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({ instant: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Grow when it first comes into view (instantly under reduced motion).
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setGrown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted]);

  const { strokes, viewBox } = useMemo(() => build(kind, seed), [kind, seed]);
  if (!mounted) return <span aria-hidden className={className} style={style} />;

  return (
    <svg
      ref={ref}
      aria-hidden
      viewBox={viewBox}
      preserveAspectRatio="xMidYMax meet"
      className={className}
      style={{ color: "var(--fg)", ...style }}
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {strokes.map((s, i) => (
          <path
            key={i}
            d={s.d}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            strokeWidth={s.w}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: grown ? 0 : 1,
              opacity: s.leaf ? 0.85 : 1,
              transition: instant
                ? "none"
                : `stroke-dashoffset ${s.leaf ? DRAW * 0.7 : DRAW}s cubic-bezier(0.4,0,0.2,1) ${s.delay.toFixed(2)}s`,
            }}
          />
        ))}
      </g>
    </svg>
  );
}
