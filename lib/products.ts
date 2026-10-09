// mdlondon product catalogue for MD Creative.
// Image URLs are the real product shots served from mdlondon's Shopify CDN.
// Names, prices and bundle contents checked against the live store's
// products.json on 9 Oct 2026; live prices refresh hourly (lib/livePrices).

export const VIBES = [
  "Morning Routine",
  "Date Night",
  "Bad Hair Day Fix",
  "Professional",
  "Weekend Glam",
] as const;

export type Vibe = (typeof VIBES)[number];

export const HAIR_CONCERNS = [
  "Frizzy",
  "Fine & Flat",
  "Curly",
  "Thick",
  "Dry & Damaged",
] as const;

export type HairConcern = (typeof HAIR_CONCERNS)[number];

export type ProductCategory = "tool" | "number";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  /** Price in GBP (as of the date above; live prices override at runtime). */
  price: number;
  /** Pre-sale price when the store shows the product as reduced. */
  wasPrice?: number;
  /**
   * Approximate real-world height in cm. Used to size products proportionally
   * to one another in multi-product composites, so a small spray no longer
   * renders nearly as tall as a hair dryer. Estimates, not spec-sheet exact.
   */
  heightCm: number;
  tagline: string;
  imageUrl: string;
  hairConcerns: HairConcern[];
  bestFor: Vibe[];
  productUrl: string;
}

/** A short-form TikTok script — mdlondon's primary social surface. */
export interface TiktokScript {
  hook: string;
  step1: string;
  step2: string;
  cta: string;
  audio_vibe: string;
}

/** The copy payload returned by /api/generate-copy. */
export interface GeneratedCopy {
  instagramCaption: string;
  hashtags: string[];
  adCopy: [string, string, string];
  campaignAngle: string;
  creativeDirection: string;
  audienceTargeting: string;
  bestPlatform: string;
  ctaRecommendation: string;
  scene_for_image_gen: string;
  /** The forced visual-style category used for the scene, e.g. "studio-editorial". */
  visual_style: string;
  tiktok_script: TiktokScript;
  /** Which Groq model produced this copy — "fallback" when the primary was rate-limited. */
  model_used?: "primary" | "fallback";
}

/** The image payload returned by /api/generate-image. */
export interface GeneratedImage {
  imageUrl: string;
}

export const PRODUCTS: Product[] = [
  // ── TOOLS ──────────────────────────────────────────────────────────────
  {
    id: "blow",
    name: "BLOW",
    category: "tool",
    price: 199,
    heightCm: 24,
    tagline: "Lightweight, quiet, ionic hair dryer for a faster, smoother finish.",
    imageUrl:
      "https://mdlondon.com/cdn/shop/files/BLOW-v3-Casal-Blue-Product-2.webp?v=1770219384",
    hairConcerns: ["Frizzy", "Fine & Flat", "Thick", "Dry & Damaged"],
    bestFor: ["Morning Routine", "Professional", "Weekend Glam"],
    productUrl: "https://mdlondon.com/products/blow-hair-dryer",
  },
  {
    id: "wave",
    name: "WAVE",
    category: "tool",
    price: 129,
    heightCm: 30,
    tagline: "Heated barrel brush multi-styler — dry, smooth and shape in one pass.",
    imageUrl:
      "https://mdlondon.com/cdn/shop/files/MDL1003CWAVECASALBLUE003.jpg?v=1772636263",
    hairConcerns: ["Fine & Flat", "Frizzy", "Thick"],
    bestFor: ["Morning Routine", "Weekend Glam", "Date Night"],
    productUrl: "https://mdlondon.com/products/wave-heated-barrel-brush-multi-styler",
  },
  {
    id: "strait",
    name: "STRAIT",
    category: "tool",
    price: 80,
    wasPrice: 119,
    heightCm: 28,
    tagline: "Slim straightener with floating plates for snag-free, even heat.",
    imageUrl:
      "https://mdlondon.com/cdn/shop/files/2mdlondon-strait-hair-straigteners-olive-green-product-1_2f98cb2f-814c-4a93-b61d-e33f76ac93a2-_1.jpg?v=1772636318",
    hairConcerns: ["Frizzy", "Fine & Flat", "Curly"],
    bestFor: ["Morning Routine", "Professional", "Date Night"],
    productUrl: "https://mdlondon.com/products/strait-hair-straighteners",
  },
  {
    id: "phat",
    name: "PHAT",
    category: "tool",
    price: 85,
    wasPrice: 129,
    heightCm: 29,
    tagline: "Extra-wide straightener that gets through thick hair in fewer strokes.",
    imageUrl:
      "https://mdlondon.com/cdn/shop/files/c01a7163-e971-4507-ada8-31038b81b51c_ebdc509f-ffae-4721-99db-1ab41ab36346.jpg?v=1770218462",
    hairConcerns: ["Thick", "Curly", "Frizzy"],
    bestFor: ["Morning Routine", "Professional", "Weekend Glam"],
    productUrl: "https://mdlondon.com/products/phat-hair-straighteners",
  },
  {
    id: "curl",
    name: "CURL",
    category: "tool",
    price: 129,
    heightCm: 30,
    tagline: "Multi curling wand with a right-angled design for effortless control.",
    imageUrl:
      "https://mdlondon.com/cdn/shop/files/CURL_white_background_1.png?v=1773847387",
    hairConcerns: ["Fine & Flat", "Thick", "Curly"],
    bestFor: ["Date Night", "Weekend Glam", "Professional"],
    productUrl: "https://mdlondon.com/products/curl-multi-curling-wand",
  },
  {
    id: "brush",
    name: "BRUSH",
    category: "tool",
    price: 13,
    heightCm: 22,
    tagline: "Vented brush that speeds up blow-drying and detangles wet or dry.",
    imageUrl:
      "https://mdlondon.com/cdn/shop/files/4fcfc1a7-c8ba-4dd1-9733-f20a58caae3e_5ad62b1a-fa18-480b-b41e-7cc6e8d52d62.jpg?v=1770218409",
    hairConcerns: ["Frizzy", "Thick", "Dry & Damaged"],
    bestFor: ["Morning Routine", "Bad Hair Day Fix"],
    productUrl: "https://mdlondon.com/products/brush-vent",
  },

  // ── THE NUMBERS (styling range, £15 each) ──────────────────────────────
  {
    id: "the-1",
    name: "THE 1",
    category: "number",
    price: 15,
    heightCm: 17,
    tagline: "Hair Primer — heat protection and the prep that makes styling stick.",
    imageUrl: "https://mdlondon.com/cdn/shop/files/1-isolation.jpg?v=1774283695",
    hairConcerns: ["Frizzy", "Fine & Flat", "Curly", "Thick", "Dry & Damaged"],
    bestFor: ["Morning Routine", "Professional", "Weekend Glam"],
    productUrl: "https://mdlondon.com/products/the-1",
  },
  {
    id: "the-2",
    name: "THE 2",
    category: "number",
    price: 15,
    heightCm: 17,
    tagline: "Volume & Shine Blow-Out Spray for a smooth, never-crunchy finish.",
    imageUrl: "https://mdlondon.com/cdn/shop/files/2-isolation.jpg?v=1774283695",
    hairConcerns: ["Fine & Flat", "Frizzy"],
    bestFor: ["Morning Routine", "Professional", "Weekend Glam"],
    productUrl: "https://mdlondon.com/products/the-2",
  },
  {
    id: "the-3",
    name: "THE 3",
    category: "number",
    price: 15,
    heightCm: 18,
    tagline: "Volume, Curls & Waves Mousse that builds body without the crunch.",
    imageUrl: "https://mdlondon.com/cdn/shop/files/3-isolation.jpg?v=1774282412",
    hairConcerns: ["Curly", "Fine & Flat"],
    bestFor: ["Weekend Glam", "Date Night", "Morning Routine"],
    productUrl: "https://mdlondon.com/products/the-3",
  },
  {
    id: "the-4",
    name: "THE 4",
    category: "number",
    price: 15,
    heightCm: 18,
    tagline: "Hairspray That Holds — sets the style and stays put, brushes out clean.",
    imageUrl: "https://mdlondon.com/cdn/shop/files/4-isolation.jpg?v=1773854730",
    hairConcerns: ["Fine & Flat", "Thick", "Frizzy"],
    bestFor: ["Date Night", "Professional", "Weekend Glam"],
    productUrl: "https://mdlondon.com/products/the-4",
  },
  {
    id: "the-5",
    name: "THE 5",
    category: "number",
    price: 15,
    heightCm: 17,
    tagline: "Voluminous Texture — a dry shampoo and texturiser in one for instant lift.",
    imageUrl: "https://mdlondon.com/cdn/shop/files/5-isolation.jpg?v=1774280188",
    hairConcerns: ["Fine & Flat", "Dry & Damaged"],
    bestFor: ["Bad Hair Day Fix", "Weekend Glam", "Morning Routine"],
    productUrl: "https://mdlondon.com/products/the-5",
  },
  {
    id: "the-6",
    name: "THE 6",
    category: "number",
    price: 15,
    heightCm: 13,
    tagline: "A Settling Finish cream clay to smooth flyaways and define the ends.",
    imageUrl: "https://mdlondon.com/cdn/shop/files/6-isolation.jpg?v=1774283695",
    hairConcerns: ["Frizzy", "Thick", "Curly"],
    bestFor: ["Professional", "Date Night", "Bad Hair Day Fix"],
    productUrl: "https://mdlondon.com/products/the-6",
  },

  // ── THE NUMBERS 7–12 (second drop) ─────────────────────────────────────
  {
    id: "the-7",
    name: "THE 7",
    category: "number",
    price: 15,
    heightCm: 18,
    tagline: "The Humidity Shield — a heat-activated barrier so the blow-dry lasts, whatever the weather.",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0571/0158/2517/files/The7HumidityWallbymdlondon2.jpg?v=1789737262",
    hairConcerns: ["Frizzy", "Thick", "Fine & Flat"],
    bestFor: ["Morning Routine", "Professional", "Date Night"],
    productUrl: "https://mdlondon.com/products/the-7",
  },
  {
    id: "the-8",
    name: "THE 8",
    category: "number",
    price: 15,
    heightCm: 19,
    tagline: "Dry Heat Protection — goes on dry hair and flashes off in seconds, protected before the first pass.",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0571/0158/2517/files/The8-DryHeatProtectionSpray_919df6f4-64b9-4478-9a6c-3a5e918dc88c.jpg?v=1789737262",
    hairConcerns: ["Dry & Damaged", "Fine & Flat", "Thick"],
    bestFor: ["Morning Routine", "Professional", "Bad Hair Day Fix"],
    productUrl: "https://mdlondon.com/products/the-8",
  },
  {
    id: "the-9",
    name: "THE 9",
    category: "number",
    price: 15,
    heightCm: 18,
    tagline: "More Curls Gel — clumps strands into defined, frizz-free curls that hold for days.",
    imageUrl: "https://cdn.shopify.com/s/files/1/0571/0158/2517/files/The9-CurlGel.jpg?v=1789737262",
    hairConcerns: ["Curly", "Frizzy"],
    bestFor: ["Weekend Glam", "Date Night", "Morning Routine"],
    productUrl: "https://mdlondon.com/products/the-9",
  },
  {
    id: "the-10",
    name: "THE 10",
    category: "number",
    price: 15,
    heightCm: 12,
    tagline: "Pre & Post Oil — glass-like shine and softness that won’t undo your style.",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0571/0158/2517/files/The10-Pre_PostOil2.jpg?v=1789737262",
    hairConcerns: ["Dry & Damaged", "Frizzy", "Thick"],
    bestFor: ["Date Night", "Weekend Glam", "Professional"],
    productUrl: "https://mdlondon.com/products/the-10",
  },
  {
    id: "the-11",
    name: "THE 11",
    category: "number",
    price: 15,
    heightCm: 12,
    tagline: "Dry Cleaning — a precision-pump dry shampoo with actual hold, and actual control.",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0571/0158/2517/files/The11-DryCleaning.jpg?v=1789737262",
    hairConcerns: ["Fine & Flat"],
    bestFor: ["Bad Hair Day Fix", "Morning Routine"],
    productUrl: "https://mdlondon.com/products/the-11",
  },
  {
    id: "the-12",
    name: "THE 12",
    category: "number",
    price: 15,
    heightCm: 20,
    tagline: "Salt Mousse — beachy texture with real grip. Undone, never crunchy.",
    imageUrl:
      "https://cdn.shopify.com/s/files/1/0571/0158/2517/files/The12-SeaSaltMousse.jpg?v=1789737262",
    hairConcerns: ["Fine & Flat", "Curly"],
    bestFor: ["Weekend Glam", "Bad Hair Day Fix"],
    productUrl: "https://mdlondon.com/products/the-12",
  },
];

/** The Shopify handle a product's live price is looked up by. */
export function storeHandle(p: Product): string {
  return p.productUrl.split("/products/")[1];
}

/**
 * mdlondon's own bundles — real routines with real prices, from the live
 * store. Picking one selects exactly its products, and the copy can quote
 * the bundle and its saving instead of inventing a kit.
 */
export interface Routine {
  id: string;
  name: string;
  productIds: string[];
  price: number;
  wasPrice: number;
  url: string;
}

export const ROUTINES: Routine[] = [
  { id: "volume", name: "Volume + Body", productIds: ["the-1", "the-2", "the-5", "the-12"], price: 50, wasPrice: 60, url: "https://mdlondon.com/products/volume-bundle" },
  { id: "curls", name: "Defined Curls", productIds: ["the-1", "the-3", "the-6", "the-9"], price: 50, wasPrice: 60, url: "https://mdlondon.com/products/defined-curls-bundle" },
  { id: "gloss", name: "Frizz Free, Gloss + Shine", productIds: ["the-1", "the-2", "the-7", "the-10"], price: 50, wasPrice: 60, url: "https://mdlondon.com/products/frizz-free-gloss-bundle" },
  { id: "lasting", name: "Lasting Style", productIds: ["the-1", "the-2", "the-7", "the-4"], price: 50, wasPrice: 60, url: "https://mdlondon.com/products/lasting-style-bundle" },
  { id: "heat", name: "Heat Protection + Shine", productIds: ["the-1", "the-2", "the-10", "the-8"], price: 50, wasPrice: 60, url: "https://mdlondon.com/products/protect-and-shine-bundle" },
  { id: "curl-blow", name: "Frizz Free Curl — BLOW", productIds: ["blow", "brush", "the-1", "the-3", "the-6", "the-9"], price: 185, wasPrice: 272, url: "https://mdlondon.com/products/frizz-free-curl-blow-bundle" },
  { id: "all-12", name: "ALL 12", productIds: ["the-1", "the-2", "the-3", "the-4", "the-5", "the-6", "the-7", "the-8", "the-9", "the-10", "the-11", "the-12"], price: 150, wasPrice: 180, url: "https://mdlondon.com/products/all-12" },
];

/** The official routine whose products are exactly this selection, if any. */
export function matchRoutine(ids: readonly string[]): Routine | null {
  const set = new Set(ids);
  return (
    ROUTINES.find(
      (r) => r.productIds.length === set.size && r.productIds.every((id) => set.has(id)),
    ) ?? null
  );
}

/**
 * Human label for a selection: "BLOW" / "BLOW + THE 2" / "5-piece edit" /
 * "Full Range". "Full Range" means every product — one rule, used everywhere.
 */
export function campaignLabel(products: Product[]): string {
  if (products.length === 1) return products[0].name;
  if (products.length === PRODUCTS.length) return "Full Range";
  const routine = matchRoutine(products.map((p) => p.id));
  if (routine) return routine.name;
  if (products.length >= 5) return `${products.length}-piece edit`;
  return products.map((p) => p.name).join(" + ");
}
