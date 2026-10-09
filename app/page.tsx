"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PRODUCTS,
  campaignLabel,
  type Product,
  type GeneratedCopy,
  type GeneratedImage,
} from "@/lib/products";
import {
  loadHistory,
  pushHistory,
  updateHistoryCopy,
  clearHistory,
  type HistoryEntry,
} from "@/lib/history";
import ProductGrid from "@/components/ProductGrid";
import VibePicker from "@/components/VibePicker";
import OutputPanel from "@/components/OutputPanel";
import RefineChat from "@/components/RefineChat";
import PlatformPreviews from "@/components/PlatformPreviews";
import DownloadBar from "@/components/DownloadBar";
import HistoryStrip from "@/components/HistoryStrip";
import ProductImage from "@/components/ProductImage";

// Cycled below the Generate button while a generation is in flight.
const GENERATION_STEPS = [
  "Reading the brief —",
  "Finding the voice —",
  "Crafting the caption —",
  "Writing ad variants —",
  "Composing the scene —",
  "Finishing touches —",
];

const ALL_IDS = PRODUCTS.map((p) => p.id);
// The object shown in the hero before anything is selected.
const HERO_DEFAULT = PRODUCTS[0];

export default function Home() {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [selectedHairConcern, setSelectedHairConcern] = useState<string | null>(
    null,
  );

  const [copyResult, setCopyResult] = useState<GeneratedCopy | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  // The scene that actually painted (a retry changes the seed). Previews and
  // the download use this, so they never show a URL that failed.
  const [sceneUrl, setSceneUrl] = useState<string | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  // The history entry the on-screen campaign belongs to, so refines update it.
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  // Monotonic id for the current generation. Bumped on every new generation AND
  // whenever the selection changes / a campaign is restored, so an in-flight
  // async that resolves late can check it's still current before applying state
  // — a stale result is discarded instead of overwriting the new selection.
  const genIdRef = useRef(0);

  const isGenerating = copyLoading || imageLoading;

  // Selected products in catalogue order (stable — bundle layouts index into it).
  const selectedProducts = useMemo(
    () => PRODUCTS.filter((p) => selectedProductIds.includes(p.id)),
    [selectedProductIds],
  );
  const allSelected = selectedProductIds.length === ALL_IDS.length;

  // Hydrate the recent-campaigns strip from localStorage once, client-side.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  // Advance the progress index every 1.6s while generating.
  useEffect(() => {
    if (!isGenerating) return;
    const id = setInterval(() => setStepIndex((n) => n + 1), 1600);
    return () => clearInterval(id);
  }, [isGenerating]);

  const generationStep = GENERATION_STEPS[stepIndex % GENERATION_STEPS.length];

  // Any change to the selection invalidates the current output — and any
  // generation still in flight (bumping the id discards its late result).
  const clearOutput = () => {
    genIdRef.current += 1;
    setCopyResult(null);
    setImageUrl(null);
    setSceneUrl(null);
    setHasGenerated(false);
    setIsRevealing(false);
    setError(null);
    setActiveHistoryId(null);
  };

  const handleToggleProduct = (p: Product) => {
    setSelectedProductIds((prev) =>
      prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
    );
    clearOutput();
  };

  const handleSelectAll = () => {
    setSelectedProductIds((prev) => (prev.length === ALL_IDS.length ? [] : ALL_IDS));
    clearOutput();
  };

  const runCopy = async (
    products: Product[],
    vibe: string,
    concern: string | null,
    genId: number,
  ): Promise<GeneratedCopy | null> => {
    setCopyLoading(true);
    try {
      const res = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productIds: products.map((p) => p.id),
          vibe,
          hairConcern: concern ?? undefined,
          mode: "generate",
        }),
      });
      const data = await res.json();
      // Selection changed (or a newer generation started) while we waited —
      // discard this result silently rather than applying it.
      if (genIdRef.current !== genId) return null;
      if (!res.ok) throw new Error(data?.error ?? `Copy failed (${res.status}).`);
      const copy = data as GeneratedCopy;
      setCopyResult(copy);
      return copy;
    } catch (err) {
      if (genIdRef.current === genId) {
        setError(err instanceof Error ? err.message : "Copy generation failed.");
      }
      return null;
    } finally {
      if (genIdRef.current === genId) setCopyLoading(false);
    }
  };

  const runImage = async (
    sceneDescription: string,
    leadProductName: string,
    vibe: string,
    genId: number,
  ): Promise<string | null> => {
    setImageLoading(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneDescription,
          productName: leadProductName,
          vibe,
        }),
      });
      const data = await res.json();
      if (genIdRef.current !== genId) return null; // stale — discard
      if (!res.ok) throw new Error(data?.error ?? `Image failed (${res.status}).`);
      const url = (data as GeneratedImage).imageUrl;
      setImageUrl(url);
      setSceneUrl(null);
      return url;
    } catch (err) {
      if (genIdRef.current === genId) {
        setError(err instanceof Error ? err.message : "Image generation failed.");
      }
      return null;
    } finally {
      if (genIdRef.current === genId) setImageLoading(false);
    }
  };

  const handleGenerate = () => {
    if (selectedProducts.length === 0 || !selectedVibe || isGenerating) return;
    const products = selectedProducts;
    const vibe = selectedVibe;
    const myId = (genIdRef.current += 1);
    setError(null);
    setHasGenerated(true);
    setIsRevealing(false);
    setStepIndex(0);
    setActiveHistoryId(null);
    document
      .getElementById("campaign")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Sequential: copy first (typewriter kicks in fast), then the scene Groq
    // purpose-built for this campaign. Reveal once both settle. Each await is
    // followed by a freshness check so a selection change mid-flight discards
    // this run rather than landing on top of the new selection.
    void (async () => {
      const copy = await runCopy(products, vibe, selectedHairConcern, myId);
      if (genIdRef.current !== myId) return;
      let url: string | null = null;
      if (copy) {
        url = await runImage(
          copy.scene_for_image_gen,
          products[0].name,
          vibe,
          myId,
        );
      }
      if (genIdRef.current !== myId) return;
      setIsRevealing(true);
      if (copy) {
        const entry: HistoryEntry = {
          id: Date.now().toString(),
          productIds: products.map((p) => p.id),
          productNames: products.map((p) => p.name),
          label: campaignLabel(products),
          productImage: products[0].imageUrl,
          vibe,
          hairConcern: selectedHairConcern,
          campaignAngle: copy.campaignAngle,
          caption: copy.instagramCaption,
          copy,
          imageUrl: url,
          timestamp: Date.now(),
        };
        setHistory((prev) => pushHistory(prev, entry));
        setActiveHistoryId(entry.id);
      }
    })();
  };

  // Restore a saved campaign back into the main state so the full output panel
  // reappears exactly as it was generated.
  const handleRestoreCampaign = (entry: HistoryEntry) => {
    const ids = entry.productIds.filter((id) =>
      PRODUCTS.some((p) => p.id === id),
    );
    if (ids.length === 0) return;
    // Invalidate any in-flight generation so it can't overwrite the restore.
    genIdRef.current += 1;
    setSelectedProductIds(ids);
    setSelectedVibe(entry.vibe);
    setSelectedHairConcern(entry.hairConcern);
    setCopyResult(entry.copy);
    setImageUrl(entry.imageUrl);
    setSceneUrl(null);
    setError(null);
    setHasGenerated(true);
    setIsRevealing(true);
    setActiveHistoryId(entry.id);
    document
      .getElementById("campaign")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const handleRefined = (copy: GeneratedCopy) => {
    setCopyResult(copy);
    if (activeHistoryId) {
      setHistory((prev) => updateHistoryCopy(prev, activeHistoryId, copy));
    }
  };

  const hasSelection = selectedProducts.length > 0;
  const isBundle = selectedProducts.length >= 2;
  const heroProduct = selectedProducts[0] ?? HERO_DEFAULT;
  const showCampaign = hasGenerated && hasSelection;
  const canGenerate = hasSelection && !!selectedVibe && !isGenerating;
  const generateHint = !hasSelection
    ? "Pick at least one product above"
    : !selectedVibe
      ? "Choose a vibe"
      : isGenerating
        ? generationStep
        : `${campaignLabel(selectedProducts)} · ${selectedVibe}${selectedHairConcern ? ` · ${selectedHairConcern}` : ""}`;

  return (
    <div id="top" className="flex flex-col">
      {/* ── HERO — the object in the dark ─────────────────────────────── */}
      <section className="relative flex min-h-[100svh] flex-col justify-between px-4 pb-6 pt-24 sm:px-6 lg:pr-12">
        <div className="grid flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-[18px]">
          {/* Type sits above the object so the wordmark always reads whole. */}
          <div className="pointer-events-none relative z-10 flex flex-col gap-4 lg:col-span-4 lg:self-start lg:pt-[8vh]">
            <span className="label">Great hair, made easy — campaign studio</span>
            <h1 className="display">
              MD
              <br />
              Creative.
            </h1>
          </div>

          <div className="relative flex h-[44vh] items-center justify-center lg:col-span-4 lg:h-[64vh]">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                // Warm rim light from the upper right, as the reference lights its object.
                background:
                  "radial-gradient(ellipse 55% 50% at 62% 42%, rgba(220,80,0,0.16), rgba(56,36,22,0.35) 45%, rgba(16,9,4,0) 75%)",
              }}
            />
            <div className="animate-drift relative h-full w-full">
              <ProductImage
                key={heroProduct.id}
                product={heroProduct}
                className="animate-fade-in-up h-full w-full"
              />
            </div>
          </div>

          <div className="flex flex-col gap-8 lg:col-span-4 lg:self-end lg:pb-[6vh]">
            <p className="body-voice">
              One product in, a whole campaign out. Caption, paid ads, a TikTok
              script and a scene to stage it in, written in mdlondon&rsquo;s voice.
            </p>
            <a href="#range" className="btn-ghost self-start">
              Start with the range ↓
            </a>
          </div>
        </div>

        {/* Info card, bottom-left. */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div
            className="flex max-w-sm flex-col gap-3 p-5"
            style={{
              borderRadius: "var(--radius-card)",
              background: "rgba(56,36,22,0.55)",
            }}
          >
            <span className="label">
              <span className="credit">Built by</span> Kautum Krishnan, for
              mdlondon.
            </span>
            <hr className="rule-dashed" style={{ borderColor: "var(--driftwood)" }} />
            <p className="body-sm" style={{ color: "var(--cream-70)", fontSize: 13 }}>
              Groq writes the copy. Pollinations paints the scene. The real
              product is cut out and composited in your browser.
            </p>
          </div>
          <span className="label" style={{ color: "var(--cream-50)" }}>
            {heroProduct.name} — £{heroProduct.price}
          </span>
        </div>
      </section>

      {/* ── 01 RANGE ─────────────────────────────────────────────────── */}
      <section id="range" className={SECTION}>
        <SectionHead index="01" title="Pick the object.">
          <button type="button" onClick={handleSelectAll} className="link">
            {allSelected ? "Clear selection" : `Select all ${ALL_IDS.length}`}
          </button>
        </SectionHead>
        <ProductGrid
          selectedIds={selectedProductIds}
          onToggle={handleToggleProduct}
        />
      </section>

      {/* ── 02 BRIEF ─────────────────────────────────────────────────── */}
      <section id="brief" className={SECTION}>
        <SectionHead index="02" title="Set the brief." />
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-[18px]">
          <div className="flex flex-col gap-8 lg:col-span-5">
            <p className="body-voice" style={{ color: "var(--cream-70)" }}>
              {hasSelection ? (
                <>
                  You&rsquo;re writing for{" "}
                  <span style={{ color: "var(--cream)" }}>
                    {campaignLabel(selectedProducts)}
                  </span>
                  .{" "}
                  {isBundle
                    ? "One idea, framed as a routine — not a list."
                    : selectedProducts[0].tagline}
                </>
              ) : (
                "Nothing selected yet. Pick one product for a hero campaign, or a few for a bundle."
              )}
            </p>
            {history.length > 0 && (
              <HistoryStrip
                entries={history}
                activeId={activeHistoryId}
                onRestore={handleRestoreCampaign}
                onClear={handleClearHistory}
              />
            )}
          </div>
          <div className="flex flex-col gap-10 lg:col-span-6 lg:col-start-7">
            <VibePicker
              selectedVibe={selectedVibe}
              onSelectVibe={setSelectedVibe}
              selectedConcern={selectedHairConcern}
              onSelectConcern={setSelectedHairConcern}
              disabled={isGenerating}
            />
            <hr className="rule-dashed" />
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="btn-filled self-start"
              >
                {isGenerating
                  ? "Generating…"
                  : isBundle
                    ? "Generate bundle campaign →"
                    : "Generate campaign →"}
              </button>
              <span
                key={generateHint}
                aria-live="polite"
                className="label animate-fade-in-up"
                style={{ color: "var(--cream-50)" }}
              >
                {generateHint}
              </span>
            </div>
            {error && (
              <div role="alert" className="card flex flex-col gap-2 p-5">
                <span className="label">Something went wrong</span>
                <p className="body-sm" style={{ color: "var(--cream-70)" }}>
                  {error}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 03 CAMPAIGN ──────────────────────────────────────────────── */}
      <section id="campaign" className={SECTION}>
        <SectionHead
          index="03"
          title={
            showCampaign ? `${campaignLabel(selectedProducts)}.` : "The campaign."
          }
        >
          {showCampaign && selectedVibe && (
            <span className="label" style={{ color: "var(--cream-50)" }}>
              {selectedVibe}
              {selectedHairConcern ? ` · ${selectedHairConcern}` : ""}
            </span>
          )}
        </SectionHead>
        {showCampaign ? (
          <OutputPanel
            products={selectedProducts}
            copyResult={copyResult}
            imageUrl={imageUrl}
            copyLoading={copyLoading}
            imageLoading={imageLoading}
            isRevealing={isRevealing}
            onRegenerate={handleGenerate}
            onSceneLoaded={setSceneUrl}
          />
        ) : (
          <EmptyState text="Your campaign lands here — set the brief and generate." />
        )}
      </section>

      {/* ── 04 PREVIEW ───────────────────────────────────────────────── */}
      <section id="preview" className={SECTION}>
        <SectionHead index="04" title="How it lands." />
        {showCampaign && copyResult && selectedVibe ? (
          <div className="flex flex-col gap-[68px]">
            <PlatformPreviews
              products={selectedProducts}
              copyResult={copyResult}
              imageUrl={sceneUrl}
              isRevealing={isRevealing}
            />
            <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-2">
              <div className="card p-6">
                <RefineChat
                  products={selectedProducts}
                  vibe={selectedVibe}
                  hairConcern={selectedHairConcern}
                  currentCopy={copyResult}
                  onRefined={handleRefined}
                />
              </div>
              <DownloadBar
                products={selectedProducts}
                copyResult={copyResult}
                imageUrl={sceneUrl}
              />
            </div>
          </div>
        ) : (
          <EmptyState text="Instagram and TikTok mockups appear once there's copy to show." />
        )}
      </section>

      <footer className="flex flex-col gap-2 px-4 py-10 sm:flex-row sm:justify-between sm:px-6 lg:pr-12">
        <span className="legal">
          * MD Creative is an independent concept tool. Not affiliated with or
          endorsed by mdlondon.
        </span>
        <span className="legal">
          <span className="credit">Built by</span> Kautum Krishnan · v2.0
        </span>
      </footer>
    </div>
  );
}

const SECTION =
  "rule-dashed flex flex-col gap-12 px-4 py-[68px] sm:px-6 lg:min-h-[100svh] lg:pr-12 lg:py-[120px]";

function SectionHead({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-4">
        <span className="label" style={{ color: "var(--cream-50)" }}>
          {index}
        </span>
        <h2 className="heading">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center p-8 text-center"
      style={{
        borderRadius: "var(--radius-card)",
        border: "1px dashed var(--cork)",
      }}
    >
      <span className="label" style={{ color: "var(--cream-50)" }}>
        {text}
      </span>
    </div>
  );
}
