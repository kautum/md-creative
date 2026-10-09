"""Build high-quality transparent cutouts of every product, once, offline.

Why offline: the browser flood-fill in v1/v2 produced hard, aliased edges at
700px and bled into low-contrast products (BLOW's blue on a blue-grey
backdrop). Here an AI segmentation model gives a soft alpha matte from the
2048px source, and edge pixels are colour-decontaminated so no light halo
shows on the dark canvas.

    python -m venv .venv && .venv/bin/pip install "rembg[cpu]" scipy
    .venv/bin/python scripts/make_cutouts.py            # all products
    .venv/bin/python scripts/make_cutouts.py blow wave  # just these

Writes public/cutouts/<id>.webp and lib/cutouts.json ({id: {w, h, footprint}}).
"""

import io
import json
import re
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy.ndimage import gaussian_filter, label

ROOT = Path(__file__).resolve().parent.parent
PRODUCTS_TS = ROOT / "lib" / "products.ts"
OUT_DIR = ROOT / "public" / "cutouts"
META = ROOT / "lib" / "cutouts.json"

MODEL = "birefnet-general"
SOURCE_WIDTH = 2048  # Shopify CDN resize param; the originals are 2048²
MAX_SIDE = 1400  # plenty for a ~700px CSS render at 2x DPR
ALPHA_FLOOR = 8  # alpha below this is treated as background (kills wisps)
BG_SIGMA = 24  # px; scale of the local background-colour estimate
FOOTPRINT_BAND = 0.1  # bottom 10% of the product, as in lib/cutout.ts
EXPECTED_PRODUCTS = 12


def read_products() -> list[tuple[str, str]]:
    src = PRODUCTS_TS.read_text()
    pairs = re.findall(r'id: "([^"]+)",[\s\S]*?imageUrl:\s*"([^"]+)"', src)
    if len(pairs) != EXPECTED_PRODUCTS:
        raise SystemExit(f"expected {EXPECTED_PRODUCTS} products, parsed {len(pairs)}")
    return pairs


def fetch(url: str) -> Image.Image:
    sep = "&" if "?" in url else "?"
    req = urllib.request.Request(
        f"{url}{sep}width={SOURCE_WIDTH}", headers={"User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")


def decontaminate(rgb: np.ndarray, a: np.ndarray) -> np.ndarray:
    """Remove background colour mixed into semi-transparent edge pixels.

    Observed C = a*F + (1-a)*B. B is estimated locally by a normalised
    convolution over background-weighted pixels, then F = (C - (1-a)B) / a.
    """
    bg_w = 1.0 - a
    wsum = gaussian_filter(bg_w, BG_SIGMA) + 1e-6
    B = np.stack(
        [gaussian_filter(rgb[..., c] * bg_w, BG_SIGMA) / wsum for c in range(3)], -1
    )
    a3 = a[..., None]
    F = (rgb - (1.0 - a3) * B) / np.maximum(a3, 0.05)
    # Only rewrite the soft edge; solid pixels keep their exact colour.
    edge = (a3 > 0) & (a3 < 0.98)
    return np.where(edge, np.clip(F, 0, 1), rgb)


def keep_main_body(a: np.ndarray) -> np.ndarray:
    """Drop disconnected specks smaller than 0.2% of the main product."""
    labels, n = label(a > 0.5)
    if n <= 1:
        return a
    sizes = np.bincount(labels.ravel())[1:]
    keep = np.isin(labels, np.flatnonzero(sizes >= sizes.max() * 0.002) + 1)
    # Grow the kept region slightly so soft edges around it survive.
    keep = gaussian_filter(keep.astype(float), 2) > 0.01
    return a * keep


def process(session, pid: str, url: str) -> dict:
    src = fetch(url)
    cut = remove(src, session=session)  # RGBA with a soft matte
    arr = np.asarray(cut).astype(np.float64) / 255.0
    a = keep_main_body(arr[..., 3])
    a[a < ALPHA_FLOOR / 255] = 0
    rgb = decontaminate(np.asarray(src).astype(np.float64) / 255.0, a)

    ys, xs = np.nonzero(a)
    if len(xs) == 0:
        raise SystemExit(f"{pid}: model returned an empty matte")
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    a, rgb = a[y0 : y1 + 1, x0 : x1 + 1], rgb[y0 : y1 + 1, x0 : x1 + 1]
    h, w = a.shape

    band = a[h - max(1, round(h * FOOTPRINT_BAND)) :]
    cols = np.flatnonzero((band > 0.5).any(axis=0))
    footprint = (cols.max() - cols.min() + 1) / w if len(cols) else 0.6

    rgba = np.dstack([rgb, a])
    img = Image.fromarray((rgba * 255).round().astype(np.uint8), "RGBA")
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    img.save(OUT_DIR / f"{pid}.webp", "WEBP", quality=92, method=6)
    coverage = float((a > 0.5).mean())
    print(f"{pid:7s} {img.width}x{img.height} footprint={footprint:.2f} coverage={coverage:.2f}")
    return {"w": img.width, "h": img.height, "footprint": round(float(footprint), 3)}


def main() -> None:
    only = set(sys.argv[1:])
    products = [(i, u) for i, u in read_products() if not only or i in only]
    if only and len(products) != len(only):
        raise SystemExit(f"unknown product id(s) in {sorted(only)}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    meta = json.loads(META.read_text()) if META.exists() else {}
    session = new_session(MODEL)
    for pid, url in products:
        meta[pid] = process(session, pid, url)
    META.write_text(json.dumps(dict(sorted(meta.items())), indent=2) + "\n")


if __name__ == "__main__":
    main()
