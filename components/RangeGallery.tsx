"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { PRODUCTS, type Product } from "@/lib/products";
import ProductImage from "@/components/ProductImage";

const DESKTOP = "(min-width: 1024px)";

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const tools = PRODUCTS.filter((p) => p.category === "tool");
const numbers = PRODUCTS.filter((p) => p.category === "number");

function Card({
  product,
  index,
  selected,
  onToggle,
}: {
  product: Product;
  index: number;
  selected: boolean;
  onToggle: (p: Product) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(product)}
      className="group relative flex h-[min(64vh,560px)] w-[78vw] shrink-0 snap-center flex-col justify-between overflow-hidden p-6 text-left transition-colors duration-300 sm:w-[46vw] lg:w-[min(27vw,400px)]"
      style={{
        borderRadius: "var(--radius-card)",
        border: `1px solid ${selected ? "var(--cream)" : "var(--cork)"}`,
        background: selected ? "var(--bark)" : "rgba(56,36,22,0.18)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="label" style={{ color: "var(--cream-50)" }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="label" style={{ color: selected ? "var(--cream)" : "var(--cream-50)" }}>
          {selected ? "Selected ✓" : "Select +"}
        </span>
      </div>
      <div className="relative my-4 flex-1">
        <div
          aria-hidden
          className="absolute inset-[8%] rounded-full opacity-50 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 60% 40%, rgba(255,237,215,0.12), rgba(255,237,215,0) 65%)",
          }}
        />
        <ProductImage
          product={product}
          className="absolute inset-0 h-full w-full transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="heading" style={{ fontSize: "clamp(26px, 2.4vw, 34px)" }}>
            {product.name}
          </span>
          <span className="label">£{product.price}</span>
        </div>
        <p className="body-sm line-clamp-2" style={{ color: "var(--cream-70)", fontSize: 14 }}>
          {product.tagline}
        </p>
      </div>
    </button>
  );
}

function Divider({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex h-[min(64vh,560px)] w-[60vw] shrink-0 snap-center flex-col justify-end gap-4 px-2 sm:w-[34vw] lg:w-[min(20vw,300px)]">
      <span className="label" style={{ color: "var(--cream-50)" }}>
        {note}
      </span>
      <span className="heading">{title}</span>
    </div>
  );
}

function Track({
  selectedIds,
  onToggle,
}: {
  selectedIds: string[];
  onToggle: (p: Product) => void;
}) {
  return (
    <>
      <Divider title="The tools." note="Six — £13 to £195" />
      {tools.map((p, i) => (
        <Card key={p.id} product={p} index={i} selected={selectedIds.includes(p.id)} onToggle={onToggle} />
      ))}
      <Divider title="The numbers." note="Six — £15 each" />
      {numbers.map((p, i) => (
        <Card key={p.id} product={p} index={i + tools.length} selected={selectedIds.includes(p.id)} onToggle={onToggle} />
      ))}
    </>
  );
}

function Header({
  count,
  allSelected,
  onSelectAll,
  progress,
}: {
  count: number;
  allSelected: boolean;
  onSelectAll: () => void;
  progress?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:pr-12">
      <div className="flex flex-col gap-4">
        <span className="label" style={{ color: "var(--cream-50)" }}>
          01 — The range
        </span>
        <h2 className="heading">Pick the object.</h2>
      </div>
      <div className="flex items-center gap-6">
        {progress}
        <span className="label" style={{ color: "var(--cream-50)" }}>
          {count} / {PRODUCTS.length} selected
        </span>
        <button type="button" onClick={onSelectAll} className="link">
          {allSelected ? "Clear" : "Select all"}
        </button>
      </div>
    </div>
  );
}

/**
 * The range as a horizontally advancing gallery (the Apple "highlights"
 * pattern). On desktop the section pins and vertical scroll drives the track
 * sideways; on touch it's a native swipe carousel with snap points.
 */
export default function RangeGallery({
  selectedIds,
  onToggle,
  onSelectAll,
}: {
  selectedIds: string[];
  onToggle: (p: Product) => void;
  onSelectAll: () => void;
}) {
  const isDesktop = useMedia(DESKTOP);
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useLayoutEffect(() => {
    if (!isDesktop) return;
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setDistance(Math.max(0, track.scrollWidth - window.innerWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isDesktop]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 160, damping: 32, mass: 0.4 });
  const x = useTransform(smooth, [0, 1], [0, -distance]);
  const bar = useTransform(smooth, [0, 1], [0, 1]);

  const header = (
    <Header
      count={selectedIds.length}
      allSelected={selectedIds.length === PRODUCTS.length}
      onSelectAll={onSelectAll}
      progress={
        isDesktop ? (
          <span className="relative block h-px w-32 overflow-hidden" style={{ background: "var(--cork)" }}>
            <motion.span className="absolute inset-0 origin-left" style={{ scaleX: bar, background: "var(--cream)" }} />
          </span>
        ) : null
      }
    />
  );

  if (!isDesktop) {
    return (
      <section id="range" ref={sectionRef} className="rule-dashed flex flex-col gap-10 py-[68px]">
        {header}
        <div className="flex snap-x snap-mandatory gap-[18px] overflow-x-auto px-4 pb-4 sm:px-6 [scrollbar-width:none]">
          <Track selectedIds={selectedIds} onToggle={onToggle} />
        </div>
      </section>
    );
  }

  return (
    <section
      id="range"
      ref={sectionRef}
      className="rule-dashed relative"
      style={{ height: `calc(100svh + ${distance}px)` }}
    >
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center gap-10 overflow-hidden pt-16">
        {header}
        <motion.div ref={trackRef} style={{ x }} className="flex w-max gap-[18px] px-6">
          <Track selectedIds={selectedIds} onToggle={onToggle} />
        </motion.div>
      </div>
    </section>
  );
}
