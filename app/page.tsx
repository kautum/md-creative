"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  PRODUCTS,
  type Product,
  type GeneratedCopy,
  type GeneratedImage,
} from "@/lib/products";
import {
  loadHistory,
  pushHistory,
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

// Cycled below the Generate button while a generation is in flight.
const GENERATION_STEPS = [
  "✦ Reading the brief...",
  "✦ Finding the voice...",
  "✦ Crafting the caption...",
  "✦ Writing ad variants...",
  "✦ Composing the scene...",
  "✦ Finishing touches...",
];

const ALL_IDS = PRODUCTS.map((p) => p.id);

export default function Home() {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedVibe, setSelectedVibe] = useState<string | null>(null);
  const [selectedHairConcern, setSelectedHairConcern] = useState<string | null>(
    null,
  );

  const [copyResult, setCopyResult] = useState<GeneratedCopy | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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

  // Any change to the selection invalidates the current output.
  const clearOutput = () => {
    setCopyResult(null);
    setImageUrl(null);
    setHasGenerated(false);
    setIsRevealing(false);
    setError(null);
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
      if (!res.ok) throw new Error(data?.error ?? `Copy failed (${res.status}).`);
      const copy = data as GeneratedCopy;
      setCopyResult(copy);
      return copy;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Copy generation failed.");
      return null;
    } finally {
      setCopyLoading(false);
    }
  };

  const runImage = async (
    sceneDescription: string,
    leadProductName: string,
    vibe: string,
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
      if (!res.ok) throw new Error(data?.error ?? `Image failed (${res.status}).`);
      const url = (data as GeneratedImage).imageUrl;
      setImageUrl(url);
      return url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed.");
      return null;
    } finally {
      setImageLoading(false);
    }
  };

  // Regenerate just the copy — same inputs; the typewriter restarts on the new
  // caption (keyed by text in OutputPanel). The image is left untouched.
  const handleRegenerateCopy = () => {
    if (selectedProducts.length === 0 || !selectedVibe || copyLoading) return;
    void runCopy(selectedProducts, selectedVibe, selectedHairConcern);
  };

  const handleGenerate = () => {
    if (selectedProducts.length === 0 || !selectedVibe || isGenerating) return;
    const products = selectedProducts;
    const vibe = selectedVibe;
    setError(null);
    setHasGenerated(true);
    setIsRevealing(false);
    setStepIndex(0);
    // Sequential: copy first (typewriter kicks in fast), then the scene Groq
    // purpose-built for this campaign. Reveal once both settle.
    void (async () => {
      const copy = await runCopy(products, vibe, selectedHairConcern);
      let url: string | null = null;
      if (copy) {
        url = await runImage(copy.scene_for_image_gen, products[0].name, vibe);
      }
      setIsRevealing(true);
      if (copy) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#FF5C00", "#ffffff", "#2A4F4F"],
          disableForReducedMotion: true,
        });
        const entry: HistoryEntry = {
          id: Date.now().toString(),
          productIds: products.map((p) => p.id),
          productNames: products.map((p) => p.name),
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
    setSelectedProductIds(ids);
    setSelectedVibe(entry.vibe);
    setSelectedHairConcern(entry.hairConcern);
    setCopyResult(entry.copy);
    setImageUrl(entry.imageUrl);
    setError(null);
    setHasGenerated(true);
    setIsRevealing(true);
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const hasSelection = selectedProducts.length > 0;
  const isBundle = selectedProducts.length >= 2;

  return (
    <div className="flex flex-col">
      <div className="mx-auto w-full max-w-5xl px-6 sm:px-10 py-12 flex flex-col gap-14">
        <header className="flex flex-col gap-3">
          <h1
            className="font-heading font-light tracking-[0.05em]"
            style={{
              color: "var(--text-primary)",
              fontSize: "clamp(2rem, 4vw, 3.5rem)",
              lineHeight: 1.1,
            }}
          >
            Social Content Generator
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Pick one product — or a few for a bundle — set the vibe, and generate
            on-brand captions, ad copy and a lifestyle scene.
          </p>
          <button
            type="button"
            onClick={handleSelectAll}
            className="self-start text-[11px] uppercase tracking-[0.18em] transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
          >
            {allSelected ? "Clear selection" : `Select all ${ALL_IDS.length}`}
          </button>
        </header>

        {history.length > 0 && (
          <HistoryStrip
            entries={history}
            onRestore={handleRestoreCampaign}
            onClear={handleClearHistory}
          />
        )}

        {!hasSelection && (
          <p
            className="text-xs uppercase tracking-[0.2em]"
            style={{ color: "var(--text-muted)" }}
          >
            Select a product to get started.
          </p>
        )}

        <ProductGrid
          selectedIds={selectedProductIds}
          onToggle={handleToggleProduct}
        />

        {hasSelection && (
          <VibePicker
            selectedVibe={selectedVibe}
            onSelectVibe={setSelectedVibe}
            selectedConcern={selectedHairConcern}
            onSelectConcern={(c) => setSelectedHairConcern(c === "" ? null : c)}
          />
        )}

        {hasSelection && selectedVibe && (
          <div className="flex flex-col items-center gap-3">
            <motion.button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: isGenerating ? 1 : [1, 1.02, 1],
              }}
              whileHover={isGenerating ? undefined : { scale: 1.03 }}
              transition={{
                opacity: { duration: 0.3 },
                y: { duration: 0.3 },
                scale: isGenerating
                  ? { duration: 0.2 }
                  : { duration: 2, repeat: Infinity, ease: "easeInOut" },
              }}
              className="font-heading w-full rounded-sm py-4 text-sm font-medium uppercase tracking-[0.3em] disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "#FFFFFF" }}
            >
              {isGenerating
                ? "Generating..."
                : isBundle
                  ? "Generate Bundle Campaign"
                  : "Generate Content"}
            </motion.button>
            <p
              className="h-4 text-[11px] uppercase transition-opacity duration-500"
              style={{
                letterSpacing: "0.12em",
                color: "#FF5C00",
                opacity: isGenerating ? 1 : 0,
              }}
            >
              <span key={generationStep} className="animate-fade-in-up">
                {generationStep}
              </span>
            </p>
          </div>
        )}

        {error && (
          <div
            className="px-4 py-3 text-sm"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--accent)",
              color: "var(--text-primary)",
            }}
          >
            {error}
          </div>
        )}

        {hasGenerated && hasSelection && (
          <OutputPanel
            products={selectedProducts}
            copyResult={copyResult}
            imageUrl={imageUrl}
            copyLoading={copyLoading}
            imageLoading={imageLoading}
            isRevealing={isRevealing}
            onRegenerateCopy={handleRegenerateCopy}
          />
        )}

        {hasGenerated && hasSelection && copyResult && selectedVibe && (
          <RefineChat
            products={selectedProducts}
            vibe={selectedVibe}
            currentCopy={copyResult}
            onRefined={setCopyResult}
          />
        )}
      </div>

      {hasGenerated && hasSelection && copyResult && (
        <PlatformPreviews
          products={selectedProducts}
          copyResult={copyResult}
          imageUrl={imageUrl}
          isRevealing={isRevealing}
        />
      )}

      {hasGenerated && hasSelection && copyResult && (
        <DownloadBar
          products={selectedProducts}
          copyResult={copyResult}
          imageUrl={imageUrl}
        />
      )}

      <div className="mx-auto w-full max-w-5xl px-6 sm:px-10 pb-12">
        <footer
          className="pt-8 border-t text-xs leading-relaxed"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          MD Creative is an independent concept tool built by Kautum Krishnan as
          part of a job application to mdlondon. Not affiliated with mdlondon.
        </footer>
      </div>
    </div>
  );
}
