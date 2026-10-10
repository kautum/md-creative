"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * One line of display type sized to exactly fill its container's width —
 * never clipped, never overflowing, at any viewport. It measures the text at
 * a reference size and scales linearly (width is proportional to font size),
 * re-fitting on resize and once web fonts have loaded.
 */
export default function FitText({
  children,
  className,
  textClassName,
  max = Infinity,
  min = 12,
  "aria-hidden": ariaHidden,
}: {
  children: React.ReactNode;
  className?: string;
  textClassName?: string;
  max?: number;
  min?: number;
  "aria-hidden"?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text) return;
    const REF = 100;
    const fit = () => {
      text.style.fontSize = `${REF}px`;
      const natural = text.scrollWidth;
      const available = wrap.clientWidth;
      if (natural === 0 || available === 0) return;
      // 0.98: room for the outline stroke and sub-pixel rounding.
      const size = Math.max(min, Math.min(max, ((REF * available) / natural) * 0.98));
      text.style.fontSize = `${size}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) fit();
    });
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [children, max, min]);

  return (
    <div ref={wrapRef} className={className} aria-hidden={ariaHidden}>
      <span ref={textRef} className={`inline-block whitespace-nowrap ${textClassName ?? ""}`}>
        {children}
      </span>
    </div>
  );
}
