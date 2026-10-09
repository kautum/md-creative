"use client";

import { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useVelocity,
} from "framer-motion";
import { PRODUCTS } from "@/lib/products";

const BASE_SPEED = 38; // px per second at rest
const LINE = PRODUCTS.map((p) => p.name).join("  —  ") + "  —  ";

/**
 * The range in display type, drifting left forever. Scrolling either way
 * pushes it faster — the marquee feels the page move.
 */
export default function Marquee() {
  const reduced = useReducedMotion();
  const rowRef = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });

  useAnimationFrame((_, delta) => {
    if (reduced) return;
    const width = rowRef.current?.offsetWidth ?? 0;
    if (width === 0) return;
    const boost = 1 + Math.min(Math.abs(velocity.get()) / 300, 6);
    let next = x.get() - (BASE_SPEED * boost * delta) / 1000;
    if (next <= -width) next += width; // seamless: the row is drawn twice
    x.set(next);
  });

  return (
    <div
      aria-hidden
      className="rule-dashed overflow-hidden py-10"
      style={{ borderBottom: "1px dashed var(--cork)" }}
    >
      <motion.div style={{ x }} className="flex w-max whitespace-pre">
        <span ref={rowRef} className="display" style={{ color: "var(--driftwood)", fontSize: "clamp(56px, 9vw, 132px)" }}>
          {LINE}
        </span>
        <span className="display" style={{ color: "var(--driftwood)", fontSize: "clamp(56px, 9vw, 132px)" }}>
          {LINE}
        </span>
      </motion.div>
    </div>
  );
}
