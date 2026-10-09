"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { campaignLabel, type Product } from "@/lib/products";
import ProductImage from "@/components/ProductImage";

const MAX_THUMBS = 4;

/**
 * Apple's floating price capsule, repurposed: once anything is selected, a
 * pill follows you down the page with the selection, its total, and the next
 * step. It steps aside while the brief itself is on screen.
 */
export default function SelectionCapsule({
  products,
  hasVibe,
  isGenerating,
  onGenerate,
}: {
  products: Product[];
  hasVibe: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
}) {
  const [briefInView, setBriefInView] = useState(false);

  useEffect(() => {
    const brief = document.getElementById("brief");
    if (!brief) return;
    const io = new IntersectionObserver(([e]) => setBriefInView(e.isIntersecting), {
      rootMargin: "-20% 0px -20% 0px",
    });
    io.observe(brief);
    return () => io.disconnect();
  }, []);

  const total = products.reduce((sum, p) => sum + p.price, 0);
  const visible = products.length > 0 && !briefInView;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
        >
          <div
            className="flex max-w-full items-center gap-4 py-2 pl-3 pr-2"
            style={{
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--cork)",
              background: "rgba(16,9,4,0.78)",
              backdropFilter: "blur(16px) saturate(140%)",
            }}
          >
            <div className="flex -space-x-2">
              {products.slice(0, MAX_THUMBS).map((p) => (
                <span
                  key={p.id}
                  className="flex h-9 w-9 items-center justify-center rounded-full p-1"
                  style={{ background: "var(--bark)", border: "1px solid var(--cork)" }}
                >
                  <ProductImage product={p} className="h-full w-full" />
                </span>
              ))}
              {products.length > MAX_THUMBS && (
                <span
                  className="label-sm flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "var(--bark)", border: "1px solid var(--cork)" }}
                >
                  +{products.length - MAX_THUMBS}
                </span>
              )}
            </div>
            <div className="hidden min-w-0 flex-col sm:flex">
              <span className="label truncate">{campaignLabel(products)}</span>
              <span className="label-sm" style={{ color: "var(--cream-50)" }}>
                £{total} · {products.length} {products.length === 1 ? "product" : "products"}
              </span>
            </div>
            {hasVibe ? (
              <button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating}
                className="btn-filled shrink-0"
                style={{ padding: "10px 18px", fontSize: 12 }}
              >
                {isGenerating ? "Generating…" : "Generate →"}
              </button>
            ) : (
              <a href="#brief" className="btn-filled shrink-0" style={{ padding: "10px 18px", fontSize: 12 }}>
                Set the brief →
              </a>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
