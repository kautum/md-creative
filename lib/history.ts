// Recent-campaigns history, persisted to localStorage so a marketing user can
// revisit and restore their last few generations.

import type { GeneratedCopy } from "@/lib/products";

export interface HistoryEntry {
  id: string;
  productIds: string[]; // restores the full selection on click
  productNames: string[];
  label?: string; // campaignLabel() at save time; absent on v1 entries

  productImage: string; // first product's image, for the thumbnail
  vibe: string;
  hairConcern: string | null;
  campaignAngle: string;
  caption: string;
  copy: GeneratedCopy; // full copy payload so the output restores exactly
  imageUrl: string | null;
  timestamp: number;
}

const KEY = "md-creative-history";
const MAX = 6;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Drop legacy/malformed entries (older single-product shape) so the strip
    // never renders against a missing field.
    return parsed.filter(
      (e): e is HistoryEntry =>
        !!e &&
        Array.isArray((e as HistoryEntry).productNames) &&
        Array.isArray((e as HistoryEntry).productIds),
    );
  } catch {
    return [];
  }
}

/** Prepend a new entry and keep only the most recent MAX. Returns the new list. */
export function pushHistory(
  entries: HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  const next = [entry, ...entries].slice(0, MAX);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage full / disabled — keep the in-memory list anyway.
    }
  }
  return next;
}

/** Replace one entry's copy (after a refine) and persist. Returns the new list. */
export function updateHistoryCopy(
  entries: HistoryEntry[],
  id: string,
  copy: GeneratedCopy,
): HistoryEntry[] {
  const next = entries.map((e) =>
    e.id === id
      ? {
          ...e,
          copy,
          campaignAngle: copy.campaignAngle,
          caption: copy.instagramCaption,
        }
      : e,
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // storage full / disabled — keep the in-memory list anyway.
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
