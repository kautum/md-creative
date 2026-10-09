// Live prices from mdlondon's own store (Shopify's public products.json),
// cached for an hour. Prices drift — v2 shipped five stale tool prices — so
// the static catalogue is only the fallback, and the UI says when it's used.
//
// Server-only: called by /api/catalogue (for the page) and the copy route
// (so ads quote the price a customer will actually see).

import { PRODUCTS, storeHandle } from "@/lib/products";

const STORE_URL = "https://mdlondon.com/products.json?limit=250";
const HOME_URL = "https://mdlondon.com/";
const MAX_PROMOTIONS = 4;
const REVALIDATE_SECONDS = 3600;
export const STATIC_PRICES_AS_OF = "9 Oct 2026";

export interface LivePrice {
  price: number;
  wasPrice?: number;
  available: boolean;
}

export interface LiveCatalogue {
  source: "live" | "static";
  prices: Record<string, LivePrice>; // keyed by our product id
  /** The store's announcement-bar promotions right now ([] if unknown). */
  promotions: string[];
  asOf: string;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&#39;": "'", "&quot;": '"', "&nbsp;": " ", "&pound;": "£" };

/**
 * The promotions in the store's announcement bar ("3 FOR 2 ON NUMBERS…").
 * Failing safe matters here: on any problem this returns [] — the copy then
 * mentions no promotion, rather than one that may have ended.
 */
async function getLivePromotions(): Promise<string[]> {
  try {
    const res = await fetch(HOME_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "md-creative (+https://md-creative.vercel.app)" },
    });
    if (!res.ok) throw new Error(`home responded ${res.status}`);
    const html = await res.text();
    const found = [...html.matchAll(/class="announcement-bar__text"[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) =>
        m[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&[#a-z0-9]+;/gi, (e) => ENTITIES[e] ?? " ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter((t) => t.length >= 4 && t.length <= 90);
    return [...new Set(found)].slice(0, MAX_PROMOTIONS);
  } catch (err) {
    console.warn("[livePrices] no promotions:", err);
    return [];
  }
}

interface StoreVariant {
  price?: unknown;
  compare_at_price?: unknown;
  available?: unknown;
}

function money(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Live prices, or a clearly labelled static fallback — never a silent mix-up. */
export async function getLiveCatalogue(): Promise<LiveCatalogue> {
  const promotions = await getLivePromotions();
  const fallback: LiveCatalogue = { source: "static", prices: {}, promotions, asOf: STATIC_PRICES_AS_OF };
  let products: { handle?: unknown; variants?: unknown }[];
  try {
    const res = await fetch(STORE_URL, {
      next: { revalidate: REVALIDATE_SECONDS },
      headers: { "User-Agent": "md-creative (+https://md-creative.vercel.app)" },
    });
    if (!res.ok) throw new Error(`store responded ${res.status}`);
    const body = (await res.json()) as { products?: unknown };
    if (!Array.isArray(body.products)) throw new Error("no products array");
    products = body.products;
  } catch (err) {
    console.warn("[livePrices] falling back to static prices:", err);
    return fallback;
  }

  const prices: Record<string, LivePrice> = {};
  for (const p of PRODUCTS) {
    const match = products.find((s) => s.handle === storeHandle(p));
    const variants = (Array.isArray(match?.variants) ? match.variants : []) as StoreVariant[];
    const offered = variants.filter((v) => v.available === true);
    const pool = offered.length ? offered : variants;
    const amounts = pool.map((v) => money(v.price)).filter((n): n is number => n !== null);
    if (amounts.length === 0) {
      console.warn(`[livePrices] no usable price for ${p.id} — keeping static £${p.price}`);
      continue;
    }
    const price = Math.min(...amounts);
    const was = pool.map((v) => money(v.compare_at_price)).filter((n): n is number => n !== null);
    const wasPrice = was.length && Math.max(...was) > price ? Math.max(...was) : undefined;
    prices[p.id] = { price, ...(wasPrice ? { wasPrice } : {}), available: offered.length > 0 };
  }
  return { source: "live", prices, promotions, asOf: new Date().toISOString() };
}
