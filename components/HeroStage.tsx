"use client";

import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import type { Product } from "@/lib/products";
import { getCutout } from "@/lib/cutout";
import ProductImage from "@/components/ProductImage";
import ParticleProduct from "@/components/ParticleProduct";

/**
 * The hero is a pinned stage: 340vh of scroll scrubs one product through
 * three chapters — the void-mode "product reveal" from the reference, told in
 * sequence the way Apple pages do. Scroll progress is spring-smoothed so
 * every transform eases instead of stepping with the wheel.
 */

// Sample output for the exploded view — lines from mdlondon's own brand
// voice examples, labelled as examples on screen.
const BURST = [
  // x/y are vw/vh offsets from centre — kept inside the middle half of the
  // screen so they never cross the chapter text in the outer columns.
  { label: "Short ad", text: "Volume. Shine. No frizz.", x: -15, y: -30 },
  { label: "TikTok hook", text: "Your dryer is the reason your hair looks like that.", x: 15, y: -24 },
  { label: "Caption", text: "Frizzy mornings, solved.", x: -16, y: 14 },
  { label: "Hashtags", text: "#MDLONDON #GREATHAIRMADEEASY", x: 15, y: 22 },
  { label: "CTA", text: "Shop the routine.", x: -2, y: 36 },
];

const CHAPTERS = [
  {
    n: "01",
    title: "One product in.",
    body: "A £13 brush or the £195 dryer. Pick one for a hero campaign, or a few for a bundle.",
    range: [0.14, 0.2, 0.34, 0.4],
  },
  {
    n: "02",
    title: "A whole campaign out.",
    body: "Angle, caption, hashtags, three paid ads and a TikTok script — written in mdlondon’s voice and checked against its rules.",
    range: [0.42, 0.48, 0.62, 0.68],
  },
  {
    n: "03",
    title: "Staged where it belongs.",
    body: "A scene painted from the campaign idea, with the real product placed in it. Not a lookalike.",
    range: [0.7, 0.76, 1.1, 1.2],
  },
] as const;

function Chapter({
  progress,
  chapter,
}: {
  progress: MotionValue<number>;
  chapter: (typeof CHAPTERS)[number];
}) {
  const [a, b, c, d] = chapter.range;
  const opacity = useTransform(progress, [a, b, c, d], [0, 1, 1, 0]);
  const y = useTransform(progress, [a, b, c, d], [40, 0, 0, -40]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="pointer-events-none absolute inset-x-4 bottom-[12vh] grid grid-cols-1 gap-6 sm:inset-x-6 lg:inset-x-6 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 lg:grid-cols-12 lg:pr-6"
    >
      <div className="flex flex-col gap-4 lg:col-span-3">
        <span className="label" style={{ color: "var(--cream-50)" }}>
          {chapter.n} / 03
        </span>
        <h2 className="heading">{chapter.title}</h2>
      </div>
      <p className="body-voice lg:col-span-3 lg:col-start-10">{chapter.body}</p>
    </motion.div>
  );
}

function BurstCard({
  progress,
  card,
  i,
}: {
  progress: MotionValue<number>;
  card: (typeof BURST)[number];
  i: number;
}) {
  const start = 0.44 + i * 0.015;
  const t = useTransform(progress, [start, start + 0.08, 0.63, 0.69], [0, 1, 1, 0]);
  const x = useTransform(t, [0, 1], ["0vw", `${card.x}vw`]);
  const y = useTransform(t, [0, 1], ["0vh", `${card.y}vh`]);
  const scale = useTransform(t, [0, 1], [0.6, 1]);
  return (
    <motion.div
      style={{ x, y, scale, opacity: t }}
      className="pointer-events-none absolute left-1/2 top-1/2 hidden w-[230px] -translate-x-1/2 -translate-y-1/2 flex-col gap-2 p-4 lg:flex"
    >
      <div
        className="absolute inset-0"
        style={{
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--cork)",
          background: "rgba(56,36,22,0.72)",
          backdropFilter: "blur(10px)",
        }}
      />
      <span className="label-sm relative" style={{ color: "var(--cream-50)" }}>
        {card.label}
      </span>
      <span className="body-sm relative" style={{ fontSize: 14 }}>
        {card.text}
      </span>
    </motion.div>
  );
}

export default function HeroStage({ product }: { product: Product }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });

  // Assembly: particles converge on load (and when the product changes),
  // loosen into a field while the copy bursts out, re-form for the staging.
  const intro = useMotionValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    intro.set(0);
    const c = animate(intro, 1, { duration: 2.2, ease: [0.22, 1, 0.36, 1], delay: 0.15 });
    return () => c.stop();
  }, [product.id, intro, reduced]);
  const scrollForm = useTransform(p, [0, 0.42, 0.5, 0.62, 0.72], [1, 1, 0.4, 0.4, 1]);
  const form = useTransform(() => Math.min(intro.get(), scrollForm.get()));
  const imageOpacity = useTransform(form, [0.86, 1], [0, 1]);
  const particleOpacity = useTransform(form, [0.9, 1], [1, 0]);

  // The object's path through the chapters.
  const scale = useTransform(p, [0, 0.4, 0.62, 0.8, 1], [1, 0.82, 0.62, 0.78, 0.78]);
  const rotate = useTransform(p, [0, 0.4, 0.62, 0.8], [-6, 7, 0, -3]);
  const lift = useTransform(p, [0, 0.72, 0.82], ["0vh", "0vh", "6vh"]);

  // Mouse tilt — a small 3D lean toward the pointer, springy.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-1, 1], [-14, 14]), { stiffness: 90, damping: 18 });
  const rotateX = useSpring(useTransform(my, [-1, 1], [10, -10]), { stiffness: 90, damping: 18 });

  // Intro furniture fades as the story begins.
  const introOpacity = useTransform(p, [0, 0.12], [1, 0]);
  const mdX = useTransform(p, [0, 0.14], ["0vw", "-10vw"]);
  const creativeX = useTransform(p, [0, 0.14], ["0vw", "10vw"]);

  // Staging plinth for chapter 3.
  const plinth = useTransform(p, [0.72, 0.82], [0, 1]);
  const progressBar = useTransform(p, [0, 1], [0, 1]);

  const cut = getCutout(product.id);

  return (
    <section
      ref={ref}
      id="top"
      className="relative"
      style={{ height: reduced ? "100svh" : "340vh" }}
      onPointerMove={(e) => {
        if (reduced || e.pointerType !== "mouse") return;
        mx.set((e.clientX / window.innerWidth) * 2 - 1);
        my.set((e.clientY / window.innerHeight) * 2 - 1);
      }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {/* Warm rim light from the upper right. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 40% 45% at 58% 40%, rgba(220,80,0,0.13), rgba(56,36,22,0.32) 50%, rgba(16,9,4,0) 80%)",
          }}
        />

        {/* Wordmark — splits apart as the story starts. */}
        <motion.div
          style={{ opacity: introOpacity }}
          className="pointer-events-none absolute left-4 top-24 z-10 flex flex-col gap-4 sm:left-6 lg:top-[16vh]"
        >
          <span className="label">Great hair, made easy — campaign studio</span>
          <h1 className="display">
            <motion.span style={{ x: mdX }} className="block">
              MD
            </motion.span>
            <motion.span style={{ x: creativeX }} className="block">
              Creative.
            </motion.span>
          </h1>
        </motion.div>

        {/* Plinth: a horizon line and a pool of light the object lands on. */}
        <motion.div
          aria-hidden
          style={{ opacity: plinth }}
          className="absolute inset-x-0 top-[71%]"
        >
          <div className="rule-dashed mx-auto w-[70%]" />
          <div
            className="mx-auto -mt-[9vh] h-[18vh] w-[46vw]"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(255,237,215,0.10), rgba(255,237,215,0) 65%)",
            }}
          />
        </motion.div>

        {/* The object. */}
        <div
          className="absolute left-1/2 top-[46%] h-[52vh] w-[78vw] -translate-x-1/2 -translate-y-1/2 sm:w-[52vw] lg:h-[60vh] lg:w-[38vw]"
          style={{ perspective: 1100 }}
        >
          <motion.div
            className="relative h-full w-full"
            style={{ scale, rotate, y: lift, rotateX, rotateY, transformStyle: "preserve-3d" }}
          >
            {/* The constellation hands over to the real image completely — no
                speckle left around a settled product. */}
            <motion.div className="absolute inset-0" style={{ opacity: particleOpacity }}>
              <ParticleProduct key={cut.url} src={cut.url} form={form} pad={0.35} count={1300} />
            </motion.div>
            <motion.div className="absolute inset-0" style={{ opacity: imageOpacity }}>
              <ProductImage key={product.id} product={product} priority className="h-full w-full" />
            </motion.div>
          </motion.div>
        </div>

        {BURST.map((card, i) => (
          <BurstCard key={card.label} progress={p} card={card} i={i} />
        ))}

        {CHAPTERS.map((ch) => (
          <Chapter key={ch.n} progress={p} chapter={ch} />
        ))}

        {/* Intro card + scroll cue, bottom. */}
        <motion.div
          style={{ opacity: introOpacity }}
          className="absolute inset-x-4 bottom-6 flex items-end justify-between gap-6 sm:inset-x-6"
        >
          <div
            className="hidden max-w-sm flex-col gap-3 p-5 sm:flex"
            style={{ borderRadius: "var(--radius-card)", background: "rgba(56,36,22,0.55)" }}
          >
            <span className="label">
              <span className="credit">Built by</span> Kautum Krishnan Panjalaraja
            </span>
            <hr className="rule-dashed" style={{ borderColor: "var(--driftwood)" }} />
            <p className="body-sm" style={{ color: "var(--cream-70)", fontSize: 13 }}>
              Groq writes the copy. Pollinations paints the scene. The real product
              is placed into it — and the whole thing fits in a link.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <span className="label-sm">Scroll</span>
            <span className="relative block h-12 w-px overflow-hidden" style={{ background: "var(--cork)" }}>
              <span className="animate-scroll-cue absolute inset-x-0 top-0 h-1/2" style={{ background: "var(--cream)" }} />
            </span>
          </div>
          <span className="label hidden sm:block" style={{ color: "var(--cream-50)" }}>
            {product.name} — £{product.price}
          </span>
        </motion.div>

        {/* Story progress — a hairline that fills down the right edge. */}
        <div className="absolute bottom-[20vh] right-6 top-[20vh] hidden w-px lg:block" style={{ background: "var(--cork)" }}>
          <motion.div
            className="absolute inset-x-0 top-0 h-full origin-top"
            style={{ scaleY: progressBar, background: "var(--cream)" }}
          />
        </div>
      </div>
    </section>
  );
}
