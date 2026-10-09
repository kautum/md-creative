// Share a campaign as a link — no backend. The campaign (selection, brief,
// copy, scene URL) is JSON → deflate-raw → base64url, carried in the URL
// fragment (#c=…), which browsers never send to the server.
//
// Decoding is a trust boundary: anyone can hand-craft a link. Every field is
// re-validated and anything off is a thrown error, never a half-loaded page.

import {
  HAIR_CONCERNS,
  PRODUCTS,
  VIBES,
  type GeneratedCopy,
} from "@/lib/products";
import { normalizeCopy } from "@/lib/copySchema";

export interface SharedCampaign {
  ids: string[];
  vibe: string;
  concern: string | null;
  copy: GeneratedCopy;
  imageUrl: string | null;
}

export const SHARE_PREFIX = "#c=";
const VERSION = 1;
const MAX_ENCODED = 24_000; // chars; a full campaign is ~2-3k
const SCENE_ORIGIN = "https://image.pollinations.ai/prompt/";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("not base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeCampaign(c: SharedCampaign): Promise<string> {
  const json = JSON.stringify({ v: VERSION, ...c });
  const packed = await pipe(new TextEncoder().encode(json), new CompressionStream("deflate-raw"));
  return SHARE_PREFIX + toBase64Url(packed);
}

/** Parse and validate a `#c=…` fragment. Throws with a reason on anything off. */
export async function decodeCampaign(hash: string): Promise<SharedCampaign> {
  if (!hash.startsWith(SHARE_PREFIX)) throw new Error("not a campaign link");
  const encoded = hash.slice(SHARE_PREFIX.length);
  if (encoded.length === 0 || encoded.length > MAX_ENCODED) throw new Error("bad length");

  const bytes = await pipe(fromBase64Url(encoded), new DecompressionStream("deflate-raw"));
  const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;

  if (raw.v !== VERSION) throw new Error(`unsupported version ${String(raw.v)}`);
  const ids = raw.ids;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === "string" && PRODUCTS.some((p) => p.id === id))
  ) {
    throw new Error("unknown products");
  }
  if (typeof raw.vibe !== "string" || !(VIBES as readonly string[]).includes(raw.vibe)) {
    throw new Error("unknown vibe");
  }
  const concern = raw.concern ?? null;
  if (concern !== null && !(HAIR_CONCERNS as readonly string[]).includes(concern as string)) {
    throw new Error("unknown hair concern");
  }
  const imageUrl = raw.imageUrl ?? null;
  // Only ever load scenes from the generator — a link can't point the page at
  // an arbitrary image.
  if (imageUrl !== null && (typeof imageUrl !== "string" || !imageUrl.startsWith(SCENE_ORIGIN))) {
    throw new Error("scene URL is not from the image generator");
  }
  return {
    ids: ids as string[],
    vibe: raw.vibe,
    concern: concern as string | null,
    copy: normalizeCopy(raw.copy),
    imageUrl: imageUrl as string | null,
  };
}
