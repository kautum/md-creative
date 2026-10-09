"use client";

import { useState } from "react";
import type { Product, GeneratedCopy } from "@/lib/products";

interface RefineChatProps {
  products: Product[];
  vibe: string;
  hairConcern: string | null;
  currentCopy: GeneratedCopy;
  onRefined: (newCopy: GeneratedCopy) => void;
}

const MAX_CHARS = 300; // mirrors the API's limit
const SUGGESTIONS = ["Make it punchier", "More British", "Cut the caption in half"];

export default function RefineChat({
  products,
  vibe,
  hairConcern,
  currentCopy,
  onRefined,
}: RefineChatProps) {
  const [input, setInput] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (text: string) => {
    const request = text.trim();
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
          hairConcern: hairConcern ?? undefined,
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
      setApplied((h) => [request, ...h].slice(0, 5));
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <span className="label">Refine the copy</span>
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(input);
        }}
      >
        <input
          type="text"
          value={input}
          maxLength={MAX_CHARS}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          aria-label="Refine request"
          placeholder="Tell it what to change…"
          className="input-line pr-24 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || input.trim() === ""}
          className="label absolute bottom-2.5 right-0 disabled:opacity-40"
        >
          {loading ? "Refining…" : "Apply →"}
        </button>
      </form>
      <div className="flex flex-wrap gap-[10px]">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="chip"
            disabled={loading}
            onClick={() => void submit(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="body-sm">
          {error}
        </p>
      )}
      {applied.length > 0 && (
        <ul className="flex flex-col">
          {applied.map((h, i) => (
            <li
              key={`${h}-${i}`}
              className="rule-dashed flex items-baseline justify-between gap-3 py-2"
            >
              <span className="body-sm" style={{ color: "var(--fg-70)" }}>
                {h}
              </span>
              <span className="label-sm">Applied</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
