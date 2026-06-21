import { NextResponse } from "next/server";
import { PRODUCTS, type Product, type GeneratedCopy } from "@/lib/products";
import { BRAND_VOICE } from "@/lib/brandVoice";
import {
  pickRandomStyle,
  sceneHasBannedWords,
  type VisualStyle,
} from "@/lib/visualStyles";

export const runtime = "nodejs";

// Groq is OpenAI-compatible, free and fast.
//
// NOTE (Task 1): the brief asked for Kimi K2 (moonshotai/kimi-k2-instruct), but
// that model is NOT provisioned on this Groq key — the /models endpoint lists 17
// models with no Moonshot/Kimi entry. So we use the strongest *available* model
// for non-formulaic creative copy: openai/gpt-oss-120b (the largest general
// model on the account), a genuine step up from Llama 3.3 70B. It supports JSON
// mode; its chain-of-thought lands in a separate `reasoning` field, so
// `message.content` is clean JSON.
//
// If gpt-oss-120b free-tier rate limits (429s) become a problem during testing,
// set GROQ_USE_FALLBACK=1 to drop back to Llama 3.3 70B without a code change.
const PRIMARY_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "llama-3.3-70b-versatile"; // documented fallback for 429s
const MODEL =
  process.env.GROQ_USE_FALLBACK === "1" ? FALLBACK_MODEL : PRIMARY_MODEL;
const CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

type ExistingCopy = GeneratedCopy;
type CopyResult = GeneratedCopy;

interface GenerateCopyRequest {
  productIds?: string[]; // bundle-aware (1 or many)
  productId?: string; // legacy single-product callers
  vibe: string;
  hairConcern?: string;
  mode: "generate" | "refine";
  existingCopy?: ExistingCopy;
  refineRequest?: string;
}

function buildUserPrompt(
  products: Product[],
  vibe: string,
  hairConcern: string | undefined,
  mode: "generate" | "refine",
  existingCopy: ExistingCopy | undefined,
  refineRequest: string | undefined,
  style: VisualStyle,
): string {
  const n = products.length;

  const productBlock =
    n === 1
      ? [
          `Product: ${products[0].name} (${products[0].category})`,
          `What it is: ${products[0].tagline}`,
          `Hair concerns it helps with: ${products[0].hairConcerns.join(", ")}`,
          `Price: £${products[0].price}`,
        ].join("\n")
      : [
          `This is a BUNDLE campaign featuring ${n} mdlondon products:`,
          ...products.map(
            (p) => `- ${p.name} (${p.category}, £${p.price}) — ${p.tagline}`,
          ),
        ].join("\n");

  // Bundle framing so multi-product copy reads as a system, not a product list.
  const bundleBlock =
    n === 1
      ? ""
      : n >= 6
        ? [
            "BUNDLE MODE — THE FULL MDLONDON RANGE (6+ products, the complete system):",
            "- campaign_angle and all copy must speak to the complete range / system as a whole. Do NOT enumerate or name individual products.",
            "- Frame it as 'the full mdlondon range', 'the complete system', 'every step, sorted'.",
            "- tiktok_script: keep steps conceptual (the whole routine), not product-by-product.",
          ].join("\n")
        : [
            "BUNDLE MODE — a routine/kit of multiple products sold as one system:",
            "- campaign_angle MUST tie the products together as a single idea (e.g. 'the complete " +
              vibe +
              " routine'), NOT a mechanical list of names.",
            "- In flowing copy (caption, ad copy, story) refer to 'the kit', 'the routine', or 'the " +
              vibe +
              " edit' rather than awkwardly naming every product in a sentence.",
            "- tiktok_script: step1 and step2 may each spotlight a DIFFERENT product from the selection (for 2-3 products). For 4 products, keep the steps conceptual rather than naming each one.",
          ].join("\n");

  const briefBlock = [
    `Chosen vibe / occasion: ${vibe}`,
    hairConcern ? `Customer's hair concern: ${hairConcern}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Hard constraint that forces scene variety (Task 2).
  const styleBlock = [
    `For scene_for_image_gen specifically, you MUST design within this visual style direction: "${style.instruction}"`,
    `Do NOT default to a literal bathroom, hotel room, spa, or vanity counter — those are banned unless the chosen style direction explicitly calls for a real domestic room (it does not, for any of the 9 styles).`,
    `The campaign concept should still feel connected to the product and vibe — interpret the style direction creatively in service of the brief, don't ignore the brief.`,
  ].join("\n");

  const guidelines = [
    BRAND_VOICE.instagramGuidelines,
    BRAND_VOICE.adCopyGuidelines,
  ].join("\n\n");

  const shape = `Respond with ONLY a valid JSON object, no markdown, no code fences, no commentary. It must match exactly this shape:
{
  "instagramCaption": string,         // the caption text only, WITHOUT hashtags
  "hashtags": string[],               // 8-12 relevant hashtags, each starting with #
  "adCopy": [string, string, string], // exactly three: [punchy/short, benefit-led/medium, story-led/longer]
  "campaignAngle": string,            // one punchy strategic idea that frames this whole campaign (one sentence)
  "creativeDirection": string,        // a visual brief for the photographer / content team: setting, props, mood, framing
  "audienceTargeting": string,        // who to target on Meta/TikTok — demographics, interests, behaviours
  "bestPlatform": string,             // the single best platform for this content, plus one line on why
  "ctaRecommendation": string,        // the action to drive and where to send people (e.g. link to the product page)
  "scene_for_image_gen": string,      // A FLUX image generation prompt. Describes ONLY the physical environment and atmosphere of the campaign setting — the space, surfaces, lighting, props, mood. NO people. NO hair. NO product mentioned or implied. 2–3 sentences. Written as a direct image generation prompt, not as instructions to a photographer.
  "tiktok_script": {                  // a short-form TikTok concept — mdlondon's primary social surface
    "hook": string,                   // first 3 seconds — one punchy spoken line that stops the scroll. Names the problem or makes a surprising claim. ≤12 words.
    "step1": string,                  // what the creator does or shows first — specific action with the product. 1 sentence.
    "step2": string,                  // the reveal or result moment. 1 sentence.
    "cta": string,                    // spoken or text-overlay CTA at the end. ≤8 words. Direct.
    "audio_vibe": string              // one phrase describing the audio tone (e.g. 'satisfying ASMR styling sounds', 'upbeat London pop', 'quiet confidence voiceover only'). Not a specific song title.
  }
}`;

  if (mode === "refine" && existingCopy) {
    return [
      productBlock,
      "",
      briefBlock,
      bundleBlock ? `\n${bundleBlock}` : "",
      "",
      "You previously wrote this content:",
      JSON.stringify(existingCopy, null, 2),
      "",
      `The user wants this change: "${refineRequest ?? "Improve it."}"`,
      "Rewrite ALL fields applying that change while keeping mdlondon's voice and the guidelines below. Keep every field populated.",
      "",
      styleBlock,
      "",
      guidelines,
      "",
      shape,
    ].join("\n");
  }

  return [
    productBlock,
    "",
    briefBlock,
    bundleBlock ? `\n${bundleBlock}` : "",
    "",
    n === 1
      ? "Write fresh social content AND a short strategic brief for this product, tailored to the vibe and hair concern above, following the guidelines below."
      : "Write fresh social content AND a short strategic brief for this BUNDLE, tailored to the vibe and hair concern above, following the bundle framing and guidelines below.",
    "",
    styleBlock,
    "",
    guidelines,
    "",
    shape,
  ].join("\n");
}

/** Pull a JSON object out of an LLM response, tolerating code fences or stray prose. */
function extractJson(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) text = fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    text = text.slice(first, last + 1);
  }
  return text;
}

/** Lenient string extractor for the strategic fields — never fails the response. */
function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeResult(parsed: unknown): CopyResult {
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Model output was not a JSON object.");
  }
  const obj = parsed as Record<string, unknown>;

  const caption = obj.instagramCaption;
  if (typeof caption !== "string" || caption.trim() === "") {
    throw new Error("Missing or empty 'instagramCaption'.");
  }

  if (!Array.isArray(obj.hashtags)) {
    throw new Error("Missing 'hashtags' array.");
  }
  const hashtags = obj.hashtags
    .filter((h): h is string => typeof h === "string")
    .map((h) => h.trim())
    .filter((h) => h.length > 0)
    .map((h) => `#${h.replace(/^#+/, "")}`);
  if (hashtags.length === 0) {
    throw new Error("'hashtags' contained no usable strings.");
  }

  if (!Array.isArray(obj.adCopy)) {
    throw new Error("Missing 'adCopy' array.");
  }
  const ads = obj.adCopy
    .filter((a): a is string => typeof a === "string")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
  if (ads.length < 3) {
    throw new Error("'adCopy' must contain three non-empty variants.");
  }

  return {
    instagramCaption: caption.trim(),
    hashtags,
    adCopy: [ads[0], ads[1], ads[2]],
    // Strategic fields are lenient: a missing one shows blank rather than
    // failing the whole generation.
    campaignAngle: asString(obj.campaignAngle),
    creativeDirection: asString(obj.creativeDirection),
    audienceTargeting: asString(obj.audienceTargeting),
    bestPlatform: asString(obj.bestPlatform),
    ctaRecommendation: asString(obj.ctaRecommendation),
    scene_for_image_gen: asString(obj.scene_for_image_gen),
    // Set server-side from the forced style pick (POST handler), not the model.
    visual_style: "",
    tiktok_script: normalizeTiktok(obj.tiktok_script),
  };
}

/** Lenient nested extractor for the TikTok script — never fails the response. */
function normalizeTiktok(value: unknown): CopyResult["tiktok_script"] {
  const tt =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  return {
    hook: asString(tt.hook),
    step1: asString(tt.step1),
    step2: asString(tt.step2),
    cta: asString(tt.cta),
    audio_vibe: asString(tt.audio_vibe),
  };
}

/**
 * One focused retry that regenerates ONLY the scene description when the first
 * attempt fell back to a banned literal location (bathroom/hotel/spa/vanity).
 * Best-effort: returns null on any failure so it never blocks the response.
 */
async function regenerateScene(
  apiKey: string,
  leadProductName: string,
  vibe: string,
  style: VisualStyle,
  badScene: string,
): Promise<string | null> {
  const prompt = [
    `Campaign for: ${leadProductName}. Vibe: ${vibe}.`,
    `Visual style direction (MANDATORY): "${style.instruction}"`,
    `Your previous scene description used a banned literal location. Regenerate scene_for_image_gen only, strictly following the visual style direction given, with zero references to bathrooms, hotel rooms, spas, or vanities.`,
    `Previous (rejected) scene: "${badScene}"`,
    `Respond with ONLY a JSON object: {"scene_for_image_gen": string}. 2-3 sentences. NO people, NO hair, NO product mentioned. A direct FLUX image prompt.`,
  ].join("\n");

  try {
    const res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: BRAND_VOICE.systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 1500,
        ...(MODEL.startsWith("openai/gpt-oss")
          ? { reasoning_effort: "low" }
          : {}),
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const c = data.choices?.[0]?.message?.content;
    if (typeof c !== "string") return null;
    const parsed = JSON.parse(extractJson(c)) as Record<string, unknown>;
    return asString(parsed.scene_for_image_gen) || null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: GenerateCopyRequest;
  try {
    body = (await request.json()) as GenerateCopyRequest;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const {
    productIds,
    productId,
    vibe,
    hairConcern,
    mode,
    existingCopy,
    refineRequest,
  } = body ?? {};

  // Accept a bundle (productIds[]) or a single legacy productId.
  const ids =
    Array.isArray(productIds) && productIds.length > 0
      ? productIds
      : productId
        ? [productId]
        : [];

  if (ids.length === 0 || !vibe || (mode !== "generate" && mode !== "refine")) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: productIds (or productId), vibe and mode ('generate' | 'refine') are required.",
      },
      { status: 400 },
    );
  }

  // Preserve catalogue order and drop unknown ids.
  const products = PRODUCTS.filter((p) => ids.includes(p.id));
  if (products.length === 0) {
    return NextResponse.json(
      { error: `No known products in: ${ids.join(", ")}` },
      { status: 400 },
    );
  }

  if (mode === "refine" && !existingCopy) {
    return NextResponse.json(
      { error: "Refine mode requires 'existingCopy'." },
      { status: 400 },
    );
  }

  // Force a visual-style direction so scenes don't collapse to "bathroom".
  const style = pickRandomStyle();

  const userPrompt = buildUserPrompt(
    products,
    vibe,
    hairConcern,
    mode,
    existingCopy,
    refineRequest,
    style,
  );

  let groqResponse: Response;
  try {
    groqResponse = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: BRAND_VOICE.systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.8,
        // gpt-oss is a reasoning model whose chain-of-thought counts toward the
        // completion budget; 2000 ran out mid-JSON. Give headroom and keep
        // reasoning light (plenty for copywriting, and much faster).
        max_tokens: 4096,
        ...(MODEL.startsWith("openai/gpt-oss")
          ? { reasoning_effort: "low" }
          : {}),
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to reach the Groq API.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  if (!groqResponse.ok) {
    const detail = await groqResponse.text().catch(() => "");
    return NextResponse.json(
      {
        error: `Groq API returned ${groqResponse.status}.`,
        detail: detail.slice(0, 500),
      },
      { status: 502 },
    );
  }

  let content: string;
  try {
    const data = (await groqResponse.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const c = data.choices?.[0]?.message?.content;
    if (typeof c !== "string" || c.trim() === "") {
      throw new Error("empty completion");
    }
    content = c;
  } catch {
    return NextResponse.json(
      { error: "Groq API returned an unexpected response shape." },
      { status: 502 },
    );
  }

  let result: CopyResult;
  try {
    result = normalizeResult(JSON.parse(extractJson(content)));
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not parse copy from the model output.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  // Stamp the forced style so the frontend can surface it ("Style: …").
  result.visual_style = style.name;

  // Cheap validator (Task 2): if the scene fell back to a banned literal
  // location, make exactly one focused retry. If it still fails, proceed anyway.
  if (sceneHasBannedWords(result.scene_for_image_gen)) {
    const retryScene = await regenerateScene(
      apiKey,
      products[0].name,
      vibe,
      style,
      result.scene_for_image_gen,
    );
    if (retryScene && !sceneHasBannedWords(retryScene)) {
      result.scene_for_image_gen = retryScene;
    } else {
      console.warn(
        `[generate-copy] scene still used a banned location after retry (style: ${style.name}).`,
      );
    }
  }

  return NextResponse.json(result);
}
