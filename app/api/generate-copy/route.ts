import { NextResponse } from "next/server";
import {
  PRODUCTS,
  VIBES,
  HAIR_CONCERNS,
  type Product,
  type GeneratedCopy,
} from "@/lib/products";
import { BRAND_VOICE } from "@/lib/brandVoice";
import { asString, normalizeCopy as normalizeResult } from "@/lib/copySchema";
import {
  pickRandomStyle,
  sceneHasBannedWords,
  type VisualStyle,
} from "@/lib/visualStyles";

export const runtime = "nodejs";

// Groq is OpenAI-compatible, free and fast. openai/gpt-oss-120b writes the least
// formulaic copy of the models on the account; it supports JSON mode and keeps
// its chain-of-thought in a separate `reasoning` field, so `message.content` is
// clean JSON.
//
// Fallback: Groq retired llama-3.3-70b-versatile (absent from /models as of
// Oct 2026), which silently broke the v1 fallback. gpt-oss-20b is the same
// family, accepts the same params, and has more rate-limit headroom.
// Set GROQ_USE_FALLBACK=1 to run on the fallback model without a code change.
const PRIMARY_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "openai/gpt-oss-20b";
const CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// One short backoff before a single invisible retry — standard practice, not a
// retry loop. If the primary is still rate-limited after that, we fall back to
// the higher-headroom model for this one generation.
const RETRY_BACKOFF_MS = 1500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ModelUsed = "primary" | "fallback";

/** Thrown when every model attempt fails; carries a human-friendly message. */
class CopyGenerationError extends Error {}

interface GroqCallResult {
  ok: boolean;
  status: number;
  content?: string;
  detail?: string;
}

/** A single Groq chat call. Never throws — failures come back as { ok: false }. */
async function callGroqChat(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  opts: { temperature: number; maxTokens: number },
): Promise<GroqCallResult> {
  let res: Response;
  try {
    res = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        // gpt-oss is a reasoning model; keep reasoning light (plenty for copy,
        // and much faster). Llama ignores this field.
        ...(model.startsWith("openai/gpt-oss")
          ? { reasoning_effort: "low" }
          : {}),
        response_format: { type: "json_object" },
      }),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, status: res.status, detail: detail.slice(0, 500) };
  }
  try {
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const c = data.choices?.[0]?.message?.content;
    if (typeof c !== "string" || c.trim() === "") {
      return { ok: false, status: res.status, detail: "empty completion" };
    }
    return { ok: true, status: res.status, content: c };
  } catch {
    return { ok: false, status: res.status, detail: "unexpected response shape" };
  }
}

/**
 * Generate copy with a graceful fallback chain:
 *   primary → (one retry after backoff on transient failure) → fallback model.
 * A 429 (rate limit) or 5xx counts as transient. Returns which model produced
 * the result so the UI can show a subtle note. Throws CopyGenerationError only
 * when every attempt fails — the caller turns that into a human message.
 */
async function generateCopyWithFallback(
  apiKey: string,
  messages: { role: string; content: string }[],
): Promise<{ content: string; modelUsed: ModelUsed }> {
  const primaryModel =
    process.env.GROQ_USE_FALLBACK === "1" ? FALLBACK_MODEL : PRIMARY_MODEL;
  const callOpts = { temperature: 0.8, maxTokens: 4096 };
  const isTransient = (s: number) => s === 429 || s >= 500;

  // Attempt 1 — primary.
  let attempt = await callGroqChat(apiKey, primaryModel, messages, callOpts);
  if (attempt.ok) return { content: attempt.content!, modelUsed: "primary" };

  // One invisible retry on a transient failure, after a short backoff.
  if (isTransient(attempt.status)) {
    await sleep(RETRY_BACKOFF_MS);
    attempt = await callGroqChat(apiKey, primaryModel, messages, callOpts);
    if (attempt.ok) return { content: attempt.content!, modelUsed: "primary" };
  }

  // Still failing transiently — fall back to the higher-headroom model once
  // (skip if the primary already IS the fallback, e.g. GROQ_USE_FALLBACK=1).
  if (primaryModel !== FALLBACK_MODEL && isTransient(attempt.status)) {
    const fb = await callGroqChat(apiKey, FALLBACK_MODEL, messages, callOpts);
    if (fb.ok) return { content: fb.content!, modelUsed: "fallback" };
    attempt = fb;
  }

  console.warn(
    `[generate-copy] all model attempts failed (last status ${attempt.status}): ${attempt.detail ?? ""}`,
  );
  throw new CopyGenerationError(
    "Our writing model is busy right now — give it a few seconds and try again.",
  );
}

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
      : n === PRODUCTS.length
        ? [
            "BUNDLE MODE — THE FULL MDLONDON RANGE (every product, the complete system):",
            "- campaign_angle and all copy must speak to the complete range / system as a whole. Do NOT enumerate or name individual products.",
            "- Frame it as 'the full mdlondon range', 'the complete system', 'every step, sorted'.",
            "- tiktok_script: keep steps conceptual (the whole routine), not product-by-product.",
          ].join("\n")
        : n >= 5
          ? [
              `BUNDLE MODE — a ${n}-piece edit of the mdlondon range (NOT the full range — never call it that):`,
              "- campaign_angle and all copy must frame these products as one routine. Do NOT enumerate the products in flowing copy.",
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
      "Keep scene_for_image_gen exactly as it was — the image has already been generated from it.",
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

/**
 * One focused retry that regenerates ONLY the scene description when the first
 * attempt fell back to a banned literal location (bathroom/hotel/spa/vanity).
 * Best-effort: returns null on any failure so it never blocks the response.
 */
async function regenerateScene(
  apiKey: string,
  model: string,
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

  const r = await callGroqChat(
    apiKey,
    model,
    [
      { role: "system", content: BRAND_VOICE.systemPrompt },
      { role: "user", content: prompt },
    ],
    { temperature: 0.9, maxTokens: 1500 },
  );
  if (!r.ok || !r.content) return null;
  try {
    const parsed = JSON.parse(extractJson(r.content)) as Record<string, unknown>;
    return asString(parsed.scene_for_image_gen) || null;
  } catch {
    return null;
  }
}

const MAX_REFINE_CHARS = 300;

/** Brand-voice words the copy must never use (BRAND_VOICE.forbidden). */
function findForbiddenWords(copy: CopyResult): string[] {
  const text = [
    copy.instagramCaption,
    ...copy.adCopy,
    copy.campaignAngle,
    copy.ctaRecommendation,
    copy.tiktok_script.hook,
    copy.tiktok_script.cta,
  ]
    .join(" ")
    .toLowerCase();
  return BRAND_VOICE.forbidden.filter((w) => text.includes(w));
}

/** Reject a request with a 400 and a message safe to show the user. */
function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
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
    return badRequest("Request body must be valid JSON.");
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
    return badRequest(
      "Missing required fields: productIds (or productId), vibe and mode ('generate' | 'refine') are required.",
    );
  }

  // Everything below is interpolated into the prompt, so only known values get
  // through — an unknown id or vibe is an error, never silently dropped.
  const unknown = ids.filter((id) => !PRODUCTS.some((p) => p.id === id));
  if (unknown.length > 0) {
    return badRequest(`Unknown product id(s): ${unknown.join(", ")}`);
  }
  if (!(VIBES as readonly string[]).includes(vibe)) {
    return badRequest(`Unknown vibe: ${vibe}`);
  }
  if (
    hairConcern !== undefined &&
    !(HAIR_CONCERNS as readonly string[]).includes(hairConcern)
  ) {
    return badRequest(`Unknown hair concern: ${hairConcern}`);
  }

  // Preserve catalogue order.
  const products = PRODUCTS.filter((p) => ids.includes(p.id));

  let previous: CopyResult | undefined;
  if (mode === "refine") {
    if (typeof refineRequest !== "string" || refineRequest.trim() === "") {
      return badRequest("Refine mode requires a 'refineRequest'.");
    }
    if (refineRequest.length > MAX_REFINE_CHARS) {
      return badRequest(
        `Keep the refine request under ${MAX_REFINE_CHARS} characters.`,
      );
    }
    try {
      previous = normalizeResult(existingCopy);
    } catch {
      return badRequest("Refine mode requires a valid 'existingCopy'.");
    }
  }

  // Force a visual-style direction so scenes don't collapse to "bathroom".
  // Refines keep the original style + scene: the image is already on screen.
  const style = pickRandomStyle();

  const userPrompt = buildUserPrompt(
    products,
    vibe,
    hairConcern,
    mode,
    previous,
    refineRequest?.trim(),
    style,
  );
  const messages = [
    {
      role: "system",
      content: `${BRAND_VOICE.systemPrompt}\n\nBANNED WORDS — never use any of these: ${BRAND_VOICE.forbidden.join(", ")}.`,
    },
    { role: "user", content: userPrompt },
  ];

  // Up to two passes: a second only if the first came back unparseable or used
  // a banned brand-voice word. A second off-brand result is accepted (and
  // logged) rather than failing the whole campaign.
  let result: CopyResult | null = null;
  let modelUsed: ModelUsed = "primary";
  for (let pass = 1; pass <= 2 && !result; pass++) {
    let content: string;
    try {
      const generated = await generateCopyWithFallback(apiKey, messages);
      content = generated.content;
      modelUsed = generated.modelUsed;
    } catch (err) {
      // Every model attempt failed — a human message, never the raw provider string.
      return NextResponse.json(
        {
          error:
            err instanceof CopyGenerationError
              ? err.message
              : "Copy generation failed. Please try again.",
        },
        { status: 503 },
      );
    }

    let parsed: CopyResult;
    try {
      parsed = normalizeResult(JSON.parse(extractJson(content)));
    } catch (err) {
      console.warn(
        `[generate-copy] pass ${pass}: unparseable model output: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    const banned = findForbiddenWords(parsed);
    if (banned.length > 0) {
      console.warn(
        `[generate-copy] pass ${pass} used banned words: ${banned.join(", ")}`,
      );
      if (pass === 1) continue;
    }
    result = parsed;
  }

  if (!result) {
    return NextResponse.json(
      {
        error:
          "The writing model returned something unreadable — please try again.",
      },
      { status: 502 },
    );
  }

  result.model_used = modelUsed;

  if (previous) {
    result.scene_for_image_gen = previous.scene_for_image_gen;
    result.visual_style = previous.visual_style;
    return NextResponse.json(result);
  }

  // Stamp the forced style so the frontend can surface it ("Style: …").
  result.visual_style = style.name;

  // Cheap validator: if the scene fell back to a banned literal location, make
  // exactly one focused retry. If it still fails, proceed anyway.
  if (sceneHasBannedWords(result.scene_for_image_gen)) {
    const sceneModel =
      modelUsed === "fallback" || process.env.GROQ_USE_FALLBACK === "1"
        ? FALLBACK_MODEL
        : PRIMARY_MODEL;
    const retryScene = await regenerateScene(
      apiKey,
      sceneModel,
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
