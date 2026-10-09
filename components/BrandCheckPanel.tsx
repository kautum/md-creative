"use client";

import type { GeneratedCopy } from "@/lib/products";
import { BRAND_VOICE } from "@/lib/brandVoice";
import { brandCheck } from "@/lib/brandCheck";

/** The campaign scored against the brand's hard rules — a pre-flight check. */
export default function BrandCheckPanel({ copy }: { copy: GeneratedCopy }) {
  const results = brandCheck(copy, BRAND_VOICE.forbidden);
  const passed = results.filter((r) => r.pass).length;

  return (
    <div className="card flex flex-col gap-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="label">Brand check</span>
          <p className="body-sm" style={{ color: "var(--fg-70)", fontSize: 14 }}>
            Every line measured against mdlondon&rsquo;s rules before it ships.
          </p>
        </div>
        <span className="heading" aria-label={`${passed} of ${results.length} rules passed`}>
          {passed}/{results.length}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {results.map((r) => (
          <span
            key={r.id}
            className="h-1 flex-1"
            style={{ background: r.pass ? "var(--fg)" : "var(--line)", borderRadius: 1 }}
          />
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-x-[18px] sm:grid-cols-2">
        {results.map((r) => (
          <li key={r.id} className="rule-dashed flex items-baseline justify-between gap-3 py-2.5">
            <span className="label-sm" style={{ color: r.pass ? "var(--fg)" : "var(--fg-50)" }}>
              {r.pass ? "✓" : "✕"} {r.label}
            </span>
            <span
              className="body-sm text-right"
              style={{ fontSize: 13, color: r.pass ? "var(--fg-50)" : "var(--fg)" }}
            >
              {r.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
