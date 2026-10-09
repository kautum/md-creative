/* eslint-disable @next/next/no-img-element */
"use client";

import type { Product } from "@/lib/products";
import { getCutout } from "@/lib/cutout";

// Fixed flat-lay arrangements per product count (2-4). `left`/`top` are the % of
// the container the product is CENTRED on; `rotate` tilts it; `depth` is a
// front/back prominence factor (front items slightly larger). Deliberately NOT
// randomised so the composite always reads as intentional, never chaotic.
export type SlotPos = {
  left: number;
  top: number;
  rotate: number;
  depth: number;
};

export const FLATLAY_LAYOUTS: Record<number, SlotPos[]> = {
  2: [
    { left: 63, top: 52, rotate: 7, depth: 0.82 }, // right, back
    { left: 39, top: 58, rotate: -6, depth: 1.0 }, // left, front
  ],
  3: [
    { left: 27, top: 44, rotate: -8, depth: 0.82 }, // upper-left, back
    { left: 73, top: 44, rotate: 8, depth: 0.82 }, // upper-right, back
    { left: 50, top: 66, rotate: -2, depth: 1.0 }, // centred-low, front
  ],
  4: [
    { left: 32, top: 42, rotate: -5, depth: 0.85 },
    { left: 67, top: 40, rotate: 5, depth: 0.85 },
    { left: 33, top: 68, rotate: -3, depth: 1.0 },
    { left: 67, top: 66, rotate: 6, depth: 1.0 },
  ],
};

// Single hero product, sat slightly below centre — these scenes tend to place a
// surface/pedestal in the lower-centre, so this grounds better than dead centre.
const HERO_POS: SlotPos = { left: 50, top: 56, rotate: 0, depth: 1.0 };

// Render height (% of container height) of the TALLEST product in a front slot.
// Everything else scales down from this by real size + slot depth. Exported so
// the downloaded composite can match the on-screen shadow prominence exactly.
export const BASE_MAX_HEIGHT = 60;

/** One product's resolved placement + real-scale render height. */
export interface CompositeSlot {
  product: Product;
  left: number;
  top: number;
  rotate: number;
  depth: number;
  /** Render height as a % of the container height. */
  heightPct: number;
}

/**
 * Resolve the placement + proportional size of each product in the composite.
 * The tallest selected product anchors the max size; the rest scale down by
 * their real-world height, so a small spray no longer rivals a hair dryer.
 * Shared by the on-screen overlay and the downloaded PNG so they always match.
 */
export function getCompositeLayout(products: Product[]): CompositeSlot[] {
  const n = products.length;
  if (n === 0 || n >= 5) return [];
  const layout = n === 1 ? [HERO_POS] : (FLATLAY_LAYOUTS[n] ?? []);
  const maxCm = Math.max(...products.map((p) => p.heightCm));
  const slots: CompositeSlot[] = [];
  products.forEach((product, i) => {
    const pos = layout[i];
    if (!pos) return;
    const rel = product.heightCm / maxCm;
    slots.push({
      product,
      left: pos.left,
      top: pos.top,
      rotate: pos.rotate,
      depth: pos.depth,
      heightPct: BASE_MAX_HEIGHT * pos.depth * rel,
    });
  });
  return slots;
}

// Subtle edge definition on the cutout itself (NOT the ground contact).
const EDGE_SHADOW = "drop-shadow(0 2px 3px rgba(0,0,0,0.28))";

function PositionedProduct({ slot }: { slot: CompositeSlot }) {
  const cutout = getCutout(slot.product.id);
  // Prominence (0–1): bigger / front-most products cast a stronger contact shadow.
  const prominence = Math.min(1, slot.heightPct / BASE_MAX_HEIGHT);
  const shadowOpacity = 0.22 + 0.24 * prominence;

  return (
    <div
      className="absolute"
      style={{
        left: `${slot.left}%`,
        top: `${slot.top}%`,
        height: `${slot.heightPct}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Synthetic contact shadow — an ellipse scaled to the product's real
          base footprint, sat at its base so it reads as grounded, not pasted. */}
      <div
        aria-hidden
        className="absolute"
        style={{
          left: "50%",
          bottom: 0,
          width: `${Math.max(20, cutout.footprint * 96)}%`,
          height: "13%",
          transform: "translate(-50%, 55%)",
          background: `radial-gradient(ellipse at center, rgba(0,0,0,${shadowOpacity.toFixed(
            2,
          )}) 0%, rgba(0,0,0,0) 70%)`,
          filter: "blur(3px)",
        }}
      />
      <img
        src={cutout.url}
        alt={slot.product.name}
        className="relative block object-contain"
        style={{
          height: "100%",
          width: "auto",
          maxWidth: "92%",
          transform: `rotate(${slot.rotate}deg)`,
          filter: EDGE_SHADOW,
        }}
      />
    </div>
  );
}

/**
 * Real product image(s) composited onto a scene. Tier 1 (1) → centred hero,
 * Tier 2 (2-4) → fixed flat-lay. 5+ or 0 → nothing (scene is pure atmosphere).
 * Each product is its pre-built cutout (lib/cutout), sized proportionally to
 * its real height and grounded with a contact shadow.
 */
export default function ProductOverlays({ products }: { products: Product[] }) {
  const slots = getCompositeLayout(products);
  return (
    <>
      {slots.map((slot) => (
        <PositionedProduct key={slot.product.id} slot={slot} />
      ))}
    </>
  );
}
