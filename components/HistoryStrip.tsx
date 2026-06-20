/* eslint-disable @next/next/no-img-element */
"use client";

import type { HistoryEntry } from "@/lib/history";

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

export default function HistoryStrip({
  entries,
  onRestore,
  onClear,
}: {
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--accent)" }}
          />
          <span
            className="font-heading text-xs font-medium uppercase tracking-[0.25em]"
            style={{ color: "var(--text-muted)" }}
          >
            Recent Campaigns
          </span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-[11px] uppercase tracking-[0.15em] transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--text-primary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
        >
          Clear
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onRestore(entry)}
            className="flex shrink-0 items-center gap-3 p-3 text-left transition-colors"
            style={{
              width: 210,
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
          >
            <img
              src={entry.productImage}
              alt={entry.productName}
              className="shrink-0 rounded-md object-contain"
              style={{
                width: 40,
                height: 40,
                backgroundColor: "var(--bg-surface-2)",
              }}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-baseline gap-1.5">
                <span
                  className="font-heading truncate text-xs font-medium tracking-wide"
                  style={{ color: "var(--text-primary)" }}
                >
                  {entry.productName}
                </span>
                <span
                  className="truncate text-[10px]"
                  style={{ color: "var(--accent)" }}
                >
                  {entry.vibe}
                </span>
              </span>
              <span
                className="truncate text-[11px] leading-snug"
                style={{ color: "var(--text-muted)" }}
              >
                {entry.campaignAngle || entry.caption}
              </span>
              <span
                className="text-[10px]"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {relativeTime(entry.timestamp)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
