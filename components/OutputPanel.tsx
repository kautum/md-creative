/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Music, RefreshCw } from "lucide-react";
import type { Product, GeneratedCopy } from "@/lib/products";
import ProductOverlays from "@/components/ProductOverlays";

interface OutputPanelProps {
  products: Product[];
  copyResult: GeneratedCopy | null;
  imageUrl: string | null;
  copyLoading: boolean;
  imageLoading: boolean;
  isRevealing: boolean;
  onRegenerateCopy: () => void;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-heading text-xs font-medium uppercase tracking-[0.25em]"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </span>
  );
}

function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse ${className ?? ""}`}
      style={{ backgroundColor: "var(--skeleton)", ...style }}
    />
  );
}

/**
 * A section that fades + slides up when `revealed` flips true. Each card is
 * staggered by 120ms * index so the panel cascades into view rather than
 * appearing all at once.
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
      className={`transition-all duration-500 ease-out ${className ?? ""}`}
      style={{
        transitionDelay: `${index * 120}ms`,
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0)" : "translateY(1rem)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Hover-revealed clipboard icon, pinned top-right of a `relative group`
 * container. Shows a Check for 2s after a successful copy. Keyed by field name
 * via the shared `copiedField` state so only the clicked field flips.
 */
function CopyIcon({
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
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={() => onCopy(field, value)}
      aria-label={copied ? "Copied" : "Copy"}
      className={`absolute top-2 right-2 transition-opacity cursor-pointer ${
        copied ? "opacity-100" : "opacity-0 group-hover:opacity-60"
      }`}
      style={{ color: copied ? "var(--accent)" : "var(--text-primary)" }}
    >
      <Icon size={14} />
    </button>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border)",
};

/**
 * Build a fresh Pollinations URL from an existing one: new random seed, and
 * optionally a different model (we fall back from flux → turbo on repeated
 * failures, since turbo tends to stay up when flux is degraded).
 */
function buildPollinationsRetryUrl(
  baseUrl: string,
  model: "flux" | "turbo",
): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set("seed", String(Math.floor(Math.random() * 99999)));
    u.searchParams.set("model", model);
    return u.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Ad creative card — the Pollinations URL is returned instantly and the browser
 * loads the (slow) image natively, so we show a teal skeleton until it paints.
 * Mounted with `key={imageUrl}` by the parent, so its load state resets per
 * generation without an effect.
 */
function AdCreative({
  products,
  imageUrl,
  imageLoading,
}: {
  products: Product[];
  imageUrl: string | null;
  imageLoading: boolean;
}) {
  // currentUrl is what the <img> actually loads — it diverges from the imageUrl
  // prop when we retry Pollinations with a fresh seed / turbo fallback. The
  // parent re-keys this component on imageUrl change, so all state resets per
  // generation without an effect.
  const [currentUrl, setCurrentUrl] = useState(imageUrl);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Pollinations 500s intermittently. Retry: (1) fresh seed/flux, (2) turbo,
  // (3) give up and let the user retry manually.
  const handleSceneError = () => {
    if (!imageUrl) {
      setImgError(true);
      return;
    }
    if (retryCount >= 2) {
      setImgError(true);
      return;
    }
    const nextModel = retryCount === 1 ? "turbo" : "flux";
    const nextUrl = buildPollinationsRetryUrl(imageUrl, nextModel);
    const attempt = retryCount + 1;
    // brief pause before retrying so a momentary server blip can clear
    setTimeout(() => {
      setCurrentUrl(nextUrl);
      setRetryCount(attempt);
    }, 1000);
  };

  const manualRetry = () => {
    if (!imageUrl) return;
    setImgError(false);
    setImgLoaded(false);
    setRetryCount(0);
    setCurrentUrl(buildPollinationsRetryUrl(imageUrl, "flux"));
  };

  return (
    <div className="flex flex-col gap-3">
      <Label>Ad Creative</Label>
      <div
        className="relative h-72 w-full overflow-hidden"
        style={{ ...cardStyle, isolation: "isolate" }}
      >
        {currentUrl ? (
          <>
            <img
              src={currentUrl}
              alt="AI-generated background scene"
              onLoad={() => setImgLoaded(true)}
              onError={handleSceneError}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
              style={{ opacity: imgLoaded && !imgError ? 1 : 0 }}
            />
            {/* Tiered compositing: hero (1), flat-lay (2-4), none (5+). */}
            {imgLoaded && !imgError && <ProductOverlays products={products} />}
            {/* Teal skeleton while the scene loads (or an error message). */}
            {(!imgLoaded || imgError) && (
              <div
                className="absolute inset-0 flex items-center justify-center animate-pulse"
                style={{ backgroundColor: "var(--skeleton)" }}
              >
                {imgError ? (
                  <button
                    type="button"
                    onClick={manualRetry}
                    className="text-xs uppercase tracking-[0.15em] underline-offset-2 hover:underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Scene generation failed — retry
                  </button>
                ) : (
                  <span
                    className="text-xs uppercase tracking-[0.15em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Generating scene...
                  </span>
                )}
              </div>
            )}
          </>
        ) : imageLoading ? (
          <div
            className="absolute inset-0 flex items-center justify-center animate-pulse"
            style={{ backgroundColor: "var(--skeleton)" }}
          >
            <span
              className="text-xs uppercase tracking-[0.15em]"
              style={{ color: "var(--text-muted)" }}
            >
              Generating scene...
            </span>
          </div>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              No scene yet
            </span>
          </div>
        )}
      </div>
      <span
        className="text-[10px] tracking-wide"
        style={{ color: "var(--text-muted)" }}
      >
        AI-generated scene — mdlondon
      </span>
    </div>
  );
}

/**
 * Word-by-word typewriter for the caption. Mounted with `key={text}`, so a new
 * caption restarts cleanly; setState only happens inside the timer callback.
 */
function TypewriterCaption({ text, active }: { text: string; active: boolean }) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!active || !text) return;
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
  onRegenerateCopy,
}: OutputPanelProps) {
  const adLabels = ["Short", "Benefit-led", "Story"];
  const tt = copyResult?.tiktok_script ?? null;
  const isBundle = products.length > 1;
  const isFullRange = products.length >= 5;

  // `isRevealing` flips true once both APIs resolve; it drives the per-card
  // opacity/translate stagger in <Reveal> directly, no mirrored state needed.

  // Hover-to-copy: a single state keyed by field name, so the clicked field
  // flips to a Check for 2s while the others stay put.
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
      // Clipboard can fail on insecure origins; fail quietly.
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-10"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      {/* SECTION 1 — image row */}
      <Reveal revealed={isRevealing} index={0} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Product shot(s) — single hero, or a clean contact-sheet for bundles */}
        <div className="flex flex-col gap-3">
          <Label>{isBundle ? "In This Bundle" : "Product Shot"}</Label>
          <div className="h-72 w-full overflow-hidden" style={cardStyle}>
            {products.length === 1 ? (
              <div className="flex h-full w-full items-center justify-center p-6">
                <img
                  src={products[0].imageUrl}
                  alt={products[0].name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div
                className="grid h-full w-full gap-2 p-3"
                style={{
                  gridTemplateColumns:
                    products.length <= 4 ? "repeat(2,1fr)" : "repeat(3,1fr)",
                  gridAutoRows: "1fr",
                }}
              >
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-center p-1"
                    style={{ backgroundColor: "var(--bg-surface-2)" }}
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ad creative — generated scene + tiered product composite on top.
            Keyed by imageUrl so its load state resets per generation. */}
        <AdCreative
          key={imageUrl ?? "none"}
          products={products}
          imageUrl={imageUrl}
          imageLoading={imageLoading}
        />
      </Reveal>

      {/* THE FULL RANGE — Tier 3 (5+ products): list every product cleanly
          instead of cramming them all onto the scene. */}
      {isFullRange && (
        <Reveal revealed={isRevealing} index={1} className="flex flex-col gap-3">
          <Label>The Full Range</Label>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {products.map((p) => (
              <div key={p.id} className="flex flex-col" style={cardStyle}>
                <div
                  className="flex aspect-square w-full items-center justify-center p-3"
                  style={{ backgroundColor: "#ffffff" }}
                >
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div
                  className="flex items-baseline justify-between gap-2 border-t p-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="font-heading text-xs font-medium tracking-wide"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {p.name}
                  </span>
                  <span className="text-xs" style={{ color: "var(--accent)" }}>
                    £{p.price}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      {/* Campaign angle — prominent, frames everything */}
      <Reveal revealed={isRevealing} index={1} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Label>Campaign Angle</Label>
          {copyResult && !copyLoading && (
            <button
              type="button"
              onClick={onRegenerateCopy}
              className="group/btn flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-muted)")
              }
            >
              <RefreshCw
                size={11}
                strokeWidth={2}
                className="transition-transform duration-300 group-hover/btn:rotate-180"
              />
              New angle
            </button>
          )}
        </div>
        {copyLoading ? (
          <Skeleton className="h-6 w-3/4" />
        ) : copyResult?.campaignAngle ? (
          <div className="relative group pr-8">
            <p
              className="font-heading text-xl sm:text-2xl font-light leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {copyResult.campaignAngle}
            </p>
            <CopyIcon
              field="campaignAngle"
              value={copyResult.campaignAngle}
              copiedField={copiedField}
              onCopy={handleCopyField}
            />
          </div>
        ) : null}

        {copyLoading ? (
          <Skeleton className="h-3 w-2/3" style={{ marginTop: 8 }} />
        ) : copyResult?.creativeDirection ? (
          <div className="relative group pr-8">
            <p
              className="text-sm italic leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              {copyResult.creativeDirection}
            </p>
            <CopyIcon
              field="creativeDirection"
              value={copyResult.creativeDirection}
              copiedField={copiedField}
              onCopy={handleCopyField}
            />
          </div>
        ) : null}
      </Reveal>

      {/* Instagram */}
      <Reveal revealed={isRevealing} index={2}>
        <div style={cardStyle} className="flex flex-col gap-4 p-6">
          <Label>Instagram</Label>

          {copyLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : copyResult ? (
            <>
              <div className="relative group pr-8">
                <p
                  className="text-sm leading-relaxed whitespace-pre-line"
                  style={{ color: "var(--text-primary)" }}
                >
                  <TypewriterCaption
                    key={copyResult.instagramCaption}
                    text={copyResult.instagramCaption}
                    active={isRevealing}
                  />
                </p>
                <CopyIcon
                  field="caption"
                  value={copyResult.instagramCaption}
                  copiedField={copiedField}
                  onCopy={handleCopyField}
                />
              </div>
              <div className="relative group pr-8">
                <div className="flex flex-wrap gap-2">
                  {copyResult.hashtags.map((tag, i) => (
                    <span
                      key={`${tag}-${i}`}
                      className="text-[10px] font-medium uppercase tracking-[0.15em] px-3 py-1"
                      style={{
                        border: "1px solid var(--border)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <CopyIcon
                  field="hashtags"
                  value={copyResult.hashtags.join(" ")}
                  copiedField={copiedField}
                  onCopy={handleCopyField}
                />
              </div>
            </>
          ) : null}
        </div>
      </Reveal>

      {/* TikTok script — mdlondon is TikTok-first, so surface the full script
          (not just the hook shown in the mockup) with hover-to-copy. */}
      <Reveal revealed={isRevealing} index={3}>
        <div style={cardStyle} className="flex flex-col gap-5 p-6">
          <Label>TikTok Script</Label>

          {copyLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : tt?.hook ? (
            <div className="flex flex-col gap-5">
              {[
                { key: "hook", label: "Hook", value: tt.hook },
                { key: "step1", label: "Step 1", value: tt.step1 },
                { key: "step2", label: "Step 2", value: tt.step2 },
                { key: "cta", label: "CTA", value: tt.cta },
              ]
                .filter((row) => row.value)
                .map((row) => (
                  <div
                    key={row.key}
                    className="relative group flex flex-col gap-1.5 pr-8"
                  >
                    <span
                      className="text-[10px] font-medium uppercase tracking-[0.2em]"
                      style={{ color: "var(--accent)" }}
                    >
                      {row.label}
                    </span>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {row.value}
                    </p>
                    <CopyIcon
                      field={`tt-${row.key}`}
                      value={row.value}
                      copiedField={copiedField}
                      onCopy={handleCopyField}
                    />
                  </div>
                ))}
              {tt.audio_vibe && (
                <div
                  className="flex items-center gap-2 pt-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Music size={13} />
                  <span className="text-xs italic">{tt.audio_vibe}</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </Reveal>

      {/* Paid ad copy */}
      <Reveal revealed={isRevealing} index={4}>
        <div style={cardStyle} className="flex flex-col gap-5 p-6">
          <Label>Paid Ad Copy</Label>

          {copyLoading ? (
            <div className="flex flex-col gap-5">
              {adLabels.map((l) => (
                <div key={l} className="flex flex-col gap-2">
                  <Skeleton className="h-2 w-20" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </div>
              ))}
            </div>
          ) : copyResult ? (
            <div className="flex flex-col gap-6">
              {copyResult.adCopy.map((variant, i) => (
                <div key={i} className="relative group flex flex-col gap-2 pr-8">
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.2em]"
                    style={{ color: "var(--accent)" }}
                  >
                    {adLabels[i]}
                  </span>
                  <p
                    className="text-sm leading-relaxed whitespace-pre-line"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {variant}
                  </p>
                  <CopyIcon
                    field={`ad-${i}`}
                    value={variant}
                    copiedField={copiedField}
                    onCopy={handleCopyField}
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Reveal>

      {/* Audience + Platform — two small info cards */}
      {copyResult &&
        (copyResult.audienceTargeting || copyResult.bestPlatform) && (
          <Reveal revealed={isRevealing} index={5} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {copyResult.audienceTargeting && (
              <div
                className="relative group flex flex-col gap-3 p-5"
                style={cardStyle}
              >
                <Label>Audience</Label>
                <p
                  className="text-sm leading-relaxed pr-6"
                  style={{ color: "var(--text-primary)" }}
                >
                  {copyResult.audienceTargeting}
                </p>
                <CopyIcon
                  field="audience"
                  value={copyResult.audienceTargeting}
                  copiedField={copiedField}
                  onCopy={handleCopyField}
                />
              </div>
            )}
            {copyResult.bestPlatform && (
              <div className="flex flex-col gap-3 p-5" style={cardStyle}>
                <Label>Platform</Label>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-primary)" }}
                >
                  {copyResult.bestPlatform}
                </p>
              </div>
            )}
          </Reveal>
        )}

      {/* CTA — bottom, with arrow */}
      {copyResult?.ctaRecommendation && (
        <Reveal revealed={isRevealing} index={6} className="flex flex-col gap-3">
          <Label>CTA</Label>
          <div className="relative group pr-8">
            <p
              className="text-sm leading-relaxed flex items-start gap-2"
              style={{ color: "var(--text-primary)" }}
            >
              <span style={{ color: "var(--accent)" }}>→</span>
              <span>{copyResult.ctaRecommendation}</span>
            </p>
            <CopyIcon
              field="cta"
              value={copyResult.ctaRecommendation}
              copiedField={copiedField}
              onCopy={handleCopyField}
            />
          </div>
        </Reveal>
      )}
    </motion.div>
  );
}
