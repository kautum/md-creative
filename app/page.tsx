"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { Product, GeneratedCopy, GeneratedImage } from "@/lib/products";
import ProductGrid from "@/components/ProductGrid";
import VibePicker from "@/components/VibePicker";
import OutputPanel from "@/components/OutputPanel";
import RefineChat from "@/components/RefineChat";
import PlatformPreviews from "@/components/PlatformPreviews";
import DownloadBar from "@/components/DownloadBar";

// Cycled below the Generate button while a generation is in flight.
const GENERATION_STEPS = [
  "✦ Reading the brief...",
  "✦ Finding the voice...",
  "✦ Crafting the caption...",
  "✦ Writing ad variants...",
  "✦ Composing the scene...",
  "✦ Finishing touches...",
];

export default function Home() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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

  const isGenerating = copyLoading || imageLoading;

  // Advance the progress index every 1.6s while generating. The index only
  // changes inside the timer callback; the message is derived below.
  useEffect(() => {
    if (!isGenerating) return;
    const id = setInterval(
      () => setStepIndex((n) => n + 1),
      1600,
    );
    return () => clearInterval(id);
  }, [isGenerating]);

  const generationStep =
    GENERATION_STEPS[stepIndex % GENERATION_STEPS.length];

  const handleSelectProduct = (p: Product) => {
    if (p.id === selectedProduct?.id) return;
    // New product = fresh session: clear any prior output.
    setSelectedProduct(p);
    setCopyResult(null);
    setImageUrl(null);
    setHasGenerated(false);
    setIsRevealing(false);
    setError(null);
  };

  const runCopy = async (
    product: Product,
    vibe: string,
    concern: string | null,
  ): Promise<GeneratedCopy | null> => {
    setCopyLoading(true);
    try {
      const res = await fetch("/api/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
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
    productName: string,
    vibe: string,
  ) => {
    setImageLoading(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneDescription, productName, vibe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Image failed (${res.status}).`);
      setImageUrl((data as GeneratedImage).imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed.");
    } finally {
      setImageLoading(false);
    }
  };

  // Regenerate just the scene — same campaign scene prompt, fresh random seed.
  const handleRegenerateImage = () => {
    if (!selectedProduct || !selectedVibe || !copyResult || imageLoading) return;
    setImageUrl(null); // back to skeleton while the new scene loads
    void runImage(
      copyResult.scene_for_image_gen,
      selectedProduct.name,
      selectedVibe,
    );
  };

  // Regenerate just the copy — same inputs; the typewriter restarts on the new
  // caption (keyed by text in OutputPanel). The image is left untouched.
  const handleRegenerateCopy = () => {
    if (!selectedProduct || !selectedVibe || copyLoading) return;
    void runCopy(selectedProduct, selectedVibe, selectedHairConcern);
  };

  const handleGenerate = () => {
    if (!selectedProduct || !selectedVibe || isGenerating) return;
    const product = selectedProduct;
    const vibe = selectedVibe;
    setError(null);
    setHasGenerated(true);
    setIsRevealing(false);
    setStepIndex(0);
    // Sequential: copy first (typewriter kicks in fast), then kick off the
    // image using the scene Groq purpose-built for this campaign. Reveal once
    // both resolve — runCopy/runImage catch their own errors, so this settles.
    void (async () => {
      const copy = await runCopy(product, vibe, selectedHairConcern);
      if (copy) {
        await runImage(copy.scene_for_image_gen, product.name, vibe);
      }
      setIsRevealing(true);
    })();
  };

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
          Pick a product, set the vibe, and generate on-brand captions, ad copy
          and a lifestyle scene.
        </p>
      </header>

      {!selectedProduct && (
        <p
          className="text-xs uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          Select a product to get started.
        </p>
      )}

      <ProductGrid selected={selectedProduct} onSelect={handleSelectProduct} />

      {selectedProduct && (
        <VibePicker
          selectedVibe={selectedVibe}
          onSelectVibe={setSelectedVibe}
          selectedConcern={selectedHairConcern}
          onSelectConcern={(c) => setSelectedHairConcern(c === "" ? null : c)}
        />
      )}

      {selectedProduct && selectedVibe && (
        <div className="flex flex-col items-center gap-3">
          <motion.button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: 1,
              y: 0,
              // Gentle pulse when ready; hold steady while generating.
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
            {isGenerating ? "Generating..." : "Generate Content"}
          </motion.button>
          {/* Cycling progress message — fades between steps. */}
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

      {hasGenerated && selectedProduct && (
        <OutputPanel
          product={selectedProduct}
          copyResult={copyResult}
          imageUrl={imageUrl}
          copyLoading={copyLoading}
          imageLoading={imageLoading}
          isRevealing={isRevealing}
          onRegenerateImage={handleRegenerateImage}
          onRegenerateCopy={handleRegenerateCopy}
        />
      )}

      {hasGenerated && selectedProduct && copyResult && (
        <RefineChat
          product={selectedProduct}
          currentCopy={copyResult}
          onRefined={setCopyResult}
        />
      )}
      </div>

      {hasGenerated && selectedProduct && copyResult && (
        <PlatformPreviews
          product={selectedProduct}
          copyResult={copyResult}
          imageUrl={imageUrl}
          isRevealing={isRevealing}
        />
      )}

      {hasGenerated && selectedProduct && copyResult && (
        <DownloadBar
          product={selectedProduct}
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
