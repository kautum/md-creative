// Brand check: scores a generated campaign against the hard rules the brand
// voice prompt sets (lib/brandVoice.ts → FIELD RULES). The model is told these
// rules; this checks whether it followed them, so the team sees at a glance
// which lines need a human pass before anything ships.
//
// Pure and import-free (types only) so it runs under plain Node in
// scripts/brand-check.test.mjs.

import type { GeneratedCopy } from "./products";

export interface BrandCheckResult {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

// #GREATHAIRMADEEASY used to be required too; it appears nowhere on
// mdlondon.com (checked Oct 2026), so it is no longer enforced.
const REQUIRED_TAGS = ["#MDLONDON"];
const EMOJI = /\p{Extended_Pictographic}/gu;

/** Words, not tokens: a free-standing "—" or "&" isn't a word. */
export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

function maxWords(id: string, label: string, text: string, max: number): BrandCheckResult {
  const n = wordCount(text);
  return { id, label, pass: n > 0 && n <= max, detail: `${n} / ${max} words` };
}

export function brandCheck(
  copy: GeneratedCopy,
  forbidden: readonly string[],
): BrandCheckResult[] {
  const [short, benefit, story] = copy.adCopy;
  const caption = copy.instagramCaption;
  const emojis = caption.match(EMOJI)?.length ?? 0;
  const tags = copy.hashtags.map((t) => t.toUpperCase());
  const missing = REQUIRED_TAGS.filter((t) => !tags.includes(t));

  const allText = [
    caption,
    ...copy.adCopy,
    copy.campaignAngle,
    copy.ctaRecommendation,
    copy.tiktok_script.hook,
    copy.tiktok_script.cta,
  ]
    .join(" ")
    .toLowerCase();
  const banned = forbidden.filter((w) => allText.includes(w.toLowerCase()));

  const shortCheck = maxWords("short", "Short ad", short, 6);
  if (short.includes("!")) {
    shortCheck.pass = false;
    shortCheck.detail += " · has “!”";
  }

  const captionStyleProblems = [
    emojis > 1 ? `${emojis} emoji` : null,
    caption.includes("#") ? "hashtag in caption" : null,
    /\.\.\.|…/.test(caption) ? "ellipsis" : null,
  ].filter(Boolean);

  return [
    shortCheck,
    maxWords("benefit", "Benefit-led ad", benefit, 30),
    maxWords("story", "Story ad", story, 55),
    maxWords("caption", "Caption length", caption, 20),
    {
      id: "caption-style",
      label: "Caption style",
      pass: captionStyleProblems.length === 0,
      detail: captionStyleProblems.length ? captionStyleProblems.join(", ") : "≤1 emoji, no tags, no ellipsis",
    },
    {
      id: "hashtag-count",
      label: "Hashtag count",
      pass: copy.hashtags.length >= 8 && copy.hashtags.length <= 10,
      detail: `${copy.hashtags.length} (8–10)`,
    },
    {
      id: "brand-tags",
      label: "Brand hashtags",
      pass: missing.length === 0,
      detail: missing.length ? `missing ${missing.join(" ")}` : REQUIRED_TAGS.join(" "),
    },
    maxWords("hook", "TikTok hook", copy.tiktok_script.hook, 12),
    maxWords("cta", "CTA", copy.ctaRecommendation, 8),
    {
      id: "banned",
      label: "Banned words",
      pass: banned.length === 0,
      detail: banned.length ? banned.map((w) => `“${w}”`).join(", ") : "none used",
    },
  ];
}
