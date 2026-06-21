// mdlondon product catalogue for MD Creative.
// Image URLs are the real product shots served from mdlondon's Shopify CDN
// (mdlondon.com/cdn/shop/files/...). All verified to return 200.

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
  /** Price in GBP. */
  price: number;
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
    price: 195,
    tagline: "Lightweight, quiet, ionic hair dryer for a faster, smoother finish.",
    imageUrl:
      "https://mdlondon.com/cdn/shop/files/BLOW-v3-Casal-Blue-Product-2.webp?v=1770219384",
    hairConcerns: ["Frizzy", "Fine & Flat", "Thick", "Dry & Damaged"],
    bestFor: ["Morning Routine", "Professional", "Weekend Glam"],
    productUrl: "https://mdlondon.com/products/blow",
  },
  {
    id: "wave",
    name: "WAVE",
    category: "tool",
    price: 125,
    tagline: "Heated barrel brush multi-styler — dry, smooth and shape in one pass.",
    imageUrl:
      "https://mdlondon.com/cdn/shop/files/MDL1003CWAVECASALBLUE003.jpg?v=1772636263",
    hairConcerns: ["Fine & Flat", "Frizzy", "Thick"],
    bestFor: ["Morning Routine", "Weekend Glam", "Date Night"],
    productUrl: "https://mdlondon.com/products/wave",
  },
  {
    id: "strait",
    name: "STRAIT",
    category: "tool",
    price: 109,
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
    price: 129,
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
    price: 99,
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
    tagline: "A Settling Finish cream clay to smooth flyaways and define the ends.",
    imageUrl: "https://mdlondon.com/cdn/shop/files/6-isolation.jpg?v=1774283695",
    hairConcerns: ["Frizzy", "Thick", "Curly"],
    bestFor: ["Professional", "Date Night", "Bad Hair Day Fix"],
    productUrl: "https://mdlondon.com/products/the-6",
  },
];
