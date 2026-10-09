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
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-5 transition-[background-color,backdrop-filter,border-color] duration-500 sm:px-6"
      style={{
        // Transparent over the hero stage; frosted walnut once you're into
        // the content, so labels stay legible over cards and imagery.
        backgroundColor: active ? "rgba(21,28,30,0.72)" : "rgba(21,28,30,0)",
        backdropFilter: active ? "blur(14px) saturate(140%)" : "none",
        borderBottom: `1px dashed ${active ? "var(--line)" : "transparent"}`,
      }}
    >
      <a href="#top" className="label shrink-0 text-[12px] sm:text-[14px]">
        MD CREATIVE<span style={{ color: "var(--accent)" }}>.</span>
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
