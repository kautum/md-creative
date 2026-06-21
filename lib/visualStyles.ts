// A pool of distinct visual style directions for scene generation. Without an
// explicit constraint, any LLM collapses scene descriptions to "bathroom" /
// "hotel room" — the path of least resistance. We pick one at random per
// generation and inject it as a hard constraint so the image varies structurally
// rather than hoping the model tries harder.

export interface VisualStyle {
  name: string;
  instruction: string;
}

export const VISUAL_STYLES: VisualStyle[] = [
  {
    name: "abstract-surreal",
    instruction:
      "An abstract, surreal environment — flowing liquid color, dreamlike gradients, no literal real-world location. Think editorial perfume ad, not a room.",
  },
  {
    name: "architectural-minimal",
    instruction:
      "Stark architectural minimalism — bold geometric shadows, raw concrete or stone surfaces, dramatic single-source light. No furniture, no domestic setting.",
  },
  {
    name: "nature-macro",
    instruction:
      "Extreme macro nature detail — water droplets, silk fibers, botanical texture, golden light. Intimate and tactile, not a wide room shot.",
  },
  {
    name: "studio-editorial",
    instruction:
      "A bold seamless-paper studio backdrop in a single saturated color, high-fashion lighting, graphic shadow play. No real-world room at all.",
  },
  {
    name: "textural-closeup",
    instruction:
      "Close-up of rippling fabric, marble veining, or metallic surface in dramatic colored light. Texture is the entire subject.",
  },
  {
    name: "color-field",
    instruction:
      "Two-tone minimalist color-blocked set, graphic and flat, bold complementary colors, strong directional shadow.",
  },
  {
    name: "urban-night",
    instruction:
      "A moody London street at night — neon reflections on wet pavement, atmospheric depth, cinematic not domestic.",
  },
  {
    name: "botanical-greenhouse",
    instruction:
      "A lush greenhouse or botanical space — dappled light through leaves, humid green atmosphere, jewel-toned plants.",
  },
  {
    name: "retro-chrome",
    instruction:
      "A 70s-inspired chrome-and-glass studio set, warm amber tones, retro-futurist mood.",
  },
];

export function pickRandomStyle(): VisualStyle {
  return VISUAL_STYLES[Math.floor(Math.random() * VISUAL_STYLES.length)];
}

/** Words that mean the model fell back to a literal domestic location. */
export const BANNED_SCENE_WORDS = ["bathroom", "hotel room", "spa", "vanity"];

/** True if the scene description contains any banned literal location. */
export function sceneHasBannedWords(scene: string): boolean {
  const lower = scene.toLowerCase();
  return BANNED_SCENE_WORDS.some((w) => lower.includes(w));
}
