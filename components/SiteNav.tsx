"use client";

import { useEffect, useState } from "react";

export const NAV_SECTIONS = [
  { id: "range", label: "Range" },
  { id: "brief", label: "Brief" },
  { id: "campaign", label: "Campaign" },
  { id: "preview", label: "Preview" },
] as const;

/**
 * Fixed, transparent, four items max. The active section gets the dashed
 * underline; it's tracked with an IntersectionObserver over a thin band in the
 * upper third of the viewport, so whichever section crosses that band wins.
 */
export default function SiteNav() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id;
          if (e.isIntersecting) setActive(id);
          // Leaving the band clears it, so the hero shows no active item.
          else setActive((cur) => (cur === id ? null : cur));
        }
      },
      { rootMargin: "-30% 0px -65% 0px" },
    );
    // Sections mount after a generation, so re-scan when the DOM changes.
    const observeAll = () =>
      NAV_SECTIONS.forEach((s) => {
        const el = document.getElementById(s.id);
        if (el) observer.observe(el);
      });
    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <header
      // Transparent over the hero stage; once you're into the content it
      // becomes a translucent material with a soft scroll edge beneath — no
      // hard divider (designs/SKILL.md §12). The material fades in, rather
      // than snapping, so the change reads as glass arriving.
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-5 sm:px-6"
    >
      <span
        aria-hidden
        className="material scroll-edge pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500"
        style={{ opacity: active ? 1 : 0 }}
      />
      <a href="#top" className="label shrink-0 text-[12px] sm:text-[14px]">
        MD CREATIVE<span style={{ color: "var(--blue)" }}>.</span>
      </a>
      <nav className="flex items-center gap-3 sm:gap-7">
        {NAV_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="label pb-1 max-sm:text-[10px]"
            style={{
              borderBottom: `1px dashed ${active === s.id ? "var(--fg)" : "transparent"}`,
              color: active === s.id ? "var(--fg)" : "var(--fg-70)",
            }}
          >
            {s.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
