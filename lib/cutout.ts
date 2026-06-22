// Client-side background removal for product shots.
//
// Why this exists: real AI compositing (Pollinations `kontext`/`nanobanana`) is
// gated behind the paid enter.pollinations.ai tier, and the only free img2img
// model (`klein`) re-invents the product — wrong colour, fake branding — which
// is unusable for a real brand. So we composite the ACTUAL product image onto
// the AI scene, and the one thing we need is a clean cutout that works on any
// background.
//
// A naive brightness threshold (the obvious approach) fails on mdlondon's
// Casal-Blue tools (BLOW/WAVE), which ship on a blue-grey GRADIENT backdrop, not
// pure white. Border flood-fill solves it: seed from the image edges and grow
// through pixels that are near-identical to their neighbour (small steps follow
// a smooth gradient), stopping at the sharp product edge. Tuned on the hardest
// real products; preserves the product, removes white AND gradient backgrounds.
//
// After the flood-fill we do two more passes:
//   1. Connected-components: discard small alpha "islands" not joined to the
//      main product blob — these are cut artifacts (e.g. a cord loop split into
//      floating squiggles), not real product detail.
//   2. Crop to the content bounding box and measure the base footprint width,
//      so callers can size the product by its real height and ground it with a
//      contact shadow scaled to the actual product.

/** A finished cutout: a cropped transparent PNG plus its base contact width. */
export interface CutoutResult {
  /** Transparent-background PNG, cropped tight to the product. */
  url: string;
  /** Base contact width as a fraction (0–1) of the cropped width — shadow sizing. */
  footprint: number;
}

const cache = new Map<string, CutoutResult | null>();
const pending = new Map<string, Promise<CutoutResult | null>>();

// Downscale before processing — the cutout only ever renders small (a 288px
// card / phone frame), and a 700px flood-fill is ~10x faster than full-res.
const MAX_DIM = 700;
// Max per-step colour distance for a pixel to count as "more background".
// 8 follows smooth gradients without leaking across the product edge (12 leaked
// into BLOW's low-contrast blue body in testing).
const NEIGHBOR_TOL = 8;
// An opaque island smaller than this fraction of the image, and not attached to
// the main product blob, is treated as a cut artifact and removed.
const MIN_FRAGMENT_FRAC = 0.004;
// Fraction of the product's height, measured up from the base, used to estimate
// the contact footprint width for the synthetic shadow.
const FOOTPRINT_BAND = 0.1;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cutout: failed to load ${url}`));
    img.src = url;
  });
}

async function computeCutout(url: string): Promise<CutoutResult | null> {
  if (typeof document === "undefined") return null;
  try {
    const img = await loadImage(url);
    const scale = Math.min(
      1,
      MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight),
    );
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);

    const imgData = ctx.getImageData(0, 0, w, h);
    const px = imgData.data;
    const n = w * h;

    // ── Pass 1: border flood-fill removes the background ──────────────────
    const seen = new Uint8Array(n);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;

    const push = (i: number) => {
      if (!seen[i]) {
        seen[i] = 1;
        queue[tail++] = i;
      }
    };

    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + (w - 1));
    }

    let removed = 0;
    while (head < tail) {
      const i = queue[head++];
      const o = i * 4;
      px[o + 3] = 0; // this pixel is background → transparent
      removed++;
      const r = px[o];
      const g = px[o + 1];
      const b = px[o + 2];
      const x = i % w;
      const y = (i / w) | 0;

      const tryN = (ni: number) => {
        if (seen[ni]) return;
        const no = ni * 4;
        if (
          Math.abs(px[no] - r) <= NEIGHBOR_TOL &&
          Math.abs(px[no + 1] - g) <= NEIGHBOR_TOL &&
          Math.abs(px[no + 2] - b) <= NEIGHBOR_TOL
        ) {
          push(ni);
        }
      };
      if (x + 1 < w) tryN(i + 1);
      if (x - 1 >= 0) tryN(i - 1);
      if (y + 1 < h) tryN(i + w);
      if (y - 1 >= 0) tryN(i - w);
    }

    // If essentially everything was removed, the cutout failed (e.g. an
    // already-transparent or very low-contrast image) — bail to the raw fallback.
    if (removed > n * 0.985) return null;

    // ── Pass 2: drop disconnected fragments (cut artifacts) ───────────────
    // Label connected components of the remaining opaque pixels (4-connectivity),
    // keep the largest (the product body), and erase any other component that's
    // below the size threshold — those are the stray cord/cable squiggles.
    const label = new Int32Array(n).fill(-1);
    const stack = new Int32Array(n);
    const compSize: number[] = [];
    let mainLabel = -1;
    let mainSize = 0;

    for (let i = 0; i < n; i++) {
      if (px[i * 4 + 3] === 0 || label[i] !== -1) continue;
      const lbl = compSize.length;
      let size = 0;
      let sp = 0;
      stack[sp++] = i;
      label[i] = lbl;
      while (sp > 0) {
        const p = stack[--sp];
        size++;
        const x = p % w;
        const y = (p / w) | 0;
        if (x + 1 < w) {
          const q = p + 1;
          if (label[q] === -1 && px[q * 4 + 3] !== 0) {
            label[q] = lbl;
            stack[sp++] = q;
          }
        }
        if (x - 1 >= 0) {
          const q = p - 1;
          if (label[q] === -1 && px[q * 4 + 3] !== 0) {
            label[q] = lbl;
            stack[sp++] = q;
          }
        }
        if (y + 1 < h) {
          const q = p + w;
          if (label[q] === -1 && px[q * 4 + 3] !== 0) {
            label[q] = lbl;
            stack[sp++] = q;
          }
        }
        if (y - 1 >= 0) {
          const q = p - w;
          if (label[q] === -1 && px[q * 4 + 3] !== 0) {
            label[q] = lbl;
            stack[sp++] = q;
          }
        }
      }
      compSize.push(size);
      if (size > mainSize) {
        mainSize = size;
        mainLabel = lbl;
      }
    }

    const minFragment = Math.max(n * MIN_FRAGMENT_FRAC, 24);
    for (let i = 0; i < n; i++) {
      const lbl = label[i];
      if (lbl !== -1 && lbl !== mainLabel && compSize[lbl] < minFragment) {
        px[i * 4 + 3] = 0;
      }
    }

    // ── Pass 3: tight bounding box + base footprint ───────────────────────
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    let opaque = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] !== 0) {
          opaque++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0 || opaque < n * 0.015) return null;

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    // Footprint: widest opaque span in the bottom band of the product.
    const bandTop = maxY - Math.max(1, Math.round(bh * FOOTPRINT_BAND));
    let fMinX = w;
    let fMaxX = -1;
    for (let y = bandTop; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (px[(y * w + x) * 4 + 3] !== 0) {
          if (x < fMinX) fMinX = x;
          if (x > fMaxX) fMaxX = x;
        }
      }
    }
    const footprint = fMaxX >= fMinX ? (fMaxX - fMinX + 1) / bw : 0.6;

    // Write back the cleaned alpha, then crop tight to the product.
    ctx.putImageData(imgData, 0, 0);
    const out = document.createElement("canvas");
    out.width = bw;
    out.height = bh;
    const octx = out.getContext("2d");
    if (!octx) return null;
    octx.drawImage(canvas, minX, minY, bw, bh, 0, 0, bw, bh);

    return { url: out.toDataURL("image/png"), footprint };
  } catch {
    return null;
  }
}

/**
 * Returns a cropped transparent-background PNG (plus its base footprint) for a
 * product image, or null if the cutout can't be produced (CORS / load failure /
 * degenerate result). Result is memoised per URL so it's computed at most once.
 */
export function getProductCutout(url: string): Promise<CutoutResult | null> {
  const hit = cache.get(url);
  if (hit !== undefined) return Promise.resolve(hit);
  const existing = pending.get(url);
  if (existing) return existing;

  const p = computeCutout(url).then((res) => {
    cache.set(url, res);
    pending.delete(url);
    return res;
  });
  pending.set(url, p);
  return p;
}
