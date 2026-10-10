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

const BASE_SPEED = 38; // px per second at rest
// mdlondon's own lines (mdlondon.com, Oct 2026), not ours.
const LINE =
  [
    "Hair confidence, every day",
    "Great hair shouldn’t be complicated",
    "The right kit and a little know-how",
    "Great hair starts with the right routine",
  ].join("  —  ") + "  —  ";

/**
 * mdlondon's own lines in display type, drifting left forever. Scrolling either way
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
    // A fast scroll nudges it along (at most 2x) — more reads as frantic.
    const boost = 1 + Math.min(Math.abs(velocity.get()) / 1500, 1);
    let next = x.get() - (BASE_SPEED * boost * delta) / 1000;
    if (next <= -width) next += width; // seamless: the row is drawn twice
    x.set(next);
  });

  return (
    <div
      aria-hidden
      className="rule-dashed overflow-hidden py-10"
      style={{ borderBottom: "1px dashed var(--line)" }}
    >
      <motion.div style={{ x }} className="flex w-max whitespace-pre">
        <span ref={rowRef} className="display" style={{ color: "var(--slate)", fontSize: "clamp(56px, 9vw, 132px)" }}>
          {LINE}
        </span>
        <span className="display" style={{ color: "var(--slate)", fontSize: "clamp(56px, 9vw, 132px)" }}>
          {LINE}
        </span>
      </motion.div>
    </div>
  );
}
