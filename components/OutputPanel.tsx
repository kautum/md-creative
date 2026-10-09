"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useScroll,
  useTransform,
} from "framer-motion";
import type { Product, GeneratedCopy } from "@/lib/products";
import { getCutout } from "@/lib/cutout";
import ProductOverlays from "@/components/ProductOverlays";
import ProductImage from "@/components/ProductImage";
import ParticleProduct from "@/components/ParticleProduct";
import BrandCheckPanel from "@/components/BrandCheckPanel";

interface OutputPanelProps {
  products: Product[];
  copyResult: GeneratedCopy | null;
  imageUrl: string | null;
  copyLoading: boolean;
  imageLoading: boolean;
  isRevealing: boolean;
  onRegenerate: () => void;
  /** The scene URL that actually loaded (may differ after a retry). */
  onSceneLoaded: (url: string) => void;
}

const AD_LABELS = ["Short", "Benefit-led", "Story"];

function Bar({ w, h = 12 }: { w: string; h?: number }) {
  return (
    <div
      className="animate-breathe"
      style={{
        width: w,
        height: h,
        borderRadius: 2,
        background: "var(--line)",
      }}
    />
  );
}

/**
 * Fades + lifts in when `revealed` flips true, staggered by index so the
 * campaign settles in sequence rather than all at once.
 */
function Reveal({
  revealed,
  index,
  className,
  children,
}: {
  revealed: boolean;
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`transition-all duration-500 ease-out motion-reduce:transition-none ${className ?? ""}`}
      style={{
        transitionDelay: `${index * 110}ms`,
        opacity: revealed ? 1 : 0,
        transform: revealed ? "none" : "translateY(1rem)",
      }}
    >
      {children}
    </div>
  );
}

/** Visible (not hover-only) copy control — works on touch too. */
function CopyButton({
  field,
  value,
  copiedField,
  onCopy,
}: {
  field: string;
  value: string;
  copiedField: string | null;
  onCopy: (field: string, value: string) => void;
}) {
  const copied = copiedField === field;
  return (
    <button
      type="button"
      onClick={() => onCopy(field, value)}
      className="label-sm shrink-0 underline-offset-4 hover:underline"
      style={{ color: copied ? "var(--fg)" : "var(--fg-50)" }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** A labelled row inside a card: label + copy on one line, text beneath. */
function Field({
  label,
  field,
  value,
  copiedField,
  onCopy,
  children,
}: {
  label: string;
  field: string;
  value: string;
  copiedField: string | null;
  onCopy: (field: string, value: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-sm" style={{ color: "var(--fg-70)" }}>
          {label}
        </span>
        <CopyButton
          field={field}
          value={value}
          copiedField={copiedField}
          onCopy={onCopy}
        />
      </div>
      {children ?? <p className="body-sm">{value}</p>}
    </div>
  );
}

/** Same scene, new random seed — busts the browser's cached failure. */
function buildPollinationsRetryUrl(baseUrl: string): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("seed", String(Math.floor(Math.random() * 99999)));
    return u.toString();
  } catch {
    return baseUrl;
  }
}

// Anonymous Pollinations allows roughly one image a minute per visitor and
// answers 402 inside that window (measured Oct 2026). An <img> can't see the
// status, so every failure waits out the window rather than retrying at once.
const RETRY_DELAYS_MS = [20_000, 45_000];

// A static "Generating..." for 10-25s reads as stuck, so cycle phases and hold
// on the last one rather than looping.
const SCENE_STEPS = [
  "Composing the scene",
  "Placing the light",
  "Adding final detail",
  "Almost there",
];

function SceneProgress({ retrying }: { retrying: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setI((n) => Math.min(n + 1, SCENE_STEPS.length - 1)),
      5500,
    );
    return () => clearInterval(id);
  }, []);
  if (retrying) {
    return (
      <span className="label animate-breathe px-6 text-center">
        Image service is busy — retrying automatically
      </span>
    );
  }
  return (
    <span key={i} className="label animate-fade-in-up">
      {SCENE_STEPS[i]} —
    </span>
  );
}

/**
 * The AI scene with the real product composited on top. Re-keyed by imageUrl
 * in the parent, so load/retry state resets per generation without an effect.
 */
function AdCreative({
  products,
  imageUrl,
  imageLoading,
  visualStyle,
  onLoaded,
}: {
  products: Product[];
  imageUrl: string | null;
  imageLoading: boolean;
  visualStyle: string | undefined;
  onLoaded: (url: string) => void;
}) {
  const [currentUrl, setCurrentUrl] = useState(imageUrl);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Rate limit (402) or a 5xx blip: retry on the schedule above, then hand
  // the user a manual retry.
  const handleSceneError = () => {
    if (!imageUrl || retryCount >= RETRY_DELAYS_MS.length) {
      setImgError(true);
      return;
    }
    const attempt = retryCount + 1;
    setRetryCount(attempt);
    setTimeout(
      () => setCurrentUrl(buildPollinationsRetryUrl(imageUrl)),
      RETRY_DELAYS_MS[attempt - 1],
    );
  };

  const manualRetry = () => {
    if (!imageUrl) return;
    setImgError(false);
    setImgLoaded(false);
    setRetryCount(0);
    setCurrentUrl(buildPollinationsRetryUrl(imageUrl));
  };

  const showScene = !!currentUrl && imgLoaded && !imgError;

  // While the scene paints, the lead product hangs in the frame as a
  // breathing constellation.
  const breath = useMotionValue(0.35);
  useEffect(() => {
    if (showScene) return;
    const c = animate(breath, [0.35, 0.92, 0.6, 0.92], {
      duration: 5,
      repeat: Infinity,
      repeatType: "mirror",
      ease: "easeInOut",
    });
    return () => c.stop();
  }, [showScene, breath]);

  // Gentle parallax: the scene drifts against the frame as the page scrolls.
  const frameRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: frameRef,
    offset: ["start end", "end start"],
  });
  const sceneY = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);

  return (
    <figure className="flex flex-col gap-3">
      <div
        ref={frameRef}
        className="relative aspect-[4/3] w-full overflow-hidden"
        style={{ background: "rgba(31,41,44,0.35)", isolation: "isolate" }}
      >
        {!showScene && products[0] && (
          <div className="absolute inset-[16%]">
            <ParticleProduct
              src={getCutout(products[0].id).url}
              form={breath}
              kind={products[0].category === "tool" ? "strand" : "mist"}
              pad={0.2}
              count={900}
            />
          </div>
        )}
        {/* The scene wipes in from the top once it has painted. */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{
            clipPath: showScene ? "inset(0% 0% 0% 0%)" : "inset(0% 0% 100% 0%)",
          }}
          transition={{ duration: 1.2, ease: [0.77, 0, 0.18, 1] }}
        >
          {currentUrl && (
            <motion.img
              src={currentUrl}
              alt="AI-generated campaign scene"
              onLoad={() => {
                setImgLoaded(true);
                onLoaded(currentUrl);
              }}
              onError={handleSceneError}
              className="absolute inset-0 h-full w-full scale-[1.1] object-cover"
              style={{ y: sceneY }}
            />
          )}
          {showScene && <ProductOverlays products={products} />}
        </motion.div>
        {!showScene && (
          <div className="absolute inset-x-0 bottom-6 flex items-center justify-center">
            {imgError ? (
              <button type="button" onClick={manualRetry} className="btn-ghost">
                Scene failed — retry
              </button>
            ) : currentUrl || imageLoading ? (
              <SceneProgress retrying={retryCount > 0} />
            ) : (
              <span className="label" style={{ color: "var(--fg-50)" }}>
                Waiting for the brief
              </span>
            )}
          </div>
        )}
      </div>
      <figcaption className="legal flex justify-between gap-4">
        <span>
          <span className="credit">Scene by</span> Pollinations
          {visualStyle ? ` · Direction: ${visualStyle}` : ""}
        </span>
        <span>Real product, composited in-browser</span>
      </figcaption>
    </figure>
  );
}

/**
 * Word-by-word typewriter for the caption. Mounted with `key={text}` so a new
 * caption restarts cleanly.
 */
function TypewriterCaption({ text, active }: { text: string; active: boolean }) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!active || !text) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = setTimeout(() => setTyped(text), 0);
      return () => clearTimeout(id);
    }
    const words = text.split(" ");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(words.slice(0, i).join(" "));
      if (i >= words.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [text, active]);

  return <>{typed}</>;
}

export default function OutputPanel({
  products,
  copyResult,
  imageUrl,
  copyLoading,
  imageLoading,
  isRevealing,
  onRegenerate,
  onSceneLoaded,
}: OutputPanelProps) {
  const tt = copyResult?.tiktok_script ?? null;
  const isLargeBundle = products.length >= 5;
  const busy = copyLoading || imageLoading;
  // While copy is in flight, show the skeleton immediately — don't wait for
  // the reveal, or the section looks empty for the first few seconds.
  const shown = isRevealing || copyLoading;

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const handleCopyField = async (field: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(
        () => setCopiedField((cur) => (cur === field ? null : cur)),
        2000,
      );
    } catch {
      // Clipboard is unavailable on insecure origins; the text stays selectable.
    }
  };

  return (
    <div className="flex flex-col gap-[68px]">
      {/* Reveal — angle flanks the creative, text left / object right. */}
      <Reveal
        revealed={shown}
        index={0}
        className="grid grid-cols-1 gap-10 lg:grid-cols-12"
      >
        <div className="flex flex-col gap-6 lg:col-span-5">
          <span className="label" style={{ color: "var(--fg-70)" }}>
            Campaign angle
          </span>
          {copyLoading ? (
            <div className="flex flex-col gap-3">
              <Bar w="90%" h={26} />
              <Bar w="70%" h={26} />
            </div>
          ) : (
            copyResult?.campaignAngle && (
              <p className="body-voice">{copyResult.campaignAngle}</p>
            )
          )}
          <hr className="rule-dashed" />
          {copyLoading ? (
            <div className="flex flex-col gap-2">
              <Bar w="100%" />
              <Bar w="80%" />
            </div>
          ) : (
            copyResult?.creativeDirection && (
              <Field
                label="Creative direction"
                field="creativeDirection"
                value={copyResult.creativeDirection}
                copiedField={copiedField}
                onCopy={handleCopyField}
              >
                <p className="body-sm" style={{ color: "var(--fg-70)" }}>
                  {copyResult.creativeDirection}
                </p>
              </Field>
            )
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={busy}
              className="btn-ghost"
            >
              {busy ? "Working…" : "New campaign ↻"}
            </button>
            {!copyLoading && copyResult?.model_used === "fallback" && (
              <span className="legal">Written on the backup model</span>
            )}
          </div>
        </div>
        <div className="lg:col-span-7">
          <AdCreative
            key={imageUrl ?? "none"}
            products={products}
            imageUrl={imageUrl}
            imageLoading={imageLoading}
            visualStyle={copyResult?.visual_style}
            onLoaded={onSceneLoaded}
          />
        </div>
      </Reveal>

      {/* 5+ products: the scene is pure atmosphere, so list the edit cleanly. */}
      {isLargeBundle && (
        <Reveal revealed={shown} index={1} className="flex flex-col gap-[18px]">
          <span className="label">In this campaign</span>
          <div className="grid grid-cols-3 gap-[18px] sm:grid-cols-6">
            {products.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <ProductImage product={p} className="aspect-square w-full" />
                <span className="label-sm">{p.name}</span>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {/* The copy — three channels, three cards. */}
      <Reveal
        revealed={shown}
        index={2}
        className="grid grid-cols-1 gap-[18px] lg:grid-cols-3"
      >
        <div className="card flex flex-col gap-5 p-6">
          <span className="label">Instagram</span>
          {copyLoading || !copyResult ? (
            <div className="flex flex-col gap-2">
              <Bar w="100%" />
              <Bar w="85%" />
              <Bar w="60%" />
            </div>
          ) : (
            <>
              <Field
                label="Caption"
                field="caption"
                value={copyResult.instagramCaption}
                copiedField={copiedField}
                onCopy={handleCopyField}
              >
                <p className="body-sm whitespace-pre-line" style={{ fontSize: 17 }}>
                  <TypewriterCaption
                    key={copyResult.instagramCaption}
                    text={copyResult.instagramCaption}
                    active={isRevealing}
                  />
                </p>
              </Field>
              <hr className="rule-dashed" />
              <Field
                label="Hashtags"
                field="hashtags"
                value={copyResult.hashtags.join(" ")}
                copiedField={copiedField}
                onCopy={handleCopyField}
              >
                <p className="label-sm leading-relaxed" style={{ lineHeight: 1.8 }}>
                  {copyResult.hashtags.join("  ")}
                </p>
              </Field>
            </>
          )}
        </div>

        <div className="card flex flex-col gap-5 p-6">
          <span className="label">TikTok script</span>
          {copyLoading || !tt?.hook ? (
            <div className="flex flex-col gap-2">
              <Bar w="80%" />
              <Bar w="95%" />
              <Bar w="70%" />
            </div>
          ) : (
            <>
              {[
                { key: "hook", label: "Hook — 0-3s", value: tt.hook },
                { key: "step1", label: "Step 1", value: tt.step1 },
                { key: "step2", label: "Step 2", value: tt.step2 },
                { key: "cta", label: "CTA", value: tt.cta },
              ]
                .filter((row) => row.value)
                .map((row) => (
                  <Field
                    key={row.key}
                    label={row.label}
                    field={`tt-${row.key}`}
                    value={row.value}
                    copiedField={copiedField}
                    onCopy={handleCopyField}
                  />
                ))}
              {tt.audio_vibe && (
                <>
                  <hr className="rule-dashed" />
                  <p className="label-sm" style={{ color: "var(--fg-70)" }}>
                    Audio — {tt.audio_vibe}
                  </p>
                </>
              )}
            </>
          )}
        </div>

        <div className="card flex flex-col gap-5 p-6">
          <span className="label">Paid ad copy</span>
          {copyLoading || !copyResult ? (
            <div className="flex flex-col gap-2">
              <Bar w="50%" />
              <Bar w="100%" />
              <Bar w="90%" />
            </div>
          ) : (
            copyResult.adCopy.map((variant, i) => (
              <Field
                key={i}
                label={AD_LABELS[i]}
                field={`ad-${i}`}
                value={variant}
                copiedField={copiedField}
                onCopy={handleCopyField}
              >
                <p
                  className="body-sm whitespace-pre-line"
                  style={i === 0 ? { fontSize: 20, lineHeight: 1.2 } : undefined}
                >
                  {variant}
                </p>
              </Field>
            ))
          )}
        </div>
      </Reveal>

      {copyResult && !copyLoading && (
        <Reveal revealed={shown} index={3}>
          <BrandCheckPanel copy={copyResult} />
        </Reveal>
      )}

      {/* Strategy — plain text on the canvas, ruled, no more boxes. */}
      {copyResult && !copyLoading && (
        <Reveal
          revealed={shown}
          index={4}
          className="grid grid-cols-1 gap-x-[18px] gap-y-8 sm:grid-cols-3"
        >
          {[
            { key: "audience", label: "Audience", value: copyResult.audienceTargeting },
            { key: "platform", label: "Platform", value: copyResult.bestPlatform },
            { key: "cta", label: "CTA", value: copyResult.ctaRecommendation },
          ]
            .filter((row) => row.value)
            .map((row) => (
              <div key={row.key} className="rule-dashed pt-4">
                <Field
                  label={row.label}
                  field={row.key}
                  value={row.value}
                  copiedField={copiedField}
                  onCopy={handleCopyField}
                />
              </div>
            ))}
        </Reveal>
      )}
    </div>
  );
}
