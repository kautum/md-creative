"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  PRODUCTS,
  campaignLabel,
  matchRoutine,
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
import { decodeCampaign, SHARE_PREFIX, type SharedCampaign } from "@/lib/share";
import type { LiveCatalogue } from "@/lib/livePrices";
import HeroStage from "@/components/HeroStage";
import Marquee from "@/components/Marquee";
import RangeGallery from "@/components/RangeGallery";
import ScrollWords from "@/components/ScrollWords";
import VibePicker from "@/components/VibePicker";
import OutputPanel from "@/components/OutputPanel";
import RefineChat from "@/components/RefineChat";
import PlatformPreviews from "@/components/PlatformPreviews";
import ShareCard from "@/components/ShareCard";
import DownloadBar from "@/components/DownloadBar";
import HistoryStrip from "@/components/HistoryStrip";
import SelectionCapsule from "@/components/SelectionCapsule";

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

  // Live prices from mdlondon.com (hourly). Until they arrive — or if the
  // store can't be reached — the dated static prices show, and say so.
  const [live, setLive] = useState<LiveCatalogue | null>(null);
  useEffect(() => {
    fetch("/api/catalogue")
      .then((r) => (r.ok ? (r.json() as Promise<LiveCatalogue>) : null))
      .then((c) => {
        if (c && (c.source === "live" || c.source === "static") && typeof c.prices === "object") setLive(c);
      })
      .catch((err) => console.warn("[catalogue] using static prices:", err));
  }, []);
  const catalogue = useMemo(
    () => PRODUCTS.map((p) => ({ ...p, ...(live?.prices[p.id] ?? {}) })),
    [live],
  );
  const priceNote =
    live?.source === "live" ? "Live prices from mdlondon.com" : "Prices as of 9 Oct 2026";

  // Selected products in catalogue order (stable — bundle layouts index into it).
  const selectedProducts = useMemo(
    () => catalogue.filter((p) => selectedProductIds.includes(p.id)),
    [catalogue, selectedProductIds],
  );

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

  const handlePickRoutine = (ids: string[]) => {
    setSelectedProductIds(ids);
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

  // Put a finished campaign (from history or a share link) back on screen
  // exactly as it was generated.
  const applyCampaign = (c: SharedCampaign, historyId: string | null) => {
    // Invalidate any in-flight generation so it can't overwrite the restore.
    genIdRef.current += 1;
    setSelectedProductIds(c.ids);
    setSelectedVibe(c.vibe);
    setSelectedHairConcern(c.concern);
    setCopyResult(c.copy);
    setImageUrl(c.imageUrl);
    setSceneUrl(null);
    setError(null);
    setHasGenerated(true);
    setIsRevealing(true);
    setActiveHistoryId(historyId);
    requestAnimationFrame(() =>
      document.getElementById("campaign")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  const handleRestoreCampaign = (entry: HistoryEntry) => {
    const ids = entry.productIds.filter((id) => PRODUCTS.some((p) => p.id === id));
    if (ids.length === 0) return;
    applyCampaign(
      {
        ids,
        vibe: entry.vibe,
        concern: entry.hairConcern,
        copy: entry.copy,
        imageUrl: entry.imageUrl,
      },
      entry.id,
    );
  };

  // Open a shared campaign link (#c=…) once on load. A damaged link says so
  // instead of half-loading.
  useEffect(() => {
    if (!window.location.hash.startsWith(SHARE_PREFIX)) return;
    decodeCampaign(window.location.hash)
      .then((c) => applyCampaign(c, null))
      .catch((err) => {
        console.warn("[share] rejected link:", err);
        setError("This share link is damaged or out of date — generate a fresh campaign instead.");
      })
      .finally(() => window.history.replaceState(null, "", window.location.pathname));
  }, []);

  // ⌘/Ctrl + Enter generates from anywhere on the page.
  const generateRef = useRef<() => void>(() => {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        generateRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  useEffect(() => {
    generateRef.current = handleGenerate;
  });

  const hasSelection = selectedProducts.length > 0;
  const isBundle = selectedProducts.length >= 2;
  const heroProduct = selectedProducts[0] ?? HERO_DEFAULT;
  const showCampaign = hasGenerated && hasSelection;
  const canGenerate = hasSelection && !!selectedVibe && !isGenerating;
  const generateHint = !hasSelection
    ? "Pick at least one product from the range"
    : !selectedVibe
      ? "Choose a vibe"
      : isGenerating
        ? generationStep
        : `${campaignLabel(selectedProducts)} · ${selectedVibe}${selectedHairConcern ? ` · ${selectedHairConcern}` : ""} · ⌘↵`;

  const suggestedVibes = mostShared(selectedProducts, (p) => p.bestFor);
  const suggestedConcerns = mostShared(selectedProducts, (p) => p.hairConcerns);

  const shared: SharedCampaign | null =
    showCampaign && copyResult && selectedVibe
      ? {
          ids: selectedProducts.map((p) => p.id),
          vibe: selectedVibe,
          concern: selectedHairConcern,
          copy: copyResult,
          imageUrl: sceneUrl ?? imageUrl,
        }
      : null;

  return (
    <div className="flex flex-col">
      <HeroStage product={heroProduct} />

      <Marquee />

      <RangeGallery
        selectedIds={selectedProductIds}
        onToggle={handleToggleProduct}
        onSelectAll={handleSelectAll}
        onPickRoutine={handlePickRoutine}
        products={catalogue}
        priceNote={priceNote}
        promotions={live?.promotions ?? []}
      />

      {/* ── 02 BRIEF ─────────────────────────────────────────────────── */}
      <section id="brief" className={SECTION}>
        <SectionHead index="02 — The brief" title="Set the brief." />
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-[18px]">
          <div className="flex flex-col gap-10 lg:col-span-5">
            <ScrollWords
              key={selectionSentence(selectedProducts)}
              text={selectionSentence(selectedProducts)}
              className="body-voice"
            />
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
              suggestedVibes={suggestedVibes}
              suggestedConcerns={suggestedConcerns}
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
                style={{ color: "var(--fg-50)" }}
              >
                {generateHint}
              </span>
            </div>
            {error && (
              <div role="alert" className="card flex flex-col gap-2 p-5">
                <span className="label">Something went wrong</span>
                <p className="body-sm" style={{ color: "var(--fg-70)" }}>
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
          index="03 — The campaign"
          title={showCampaign ? `${campaignLabel(selectedProducts)}.` : "The campaign."}
        >
          {showCampaign && selectedVibe && (
            <span className="label" style={{ color: "var(--fg-50)" }}>
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
        <SectionHead index="04 — In the feed" title="How it lands." />
        {shared && copyResult && selectedVibe ? (
          <div className="flex flex-col gap-[68px]">
            <PlatformPreviews
              products={selectedProducts}
              copyResult={copyResult}
              imageUrl={sceneUrl}
            />
            <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-3">
              <div className="card p-6">
                <RefineChat
                  products={selectedProducts}
                  vibe={selectedVibe}
                  hairConcern={selectedHairConcern}
                  currentCopy={copyResult}
                  onRefined={handleRefined}
                />
              </div>
              <ShareCard campaign={shared} />
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

      <footer className="flex flex-col gap-6 px-4 pb-28 pt-[68px] sm:px-6 lg:pr-12">
        <span className="display" style={{ fontSize: "clamp(64px, 14vw, 220px)", color: "var(--raised)" }}>
          KPK.
        </span>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <span className="legal">
            * MD Creative is an independent concept tool. Not affiliated with or
            endorsed by mdlondon.
          </span>
          <span className="legal">
            <span className="credit">Built by</span> Kautum Krishnan Panjalaraja · v3.2
          </span>
        </div>
      </footer>

      <SelectionCapsule
        products={selectedProducts}
        hasVibe={!!selectedVibe}
        isGenerating={isGenerating}
        hasCampaign={showCampaign}
        onGenerate={handleGenerate}
      />
    </div>
  );
}

/** The options most of the selected products are made for (ties included). */
function mostShared(products: Product[], pick: (p: Product) => readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const p of products) for (const v of pick(p)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const max = Math.max(0, ...counts.values());
  return max === 0 ? [] : [...counts].filter(([, n]) => n === max).map(([v]) => v);
}

function selectionSentence(products: Product[]): string {
  if (products.length === 0) {
    return "Nothing selected yet. Pick one product for a hero campaign, or a few for a bundle.";
  }
  if (products.length === 1) {
    return `You’re writing for ${products[0].name}. ${products[0].tagline}`;
  }
  const routine = matchRoutine(products.map((p) => p.id));
  if (routine) {
    return `You’re writing for mdlondon’s own ${routine.name} bundle — ${products.length} products, £${routine.price}, saving £${routine.wasPrice - routine.price}.`;
  }
  const total = products.reduce((s, p) => s + p.price, 0);
  return `You’re writing for ${campaignLabel(products)} — £${total} of kit, framed as one routine, not a list.`;
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
        <span className="label" style={{ color: "var(--fg-50)" }}>
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
        border: "1px dashed var(--line)",
      }}
    >
      <span className="label" style={{ color: "var(--fg-50)" }}>
        {text}
      </span>
    </div>
  );
}
