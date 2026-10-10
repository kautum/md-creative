"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { campaignLabel, matchRoutine, type Product } from "@/lib/products";
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
  hasCampaign,
  onGenerate,
}: {
  products: Product[];
  hasVibe: boolean;
  isGenerating: boolean;
  hasCampaign: boolean;
  onGenerate: () => void;
}) {
  const [briefInView, setBriefInView] = useState(false);
  const reduced = useReducedMotion();

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
  const routine = matchRoutine(products.map((p) => p.id));
  // Once a campaign is on screen it has its own controls; the capsule's job
  // (getting you from a selection to a campaign) is done.
  const visible = products.length > 0 && !briefInView && !hasCampaign;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          // Materialises (SKILL.md §12): rises from the edge it leaves by,
          // scaling and unblurring together, on a critically damped spring
          // (§4: bounce 0, response 0.4s). Reduced motion: a plain cross-fade.
          initial={reduced ? { opacity: 0 } : { y: 40, scale: 0.94, opacity: 0, filter: "blur(8px)" }}
          animate={reduced ? { opacity: 1 } : { y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { y: 40, scale: 0.94, opacity: 0, filter: "blur(8px)" }}
          transition={reduced ? { duration: 0.2 } : { type: "spring", bounce: 0, visualDuration: 0.4 }}
          className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
        >
          <div
            className="material flex max-w-full items-center gap-4 py-2 pl-3 pr-2"
            style={{
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--line)",
              // A bigger floating surface reads as thicker: a soft shadow.
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 10px 30px rgba(27,53,119,0.12)",
            }}
          >
            <div className="flex -space-x-2">
              {products.slice(0, MAX_THUMBS).map((p) => (
                <span
                  key={p.id}
                  className="flex h-9 w-9 items-center justify-center rounded-full p-1"
                  style={{ background: "var(--raised)", border: "1px solid var(--blue)" }}
                >
                  <ProductImage product={p} className="h-full w-full" />
                </span>
              ))}
              {products.length > MAX_THUMBS && (
                <span
                  className="label-sm flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: "var(--raised)", border: "1px solid var(--line)" }}
                >
                  +{products.length - MAX_THUMBS}
                </span>
              )}
            </div>
            <div className="hidden min-w-0 flex-col sm:flex">
              <span className="label truncate">{campaignLabel(products)}</span>
              <span className="label-sm" style={{ color: "var(--fg-50)" }}>
                {routine
                  ? `£${routine.price} bundle · save £${routine.wasPrice - routine.price}`
                  : `£${total} · ${products.length} ${products.length === 1 ? "product" : "products"}`}
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
