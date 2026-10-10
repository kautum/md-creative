"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type AnimationPlaybackControls,
} from "framer-motion";
import { ROUTINES, type Product } from "@/lib/products";
import { getCutout } from "@/lib/cutout";
import ProductImage from "@/components/ProductImage";
import ParticleReel from "@/components/ParticleReel";
import FitText from "@/components/FitText";
import type { Pointer } from "@/components/ParticleProduct";

/**
 * The hero is a product reel. Scroll position only decides WHICH product
 * should be on stage; the change itself is a fixed-length, time-based morph
 * from whatever is showing to that product. That's what keeps it clean under
 * fast scrolling: flinging past five products is one morph, not five
 * half-drawn ones, and nothing lags behind the scrollbar.
 *
 * At rest the real photograph is shown (all eight stay mounted, so nothing
 * reloads or flashes); during a morph the photograph hands over to a particle
 * field — hair strands for tools, mist for The Numbers — and back.
 */

// Tools and Numbers alternate, so the morph swaps strands and mist.
const REEL = ["blow", "the-7", "wave", "the-3", "strait", "the-12", "curl", "the-5"];
const INTRO = 0.07; // share of the scroll spent on the opening wordmark
const END = 0.96;
const VH_PER_PRODUCT = 75;
const MORPH_S = 1.05;
// A morph that interrupts another has only half the journey left, so it's shorter.
const REROUTE_S = MORPH_S * 0.6;

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

/** Which product scroll progress `v` asks for: each owns an equal stretch. */
function targetFor(v: number, n: number) {
  const r = ((v - INTRO) / (END - INTRO)) * (n - 1);
  return Math.max(0, Math.min(n - 1, Math.round(r)));
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

  // Which product is on stage, and which it's coming from.
  const [pair, setPair] = useState({ from: 0, to: 0, duration: MORPH_S });
  const toRef = useRef(0);
  // 0 → 1 over one morph: drives the photo/particle handover.
  const morph = useMotionValue(1);
  const anim = useRef<AnimationPlaybackControls | null>(null);

  const go = (t: number) => {
    if (t === toRef.current) return;
    const from = toRef.current;
    toRef.current = t;
    // Interrupted mid-morph: stay in the particle phase (0.5) and re-route,
    // instead of flashing the old photo back in. Particles and photos share
    // this one duration, so they always finish together.
    const interrupted = morph.get() < 1;
    const duration = interrupted ? REROUTE_S : MORPH_S;
    setPair({ from, to: t, duration });
    if (reduced) {
      morph.set(1);
      return;
    }
    anim.current?.stop();
    anim.current = animate(morph, [interrupted ? 0.5 : 0, 1], { duration, ease: "linear" });
  };

  useMotionValueEvent(scrollYProgress, "change", (v) => go(targetFor(v, n)));

  // Opening assembly: the first product forms out of the particle field.
  useEffect(() => {
    if (reduced) return;
    anim.current = animate(morph, [0.5, 1], { duration: MORPH_S * 1.4, ease: "linear", delay: 0.2 });
    return () => anim.current?.stop();
  }, [morph, reduced]);

  const cloud = useTransform(morph, [0, 0.06, 0.94, 1], [0, 1, 1, 0]);
  const imgFrom = useTransform(morph, [0, 0.08], [1, 0]);
  const imgTo = useTransform(morph, [0.9, 1], [0, 1]);
  const wobble = useTransform(morph, (m) => Math.sin(m * Math.PI) * 5);

  // Opening wordmark gives way to the reel (direct, not smoothed: no lag).
  // Function transforms on purpose: a range-mapped opacity off scroll
  // progress gets handed to the browser's native scroll timeline, which
  // mis-tracked this section's offsets and left both layers half-visible.
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  const introOpacity = useTransform(scrollYProgress, (v) => clamp01(1 - v / (INTRO * 0.8)));
  const reelOpacity = useTransform(scrollYProgress, (v) => clamp01((v - INTRO * 0.4) / (INTRO * 0.6)));

  // Mouse tilt, and the pointer the particles feel as wind.
  const pointer = useRef<Pointer | null>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  // Rotation spring, as Apple ships it (SKILL.md §4): damping 0.8, response
  // 0.4s. X and Y are separate springs (§3), so they never desync.
  const TILT = { bounce: 0.2, visualDuration: 0.4 };
  const rotateY = useSpring(useTransform(mx, (v) => v * 12), TILT);
  const rotateX = useSpring(useTransform(my, (v) => v * -8), TILT);

  const jumpTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const travel = el.offsetHeight - window.innerHeight;
    const at = INTRO + (i / (n - 1)) * (END - INTRO);
    window.scrollTo({ top: el.offsetTop + travel * at, behavior: reduced ? "auto" : "smooth" });
  };

  const current = reel[pair.to];
  const routines = ROUTINES.filter((r) => r.productIds.includes(current.id));
  const picked = selectedIds.includes(current.id);
  const srcs = reel.map((x) => getCutout(x.id).url);
  const kinds = reel.map((x) => (x.category === "tool" ? "strand" : "mist") as "strand" | "mist");
  const enter = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28 } };

  return (
    <section
      ref={ref}
      id="top"
      className="relative"
      style={{ height: reduced ? "100svh" : `${100 + (n - 1) * VH_PER_PRODUCT + 25}vh` }}
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

        {/* The product's name, outlined, sized to fit between the panels. */}
        <motion.div
          style={{ opacity: reelOpacity }}
          className="pointer-events-none absolute inset-x-4 top-[30%] flex items-center justify-center sm:inset-x-6 lg:inset-x-[27vw] lg:top-1/2 lg:-translate-y-1/2"
        >
          <motion.div key={current.id} {...enter} className="w-full opacity-35">
            <FitText max={220} textClassName="display outline leading-none" className="w-full text-center">
              {current.name}
            </FitText>
          </motion.div>
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

        {/* The object: every photograph mounted once; particles between. */}
        <div
          className="absolute left-1/2 top-[40%] h-[34vh] w-[64vw] -translate-x-1/2 -translate-y-1/2 sm:top-[46%] sm:h-[44vh] sm:w-[46vw] lg:top-[48%] lg:h-[58vh] lg:w-[34vw]"
          style={{ perspective: 1100 }}
        >
          <motion.div className="relative h-full w-full" style={{ rotate: wobble, rotateX, rotateY }}>
            <motion.div className="absolute inset-0" style={{ opacity: cloud }}>
              <ParticleReel srcs={srcs} kinds={kinds} target={pair.to} duration={pair.duration} pointer={pointer} />
            </motion.div>
            {reel.map((x, i) => (
              <motion.div
                key={x.id}
                className="absolute inset-0"
                style={{ opacity: i === pair.to ? imgTo : i === pair.from ? imgFrom : 0 }}
              >
                <ProductImage product={x} priority className="h-full w-full" />
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Left: what it is. */}
        <motion.div
          style={{ opacity: reelOpacity }}
          className="absolute bottom-20 left-4 right-4 z-10 sm:left-6 sm:right-auto sm:max-w-[60vw] lg:bottom-auto lg:top-1/2 lg:max-w-[25vw] lg:-translate-y-1/2"
        >
          <motion.div
            key={current.id}
            {...enter}
            className="flex flex-col gap-3 rounded-[12px] p-4 sm:gap-4 sm:p-5 lg:-ml-5"
            style={{ background: "rgba(244,239,230,0.9)" }}
          >
            <span className="label" style={{ color: "var(--fg-50)" }}>
              {current.category === "tool" ? "The tools" : "The Numbers"} · {String(pair.to + 1).padStart(2, "0")} /{" "}
              {String(n).padStart(2, "0")}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="heading" style={{ fontSize: "clamp(24px, 2.6vw, 42px)" }}>
                {current.name}
              </h2>
              <Price p={current} />
            </div>
            <p className="body-voice italic" style={{ fontSize: "clamp(17px, 1.5vw, 23px)" }}>
              “{current.slogan}”
            </p>
            <span className="legal">mdlondon, on {current.name}</span>
          </motion.div>
        </motion.div>

        {/* Right: where it fits, and pick it. */}
        <motion.div
          style={{ opacity: reelOpacity }}
          className="absolute right-12 top-1/2 z-10 hidden w-[24vw] max-w-[380px] -translate-y-1/2 lg:block"
        >
          <motion.div
            key={current.id}
            {...enter}
            className="flex flex-col gap-5 rounded-[12px] p-5"
            style={{ background: "rgba(244,239,230,0.9)" }}
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
        </motion.div>

        {/* Reel index on wide screens; click to jump. */}
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
              style={{ color: i === pair.to ? "var(--blue)" : "var(--fg-50)" }}
              aria-current={i === pair.to}
            >
              {i === pair.to ? "● " : ""}
              {x.name}
            </button>
          ))}
        </motion.nav>

        {/* Mobile / tablet: pick from the reel, with progress dots. */}
        <motion.div
          style={{ opacity: reelOpacity }}
          className="absolute inset-x-4 bottom-6 z-10 flex items-center justify-between gap-4 sm:inset-x-6 lg:hidden"
        >
          <button
            type="button"
            onClick={() => onToggle(current)}
            className="btn-filled"
            style={{ padding: "10px 18px", fontSize: 12 }}
          >
            {picked ? "Picked ✓" : `Pick ${current.name} +`}
          </button>
          <span className="flex gap-1.5" aria-hidden>
            {reel.map((x, i) => (
              <span
                key={x.id}
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: i === pair.to ? "var(--blue)" : "var(--line)" }}
              />
            ))}
          </span>
        </motion.div>

        {/* Opening furniture: credit + scroll cue. */}
        <motion.div
          style={{ opacity: introOpacity }}
          className="pointer-events-none absolute inset-x-4 bottom-6 flex items-end justify-between gap-6 sm:inset-x-6"
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
