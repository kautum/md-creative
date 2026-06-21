/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/products";
import { getProductCutout } from "@/lib/cutout";

// Fixed flat-lay arrangements per product count (2-4). Coordinates are % of the
// container; each item is centred on (left,top) then rotated. Deliberately NOT
// randomised so the composite always reads as intentional, never chaotic.
export type FlatlayPos = {
  left: number;
  top: number;
  width: number;
  rotate: number;
};

export const FLATLAY_LAYOUTS: Record<number, FlatlayPos[]> = {
  2: [
    { left: 62, top: 50, width: 40, rotate: 8 }, // right, smaller (back)
    { left: 40, top: 56, width: 52, rotate: -6 }, // left, larger (front)
  ],
  3: [
    { left: 28, top: 40, width: 33, rotate: -8 }, // upper-left
    { left: 72, top: 40, width: 33, rotate: 8 }, // upper-right
    { left: 50, top: 64, width: 46, rotate: -2 }, // centred-low, larger (front)
  ],
  4: [
    { left: 33, top: 39, width: 37, rotate: -5 },
    { left: 66, top: 36, width: 35, rotate: 4 },
    { left: 32, top: 66, width: 36, rotate: -3 },
    { left: 68, top: 64, width: 35, rotate: 6 },
  ],
};

// Single hero product, sat slightly below centre — these scenes tend to place
// a surface/pedestal in the lower-centre, so this grounds better than dead
// centre (true scene-aware placement is the deferred planner's job).
const HERO_POS: FlatlayPos = { left: 50, top: 56, width: 58, rotate: 0 };

// Grounding shadow cast from the cutout's own silhouette — follows the real
// product shape, so it reads as a contact shadow rather than a pasted box.
const CUTOUT_SHADOW = "drop-shadow(0 18px 13px rgba(0,0,0,0.45))";
// Fallback (raw image, no cutout): keep the old multiply so the product at least
// drops its white box on light scenes.
const FALLBACK_SHADOW = "drop-shadow(0 10px 22px rgba(0,0,0,0.30))";

function PositionedProduct({
  product,
  pos,
  cutout,
}: {
  product: Product;
  pos: FlatlayPos;
  cutout: string | null | undefined;
}) {
  // undefined = still computing (render nothing yet, avoids a white-box flash);
  // null = cutout failed (fall back to raw image + multiply); string = cutout.
  if (cutout === undefined) return null;
  const hasCutout = typeof cutout === "string";
  return (
    <img
      src={hasCutout ? cutout : product.imageUrl}
      alt={product.name}
      className="absolute object-contain"
      style={{
        left: `${pos.left}%`,
        top: `${pos.top}%`,
        width: `${pos.width}%`,
        maxHeight: "72%",
        transform: `translate(-50%, -50%) rotate(${pos.rotate}deg)`,
        filter: hasCutout ? CUTOUT_SHADOW : FALLBACK_SHADOW,
        ...(hasCutout ? {} : { mixBlendMode: "multiply" as const }),
      }}
    />
  );
}

/**
 * Real product image(s) composited onto a scene. Tier 1 (1) → centred hero,
 * Tier 2 (2-4) → fixed flat-lay. 5+ or 0 → nothing (scene is pure atmosphere).
 * Each product is background-removed via a client-side cutout (see lib/cutout)
 * and grounded with a silhouette shadow — no mix-blend, so it holds up on dark
 * scenes and stays faithful to the actual product.
 */
export default function ProductOverlays({ products }: { products: Product[] }) {
  const n = products.length;
  const [cutouts, setCutouts] = useState<Record<string, string | null>>({});
  const ids = products.map((p) => p.id).join(",");

  useEffect(() => {
    if (n === 0 || n >= 5) return;
    let cancelled = false;
    Promise.all(
      products.map(async (p) => [p.id, await getProductCutout(p.imageUrl)] as const),
    ).then((entries) => {
      if (!cancelled) setCutouts(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, n]);

  if (n === 0 || n >= 5) return null;

  const layout = n === 1 ? [HERO_POS] : (FLATLAY_LAYOUTS[n] ?? []);
  return (
    <>
      {products.map((p, i) => {
        const pos = layout[i];
        if (!pos) return null;
        return (
          <PositionedProduct
            key={p.id}
            product={p}
            pos={pos}
            cutout={cutouts[p.id]}
          />
        );
      })}
    </>
  );
}
