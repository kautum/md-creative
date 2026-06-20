// Recent-campaigns history, persisted to localStorage so a marketing user can
// revisit and restore their last few generations.

import type { GeneratedCopy } from "@/lib/products";

export interface HistoryEntry {
  id: string;
  productId: string; // restores the full Product on click
  productName: string;
  productImage: string;
  vibe: string;
  hairConcern: string | null;
  campaignAngle: string;
  caption: string;
  copy: GeneratedCopy; // full copy payload so the output restores exactly
  imageUrl: string | null;
  timestamp: number;
}

const KEY = "md-creative-history";
const MAX = 3;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
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

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
