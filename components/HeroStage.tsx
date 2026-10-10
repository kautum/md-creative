"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ROUTINES, type Product } from "@/lib/products";
import { getCutout } from "@/lib/cutout";
import ProductImage from "@/components/ProductImage";
import ParticleReel from "@/components/ParticleReel";
import type { Pointer } from "@/components/ParticleProduct";

/**
 * The hero is a product reel: scroll and the range plays through one product
 * at a time. Between products the particles morph — the outgoing product
 * dissolves into hair strands or mist and re-forms as the next. Behind each
 * one, its name in outlined display type (after mdlondon's own outline
 * headlines); around it, the facts that matter: live price, mdlondon's own
 * slogan, the official routines it belongs to, and a button to pick it.
 */

// Tools and Numbers alternate, so the morph swaps strands and mist.
const REEL = ["blow", "the-7", "wave", "the-3", "strait", "the-12", "curl", "the-5"];
const INTRO = 0.08; // share of the scroll spent on the opening wordmark
const END = 0.97;
const VH_PER_PRODUCT = 120;
// Share of each product's stretch of scroll where it simply holds still,
// fully visible; the morph to the next happens in the rest.
const HOLD = 0.6;

/** Raw reel position → position with a still "hold" around every product. */
function dwell(r: number) {
  const k = Math.floor(r);
  const f = r - k;
  const h = HOLD / 2;
  if (f <= h) return k;
  if (f >= 1 - h) return k + 1;
  return k + (f - h) / (1 - HOLD);
}

function Price({ p }: { p: Product }) {
  return (
    <span className="label flex items-baseline gap-2" style={{ fontSize: 14 }}>
      {p.wasPrice && (
        <s style={{ color: "var(--fg-50)" }} aria-label={`was £${p.wasPrice}`}>
          £{p.wasPrice}
        </s>
      )}
      £{p.price}
    </span>
  );
}

export default function HeroStage({
  products,
  selectedIds,
  onToggle,
}: {
  products: Product[];
  selectedIds: string[];
  onToggle: (p: Product) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const reel = REEL.map((id) => {
    const p = products.find((x) => x.id === id);
    if (!p) throw new Error(`HeroStage: reel product "${id}" is not in the catalogue`);
    return p;
  });
  const n = reel.length;

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  const raw = useTransform(p, [INTRO, END], [0, n - 1], { clamp: true });
  const s = useTransform(raw, (r) => Math.min(n - 1, dwell(r)));

  // React state only changes when the product changes, not every frame.
  const [idx, setIdx] = useState(0);
  const [k, setK] = useState(0);
  useMotionValueEvent(s, "change", (v) => {
    const r = Math.round(v);
    if (r !== idx) setIdx(r);
    const f = Math.max(0, Math.min(Math.floor(v), n - 2));
    if (f !== k) setK(f);
  });

  // Real photographs at rest, particles in transit.
  const frac = (v: number) => v - Math.max(0, Math.min(Math.floor(v), n - 2));
  const imgA = useTransform(s, (v) => 1 - Math.min(1, Math.max(0, frac(v) / 0.1)));
  const imgB = useTransform(s, (v) => Math.min(1, Math.max(0, (frac(v) - 0.9) / 0.1)));
  const cloud = useTransform(s, (v) => {
    const t = frac(v);
    return Math.min(1, Math.max(0, Math.min(t, 1 - t) * 12));
  });
  const wobble = useTransform(s, (v) => Math.sin(frac(v) * Math.PI) * 6);

  // Opening wordmark gives way to the reel.
  const introOpacity = useTransform(p, [0, INTRO * 0.8], [1, 0]);
  const reelOpacity = useTransform(p, [INTRO * 0.5, INTRO], [0, 1]);

  // Mouse tilt, and the pointer the particles feel as wind.
  const pointer = useRef<Pointer | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-1, 1], [-12, 12]), { stiffness: 90, damping: 18 });
  const rotateX = useSpring(useTransform(my, [-1, 1], [8, -8]), { stiffness: 90, damping: 18 });

  const jumpTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const travel = el.offsetHeight - window.innerHeight;
    const at = INTRO + (i / (n - 1)) * (END - INTRO);
    window.scrollTo({ top: el.offsetTop + travel * at, behavior: reduced ? "auto" : "smooth" });
  };

  const current = reel[idx];
  const routines = ROUTINES.filter((r) => r.productIds.includes(current.id));
  const picked = selectedIds.includes(current.id);
  const srcs = reel.map((x) => getCutout(x.id).url);
  const kinds = reel.map((x) => (x.category === "tool" ? "strand" : "mist") as "strand" | "mist");
  const next = reel[Math.min(k + 1, n - 1)];

  return (
    <section
      ref={ref}
      id="top"
      className="relative"
      style={{ height: reduced ? "100svh" : `${100 + (n - 1) * VH_PER_PRODUCT + 30}vh` }}
      onPointerMove={(e) => {
        if (reduced) return;
        pointer.current = { x: e.clientX, y: e.clientY, t: performance.now() };
        if (e.pointerType !== "mouse") return;
        mx.set((e.clientX / window.innerWidth) * 2 - 1);
        my.set((e.clientY / window.innerHeight) * 2 - 1);
      }}
      onPointerLeave={() => {
        pointer.current = null;
      }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* Studio sweep behind the object. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 38% 44% at 50% 46%, rgba(255,255,255,0.85), rgba(255,255,255,0.3) 45%, rgba(255,255,255,0) 80%)",
          }}
        />

        {/* The product's name, huge and outlined, behind it. */}
        <motion.div
          style={{ opacity: reelOpacity }}
          className="pointer-events-none absolute inset-y-0 left-[22vw] right-[22vw] flex items-center justify-center overflow-hidden max-lg:inset-x-0"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={current.id}
              aria-hidden
              className="display outline whitespace-nowrap leading-none"
              style={{ fontSize: "clamp(64px, 11vw, 200px)" }}
              initial={{ x: "18vw", opacity: 0 }}
              animate={{ x: 0, opacity: 0.32 }}
              exit={{ x: "-18vw", opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {current.name}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        {/* Opening: the wordmark. */}
        <motion.div
          style={{ opacity: introOpacity }}
          className="pointer-events-none absolute left-4 top-24 z-10 flex flex-col gap-5 sm:left-6 lg:top-[14vh]"
        >
          <span className="label">Hair confidence, every day — campaign studio</span>
          <h1 className="display">
            MD
            <br />
            Creative<span style={{ color: "var(--blue)" }}>.</span>
          </h1>
          <p className="body-voice max-w-md" style={{ color: "var(--fg-70)" }}>
            Scroll through the range. Pick anything, and get the whole campaign.
          </p>
        </motion.div>

        {/* The object: photographs at rest, a morphing particle field between. */}
        <div
          className="absolute left-1/2 top-[48%] h-[44vh] w-[70vw] -translate-x-1/2 -translate-y-1/2 sm:w-[46vw] lg:h-[58vh] lg:w-[34vw]"
          style={{ perspective: 1100 }}
        >
          <motion.div className="relative h-full w-full" style={{ rotate: wobble, rotateX, rotateY }}>
            <motion.div className="absolute inset-0" style={{ opacity: cloud }}>
              <ParticleReel srcs={srcs} kinds={kinds} position={s} pointer={pointer} />
            </motion.div>
            <motion.div className="absolute inset-0" style={{ opacity: imgA }}>
              <ProductImage key={reel[k].id} product={reel[k]} priority className="h-full w-full" />
            </motion.div>
            <motion.div className="absolute inset-0" style={{ opacity: imgB }}>
              <ProductImage key={next.id} product={next} priority className="h-full w-full" />
            </motion.div>
          </motion.div>
        </div>

        {/* Left: what it is. */}
        <motion.div
          style={{ opacity: reelOpacity }}
          className="absolute bottom-24 left-4 z-10 max-w-[78vw] sm:left-6 lg:bottom-auto lg:top-1/2 lg:max-w-[26vw] lg:-translate-y-1/2"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-4 rounded-[12px] p-5 lg:-ml-5"
              style={{ background: "rgba(244,239,230,0.88)" }}
            >
              <span className="label" style={{ color: "var(--fg-50)" }}>
                {current.category === "tool" ? "The tools" : "The Numbers"} · {String(idx + 1).padStart(2, "0")} /{" "}
                {String(n).padStart(2, "0")}
              </span>
              <div className="flex items-baseline gap-4">
                <h2 className="heading" style={{ fontSize: "clamp(28px, 3.2vw, 46px)" }}>
                  {current.name}
                </h2>
                <Price p={current} />
              </div>
              <p className="body-voice italic" style={{ fontSize: "clamp(18px, 1.6vw, 24px)" }}>
                “{current.slogan}”
              </p>
              <span className="legal">mdlondon, on {current.name}</span>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Right: where it fits, and pick it. */}
        <motion.div
          style={{ opacity: reelOpacity }}
          className="absolute right-12 top-1/2 z-10 hidden w-[24vw] -translate-y-1/2 lg:block"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="flex flex-col gap-5 rounded-[12px] p-5"
              style={{ background: "rgba(244,239,230,0.88)" }}
            >
              <p className="body-sm" style={{ color: "var(--fg-70)" }}>
                {current.tagline}
              </p>
              <div className="rule-dashed flex flex-col gap-2 pt-4">
                <span className="label-sm" style={{ color: "var(--fg-50)" }}>
                  In mdlondon routines
                </span>
                {routines.length ? (
                  routines.map((r) => (
                    <span key={r.id} className="label">
                      {r.name} · £{r.price}
                    </span>
                  ))
                ) : (
                  <span className="label">Sold on its own</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => onToggle(current)}
                  className="btn-filled"
                  style={{ padding: "11px 20px", fontSize: 12 }}
                >
                  {picked ? "Picked ✓" : "Pick this +"}
                </button>
                <a href={current.productUrl} target="_blank" rel="noreferrer" className="link">
                  mdlondon.com ↗
                </a>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* The reel index, down the right edge — click to jump. */}
        <motion.nav
          aria-label="Product reel"
          style={{ opacity: reelOpacity }}
          className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-end gap-2 2xl:flex"
        >
          {reel.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => jumpTo(i)}
              className="label-sm transition-colors"
              style={{ color: i === idx ? "var(--blue)" : "var(--fg-50)" }}
              aria-current={i === idx}
            >
              {i === idx ? "● " : ""}
              {x.name}
            </button>
          ))}
        </motion.nav>

        {/* Mobile: pick from the reel too. */}
        <motion.div style={{ opacity: reelOpacity }} className="absolute bottom-8 left-4 z-10 lg:hidden">
          <button
            type="button"
            onClick={() => onToggle(current)}
            className="btn-filled"
            style={{ padding: "10px 18px", fontSize: 12 }}
          >
            {picked ? "Picked ✓" : `Pick ${current.name} +`}
          </button>
        </motion.div>

        {/* The cursor is the hairdryer, while the product is in the air. */}
        <motion.span
          style={{ opacity: cloud }}
          className="label-sm pointer-events-none absolute inset-x-0 bottom-[6vh] hidden text-center lg:block"
        >
          Move through the cloud — you’re the hairdryer
        </motion.span>

        {/* Opening furniture: credit + scroll cue. */}
        <motion.div
          style={{ opacity: introOpacity }}
          className="absolute inset-x-4 bottom-6 flex items-end justify-between gap-6 sm:inset-x-6"
        >
          <div
            className="hidden max-w-sm flex-col gap-3 p-5 sm:flex"
            style={{ borderRadius: "var(--radius-card)", background: "rgba(235,228,216,0.75)" }}
          >
            <span className="label">
              <span className="credit">Built by</span> Kautum Krishnan Panjalaraja
            </span>
            <hr className="rule-dashed" />
            <p className="body-sm" style={{ color: "var(--fg-70)", fontSize: 13 }}>
              Groq writes the copy. Pollinations paints the scene. The real product
              is placed into it — and the whole thing fits in a link.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <span className="label-sm">Scroll the range</span>
            <span className="relative block h-12 w-px overflow-hidden" style={{ background: "var(--line)" }}>
              <span className="animate-scroll-cue absolute inset-x-0 top-0 h-1/2" style={{ background: "var(--fg)" }} />
            </span>
          </div>
          <span className="label hidden sm:block" style={{ color: "var(--fg-50)" }}>
            {n} products · tools &amp; The Numbers
          </span>
        </motion.div>
      </div>
    </section>
  );
}
