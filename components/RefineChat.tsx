"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Product, GeneratedCopy } from "@/lib/products";

interface RefineChatProps {
  products: Product[];
  vibe: string;
  currentCopy: GeneratedCopy;
  onRefined: (newCopy: GeneratedCopy) => void;
}

export default function RefineChat({
  products,
  vibe,
  currentCopy,
  onRefined,
}: RefineChatProps) {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const request = input.trim();
    if (!request || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: products.map((p) => p.id),
          vibe,
          mode: "refine",
          existingCopy: currentCopy,
          refineRequest: request,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status}).`);
      }

      onRefined(data as GeneratedCopy);
      setHistory((h) => [request, ...h].slice(0, 5));
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <span
        className="font-heading text-xs font-medium uppercase tracking-[0.25em]"
        style={{ color: "var(--text-muted)" }}
      >
        Refine
      </span>

      {history.length > 0 && (
        <ul className="flex flex-col gap-2">
          {history.map((h, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border)",
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>{h}</span>
              <span
                className="shrink-0 text-[10px] uppercase tracking-[0.15em]"
                style={{ color: "var(--accent)" }}
              >
                ✓ Applied
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={loading}
          placeholder={'Try "make it punchier" or "cut the caption in half"'}
          className="flex-1 px-4 py-3 text-sm focus:outline-none disabled:opacity-50"
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || input.trim() === ""}
          className="font-heading px-6 py-3 text-xs font-medium uppercase tracking-[0.2em] transition-colors duration-200 disabled:opacity-40"
          style={{ backgroundColor: "var(--accent)", color: "#FFFFFF" }}
        >
          {loading ? "Refining..." : "Send"}
        </button>
      </div>

      {error && (
        <span className="text-xs" style={{ color: "var(--accent)" }}>
          {error}
        </span>
      )}
    </motion.div>
  );
}
