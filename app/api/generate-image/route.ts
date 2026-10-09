import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_SCENE_CHARS = 1200;

// Campaign scenes are sets for the product — never people, bodies or text.
const NEGATIVE_PROMPT =
  "person, people, woman, man, girl, face, portrait, model, body, skin, hands, hair, nude, cleavage, text, letters, watermark, logo, product, bottle";

interface GenerateImageRequest {
  sceneDescription: string;
  productName: string;
  vibe: string;
}

export async function POST(request: Request) {
  let body: GenerateImageRequest;
  try {
    body = (await request.json()) as GenerateImageRequest;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const { sceneDescription } = body ?? {};

  if (!sceneDescription || typeof sceneDescription !== "string") {
    return NextResponse.json(
      { error: "Missing required field: sceneDescription is required." },
      { status: 400 },
    );
  }
  // The prompt rides in the URL path; very long ones get rejected upstream.
  if (sceneDescription.length > MAX_SCENE_CHARS) {
    return NextResponse.json(
      { error: `sceneDescription must be under ${MAX_SCENE_CHARS} characters.` },
      { status: 400 },
    );
  }

  // The scene comes straight from Groq's campaign concept, so the image is
  // tied to the copy. Framing matters: "beauty lifestyle photography" made the
  // model paint a model (and the free-tier model ignores "No people" written
  // into the prompt), so the scene is described as an EMPTY set, people are
  // excluded via negative_prompt, and Pollinations' safety filter is on.
  const prompt = `Empty still-life set, unoccupied, waiting for a product: ${sceneDescription} Editorial set photography, ultra-realistic, commercial quality, considered lighting, shallow depth of field, nobody in frame.`;

  // Pollinations.ai is free and needs no API key. We build the URL and return it
  // directly — the browser loads the (slow) image natively, so this function
  // never blocks on generation and avoids Vercel's timeout.
  const params = new URLSearchParams({
    width: "1024",
    height: "768",
    nologo: "true",
    model: "flux",
    safe: "true",
    negative_prompt: NEGATIVE_PROMPT,
    seed: String(Math.floor(Math.random() * 99999)),
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;

  return NextResponse.json({ imageUrl: url });
}
