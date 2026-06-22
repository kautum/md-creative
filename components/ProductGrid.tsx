/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PRODUCTS, type Product } from "@/lib/products";

interface ProductGridProps {
  selectedIds: string[];
  onToggle: (p: Product) => void;
}

const tools = PRODUCTS.filter((p) => p.category === "tool");
const numbers = PRODUCTS.filter((p) => p.category === "number");

function ProductCard({
  product,
  isSelected,
  onToggle,
}: {
  product: Product;
  isSelected: boolean;
  onToggle: (p: Product) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(product)}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 },
      }}
      animate={{ scale: isSelected ? 1.03 : 1, y: 0 }}
      whileHover={isSelected ? undefined : { scale: 1.02 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group relative flex flex-col text-left focus:outline-none"
      style={{
        backgroundColor: isSelected ? "rgba(255,92,0,0.04)" : "var(--bg-surface)",
        border: `2px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={(e) => {
        if (!isSelected)
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* selected checkmark badge */}
      {isSelected && (
        <span
          className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--accent)", color: "#fff" }}
        >
          <Check size={13} strokeWidth={3} />
        </span>
      )}

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
  selectedIds,
  onToggle,
}: {
  label: string;
  items: Product[];
  selectedIds: string[];
  onToggle: (p: Product) => void;
}) {
  const count = items.filter((p) => selectedIds.includes(p.id)).length;
  return (
    <div className="flex flex-col gap-4">
      <span className="flex items-center gap-2.5">
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
        {count > 0 && (
          <span
            className="text-[10px] font-medium uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)" }}
          >
            {count} selected
          </span>
        )}
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
            isSelected={selectedIds.includes(p.id)}
            onToggle={onToggle}
          />
        ))}
      </motion.div>
    </div>
  );
}

export default function ProductGrid({ selectedIds, onToggle }: ProductGridProps) {
  return (
    <div className="flex flex-col gap-10">
      <Section
        label="Tools"
        items={tools}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
      <Section
        label="The Numbers"
        items={numbers}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    </div>
  );
}
