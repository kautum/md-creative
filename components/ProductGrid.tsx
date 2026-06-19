/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import { PRODUCTS, type Product } from "@/lib/products";

interface ProductGridProps {
  selected: Product | null;
  onSelect: (p: Product) => void;
}

const tools = PRODUCTS.filter((p) => p.category === "tool");
const numbers = PRODUCTS.filter((p) => p.category === "number");

function ProductCard({
  product,
  isSelected,
  anySelected,
  onSelect,
}: {
  product: Product;
  isSelected: boolean;
  anySelected: boolean;
  onSelect: (p: Product) => void;
}) {
  const dimmed = anySelected && !isSelected;

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(product)}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 },
      }}
      animate={{
        scale: isSelected ? 1.03 : 1,
        opacity: dimmed ? 0.55 : 1,
        y: 0,
      }}
      whileHover={isSelected ? undefined : { scale: 1.02 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group text-left flex flex-col focus:outline-none"
      style={{
        backgroundColor: "var(--bg-surface)",
        border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
        transition: "border-color 0.2s ease",
      }}
      // Subtle orange top border on hover (unselected cards only).
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.borderTopColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.borderTopColor = "var(--border)";
      }}
    >
      <div
        className="aspect-square w-full flex items-center justify-center p-4"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        <img
          src={product.imageUrl}
          alt={product.name}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
        />
      </div>
      <div
        className="p-4 flex flex-col gap-1 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="font-heading text-sm font-medium tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            {product.name}
          </span>
          <span className="text-sm" style={{ color: "var(--accent)" }}>
            £{product.price}
          </span>
        </div>
        <span
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: "var(--text-muted)" }}
        >
          {product.tagline}
        </span>
      </div>
    </motion.button>
  );
}

function Section({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: Product[];
  selected: Product | null;
  onSelect: (p: Product) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <span className="flex items-center gap-2.5">
        {/* Decorative orange dot. */}
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: "var(--accent)" }}
        />
        <span
          className="font-heading text-xs font-medium uppercase tracking-[0.25em]"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </span>
      </span>
      <motion.div
        className="grid grid-cols-2 md:grid-cols-3 gap-4"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      >
        {items.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            isSelected={selected?.id === p.id}
            anySelected={selected !== null}
            onSelect={onSelect}
          />
        ))}
      </motion.div>
    </div>
  );
}

export default function ProductGrid({ selected, onSelect }: ProductGridProps) {
  return (
    <div className="flex flex-col gap-10">
      <Section
        label="Tools"
        items={tools}
        selected={selected}
        onSelect={onSelect}
      />
      <Section
        label="The Numbers"
        items={numbers}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}
