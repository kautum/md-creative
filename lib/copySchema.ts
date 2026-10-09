// The shape of a campaign's copy, enforced. Used at every boundary where copy
// arrives from outside this code: the model's JSON (API route), a refine's
// existingCopy (request body), and a shared campaign link (URL). Required
// fields throw; strategic fields are lenient and default to "".

import type { GeneratedCopy } from "@/lib/products";

/** Lenient string extractor for the strategic fields — never fails the response. */
export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCopy(parsed: unknown): GeneratedCopy {
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
    // Set server-side from the forced style pick (POST handler), not the model;
    // carried through when validating a refine's existingCopy.
    visual_style: asString(obj.visual_style),
    tiktok_script: normalizeTiktok(obj.tiktok_script),
  };
}

/** Lenient nested extractor for the TikTok script — never fails the response. */
function normalizeTiktok(value: unknown): GeneratedCopy["tiktok_script"] {
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
