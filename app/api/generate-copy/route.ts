import { NextResponse } from "next/server";
import { PRODUCTS, type Product, type GeneratedCopy } from "@/lib/products";
import { BRAND_VOICE } from "@/lib/brandVoice";

export const runtime = "nodejs";

// Groq is OpenAI-compatible, free and fast. llama-3.3-70b-versatile is its
// strongest model for instruction-following copywriting.
const MODEL = "llama-3.3-70b-versatile";
const CHAT_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

type ExistingCopy = GeneratedCopy;
type CopyResult = GeneratedCopy;

interface GenerateCopyRequest {
  productId: string;
  vibe: string;
  hairConcern?: string;
  mode: "generate" | "refine";
  existingCopy?: ExistingCopy;
  refineRequest?: string;
}

function buildUserPrompt(
  product: Product,
  vibe: string,
  hairConcern: string | undefined,
  mode: "generate" | "refine",
  existingCopy: ExistingCopy | undefined,
  refineRequest: string | undefined,
): string {
  const productBlock = [
    `Product: ${product.name} (${product.category})`,
    `What it is: ${product.tagline}`,
    `Hair concerns it helps with: ${product.hairConcerns.join(", ")}`,
    `Price: £${product.price}`,
  ].join("\n");

  const briefBlock = [
    `Chosen vibe / occasion: ${vibe}`,
    hairConcern ? `Customer's hair concern: ${hairConcern}` : null,
  ]
    .filter(Boolean)
    .join("\n");

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
      "",
      "You previously wrote this content:",
      JSON.stringify(existingCopy, null, 2),
      "",
      `The user wants this change: "${refineRequest ?? "Improve it."}"`,
      "Rewrite ALL fields applying that change while keeping mdlondon's voice and the guidelines below. Keep every field populated.",
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
    "",
    "Write fresh social content AND a short strategic brief for this product, tailored to the vibe and hair concern above, following the guidelines below.",
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

  const { productId, vibe, hairConcern, mode, existingCopy, refineRequest } =
    body ?? {};

  if (!productId || !vibe || (mode !== "generate" && mode !== "refine")) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: productId, vibe and mode ('generate' | 'refine') are required.",
      },
      { status: 400 },
    );
  }

  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return NextResponse.json(
      { error: `Unknown productId: ${productId}` },
      { status: 400 },
    );
  }

  if (mode === "refine" && !existingCopy) {
    return NextResponse.json(
      { error: "Refine mode requires 'existingCopy'." },
      { status: 400 },
    );
  }

  const userPrompt = buildUserPrompt(
    product,
    vibe,
    hairConcern,
    mode,
    existingCopy,
    refineRequest,
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
        max_tokens: 2000,
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

  return NextResponse.json(result);
}
