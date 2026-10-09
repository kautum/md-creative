// Product cutouts — transparent WebPs built offline by scripts/make_cutouts.py
// (AI segmentation with a soft, colour-decontaminated alpha matte from the
// 2048px source). This replaces the in-browser flood-fill from v1/v2, which
// worked at 700px with hard edges and bled into low-contrast products.
//
// Static, same-origin files: no CORS, no canvas taint, no per-visit compute.

import CUTOUTS from "./cutouts.json";

export interface CutoutResult {
  /** Same-origin URL of the transparent, tightly cropped product image. */
  url: string;
  /** Base contact width as a fraction (0–1) of the width — shadow sizing. */
  footprint: number;
  /** Pixel size of the cutout file. */
  w: number;
  h: number;
}

const META: Record<string, { w: number; h: number; footprint: number }> =
  CUTOUTS;

/**
 * The cutout for a product id. Throws if it was never generated — a missing
 * cutout is a build mistake, not something to paper over with a white box.
 */
export function getCutout(productId: string): CutoutResult {
  const m = META[productId];
  if (!m) {
    throw new Error(
      `No cutout for product "${productId}" — run scripts/make_cutouts.py ${productId}`,
    );
  }
  return { url: `/cutouts/${productId}.webp`, ...m };
}
