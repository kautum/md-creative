// node --experimental-strip-types --test scripts/brand-check.test.mjs
//
// Fixtures are the brand's own NEVER / ALWAYS examples from lib/brandVoice.ts,
// so the expected verdicts come from the brand guide, not from this code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { brandCheck, wordCount } from "../lib/brandCheck.ts";
import { BRAND_VOICE } from "../lib/brandVoice.ts";

const good = {
  instagramCaption: "Frizzy mornings, solved. ✨",
  hashtags: ["#MDLONDON", "#GREATHAIRMADEEASY", "#FRIZZFIGHTER", "#BLOWDRY", "#FINEHAIR", "#VOLUMETIPS", "#HAIRTOOLS", "#LONDONHAIR"],
  adCopy: [
    "Volume. Shine. No frizz.",
    "The blow-out you've been chasing. THE 2 delivers it.",
    "Not every day is a good hair day. THE 2 disagrees.",
  ],
  campaignAngle: "Great hair starts with the right routine.",
  creativeDirection: "",
  audienceTargeting: "",
  bestPlatform: "",
  ctaRecommendation: "Shop THE 2 now",
  scene_for_image_gen: "",
  visual_style: "",
  tiktok_script: {
    hook: "Your dryer is the reason your hair looks like that.",
    step1: "",
    step2: "",
    cta: "Link in bio",
    audio_vibe: "",
  },
};

const byId = (results) => Object.fromEntries(results.map((r) => [r.id, r]));

test("the brand guide's ALWAYS examples pass every rule", () => {
  const r = brandCheck(good, BRAND_VOICE.forbidden);
  const failed = r.filter((c) => !c.pass).map((c) => `${c.label}: ${c.detail}`);
  assert.deepEqual(failed, []);
});

test("the brand guide's NEVER examples are caught", () => {
  const bad = {
    ...good,
    instagramCaption: "Say goodbye to bad hair days forever! 🔥🔥 #hair...",
    hashtags: ["#hair", "#beauty"],
    adCopy: [
      "Transform your hair into silky smooth perfection with our revolutionary technology!",
      good.adCopy[1],
      good.adCopy[2],
    ],
  };
  const r = byId(brandCheck(bad, BRAND_VOICE.forbidden));
  assert.equal(r.short.pass, false); // 11 words and "!"
  assert.equal(r["caption-style"].pass, false); // 2 emoji, hashtag, ellipsis
  assert.equal(r["hashtag-count"].pass, false);
  assert.equal(r["brand-tags"].pass, false);
  assert.equal(r.banned.pass, false);
  assert.match(r.banned.detail, /revolutionary/);
  assert.match(r.banned.detail, /say goodbye to/);
});

test("word count matches a hand count", () => {
  assert.equal(wordCount("Volume. Shine. No frizz."), 4);
  assert.equal(wordCount("  spaced   out  words "), 3);
  assert.equal(wordCount(""), 0);
  // Dashes and ampersands aren't words (a bundle CTA was miscounted as 10).
  assert.equal(wordCount("Shop the Frizz Free Curl — BLOW bundle — £185"), 8);
  assert.equal(wordCount("Volume & Body"), 2);
});
