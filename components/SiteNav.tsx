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
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-5 sm:px-6"
      style={{
        // Not chrome — just enough walnut to keep labels legible over content.
        background:
          "linear-gradient(var(--walnut) 0%, rgba(16,9,4,0.85) 60%, rgba(16,9,4,0) 100%)",
      }}
    >
      <a href="#top" className="label" style={{ fontSize: 14 }}>
        MD CREATIVE.
      </a>
      <nav className="flex items-center gap-4 sm:gap-7">
        {NAV_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="label pb-1"
            style={{
              borderBottom: `1px dashed ${active === s.id ? "var(--cream)" : "transparent"}`,
              color: active === s.id ? "var(--cream)" : "var(--cream-70)",
            }}
          >
            {s.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
