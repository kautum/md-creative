import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

  // The scene comes straight from Groq's campaign concept, so the image is now
  // tied to the copy. We only frame it with consistent photography direction.
  const prompt = `${sceneDescription} Professional beauty lifestyle photography. Ultra-realistic, commercial quality, soft natural light. No people. No text. No product in frame. Shot on Phase One, high-end beauty brand aesthetic.`;

  // Pollinations.ai is free and needs no API key. We build the URL and return it
  // directly — the browser loads the (slow) image natively, so this function
  // never blocks on generation and avoids Vercel's timeout.
  const seed = Math.floor(Math.random() * 99999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt,
  )}?width=1024&height=768&nologo=true&model=flux&seed=${seed}`;

  return NextResponse.json({ imageUrl: url });
}
