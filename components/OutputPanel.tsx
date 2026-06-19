/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, RefreshCw } from "lucide-react";
import type { Product, GeneratedCopy } from "@/lib/products";

interface OutputPanelProps {
  product: Product;
  copyResult: GeneratedCopy | null;
  imageUrl: string | null;
  copyLoading: boolean;
  imageLoading: boolean;
  isRevealing: boolean;
  onRegenerateImage: () => void;
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
 * Ad creative card — the Pollinations URL is returned instantly and the browser
 * loads the (slow) image natively, so we show a teal skeleton until it paints.
 * Mounted with `key={imageUrl}` by the parent, so its load state resets per
 * generation without an effect.
 */
function AdCreative({
  product,
  imageUrl,
  imageLoading,
  onRegenerate,
}: {
  product: Product;
  imageUrl: string | null;
  imageLoading: boolean;
  onRegenerate: () => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <Label>Ad Creative</Label>
      <div
        className="relative h-72 w-full overflow-hidden"
        style={{ ...cardStyle, isolation: "isolate" }}
      >
        {/* Regenerate the scene with a fresh seed — appears once loaded. */}
        {imgLoaded && !imgError && (
          <button
            type="button"
            onClick={onRegenerate}
            aria-label="Regenerate scene"
            title="Regenerate scene"
            className="absolute top-2 right-2 z-10 flex items-center justify-center rounded-full transition-transform duration-200 hover:rotate-90"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              color: "#fff",
              padding: 6,
            }}
          >
            <RefreshCw size={16} strokeWidth={2} />
          </button>
        )}
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="AI-generated background scene"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
              style={{ opacity: imgLoaded && !imgError ? 1 : 0 }}
            />
            {imgLoaded && !imgError && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="absolute left-1/2 top-1/2 max-h-[65%] -translate-x-1/2 -translate-y-1/2 object-contain"
                style={{
                  // multiply drops the product shot's white box into the scene.
                  mixBlendMode: "multiply",
                  filter: "drop-shadow(0 12px 28px rgba(0,0,0,0.35))",
                }}
              />
            )}
            {/* Teal skeleton while the scene loads (or an error message). */}
            {(!imgLoaded || imgError) && (
              <div
                className="absolute inset-0 flex items-center justify-center animate-pulse"
                style={{ backgroundColor: "var(--skeleton)" }}
              >
                <span
                  className="text-xs uppercase tracking-[0.15em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {imgError
                    ? "Scene generation failed — retry"
                    : "Generating scene..."}
                </span>
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
  product,
  copyResult,
  imageUrl,
  copyLoading,
  imageLoading,
  isRevealing,
  onRegenerateImage,
  onRegenerateCopy,
}: OutputPanelProps) {
  const adLabels = ["Short", "Benefit-led", "Story"];

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
        {/* Product shot */}
        <div className="flex flex-col gap-3">
          <Label>Product Shot</Label>
          <div
            className="h-72 w-full flex items-center justify-center p-6"
            style={cardStyle}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>

        {/* Ad creative — generated scene + real product composited on top.
            Keyed by imageUrl so its load state resets per generation. */}
        <AdCreative
          key={imageUrl ?? "none"}
          product={product}
          imageUrl={imageUrl}
          imageLoading={imageLoading}
          onRegenerate={onRegenerateImage}
        />
      </Reveal>

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

      {/* Paid ad copy */}
      <Reveal revealed={isRevealing} index={3}>
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
          <Reveal revealed={isRevealing} index={4} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
        <Reveal revealed={isRevealing} index={5} className="flex flex-col gap-3">
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
