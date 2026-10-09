"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

function Word({
  word,
  progress,
  range,
}: {
  word: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className="inline-block whitespace-pre">
      {word}{" "}
    </motion.span>
  );
}

/**
 * Text that lights up word by word as it scrolls through the viewport — the
 * line is fully lit by the time it reaches the upper third. Screen readers
 * get the plain sentence.
 */
export default function ScrollWords({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.92", "start 0.38"],
  });
  const words = text.split(" ");
  return (
    <p ref={ref} className={className} style={style} aria-label={text}>
      {words.map((w, i) => (
        <Word
          key={`${w}-${i}`}
          word={w}
          progress={scrollYProgress}
          range={[i / words.length, (i + 1) / words.length]}
        />
      ))}
    </p>
  );
}
