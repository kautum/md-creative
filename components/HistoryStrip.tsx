"use client";

import { PRODUCTS } from "@/lib/products";
import type { HistoryEntry } from "@/lib/history";
import ProductImage from "@/components/ProductImage";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

/** Recent campaigns as a hairline-ruled list — click a row to restore it. */
export default function HistoryStrip({
  entries,
  activeId,
  onRestore,
  onClear,
}: {
  entries: HistoryEntry[];
  activeId: string | null;
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between pb-3">
        <span className="label">Recent campaigns</span>
        <button type="button" onClick={onClear} className="link">
          Clear
        </button>
      </div>
      <ul>
        {entries.map((entry) => {
          const lead = PRODUCTS.find((p) => p.id === entry.productIds[0]);
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id} className="rule-dashed">
              <button
                type="button"
                onClick={() => onRestore(entry)}
                className="flex w-full items-center gap-3 py-3 text-left transition-opacity hover:opacity-100"
                style={{ opacity: isActive ? 1 : 0.75 }}
              >
                <span className="h-10 w-10 shrink-0">
                  {lead && (
                    <ProductImage
                      product={lead}
                      className="h-full w-full"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="label truncate">
                    {entry.label ?? entry.productNames.join(" + ")} ·{" "}
                    {entry.vibe}
                  </span>
                  <span
                    className="body-sm truncate"
                    style={{ color: "var(--fg-70)", fontSize: 13 }}
                  >
                    {entry.campaignAngle || entry.caption}
                  </span>
                </span>
                <span
                  className="label-sm shrink-0"
                  style={{ color: "var(--fg-50)" }}
                >
                  {relativeTime(entry.timestamp)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
