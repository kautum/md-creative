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

const cache = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();

// Downscale before processing — the cutout only ever renders small (a 288px
// card / phone frame), and a 700px flood-fill is ~10x faster than full-res.
const MAX_DIM = 700;
// Max per-step colour distance for a pixel to count as "more background".
// 8 follows smooth gradients without leaking across the product edge (12 leaked
// into BLOW's low-contrast blue body in testing).
const NEIGHBOR_TOL = 8;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cutout: failed to load ${url}`));
    img.src = url;
  });
}

async function computeCutout(url: string): Promise<string | null> {
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

    // Seed every border pixel.
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

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Returns a transparent-background PNG data URL for a product image, or null if
 * the cutout can't be produced (CORS / load failure / degenerate result).
 * Result is memoised per URL so it's computed at most once.
 */
export function getProductCutout(url: string): Promise<string | null> {
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
