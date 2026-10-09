"use client";

import { PRODUCTS, type Product } from "@/lib/products";
import ProductImage from "@/components/ProductImage";

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
    <button
      type="button"
      onClick={() => onToggle(product)}
      aria-pressed={isSelected}
      title={product.tagline}
      className="group relative flex flex-col text-left transition-colors duration-200"
      style={{
        borderRadius: "var(--radius-card)",
        border: `1px solid ${isSelected ? "var(--cream)" : "var(--cork)"}`,
        background: isSelected ? "var(--bark)" : "transparent",
      }}
    >
      <div className="relative flex aspect-[4/5] w-full items-center justify-center p-5">
        {/* Warm rim light — the void behind each object. */}
        <div
          aria-hidden
          className="absolute inset-6 rounded-full opacity-60 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 60% 40%, rgba(255,237,215,0.10), rgba(255,237,215,0) 65%)",
          }}
        />
        <ProductImage
          product={product}
          className="absolute inset-5 h-[calc(100%-40px)] w-[calc(100%-40px)] transition-transform duration-300 group-hover:-translate-y-1"
        />
      </div>
      <div className="flex items-baseline justify-between gap-2 px-3 pb-3">
        <span className="label">{product.name}</span>
        <span className="label" style={{ color: "var(--cream-70)" }}>
          £{product.price}
        </span>
      </div>
      {isSelected && (
        <span className="label-sm absolute left-3 top-3">● Selected</span>
      )}
    </button>
  );
}

function Group({
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
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="label" style={{ color: "var(--cream-50)" }}>
          {count > 0 ? `${count} / ${items.length} selected` : `${items.length}`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-6">
        {items.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            isSelected={selectedIds.includes(p.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProductGrid({ selectedIds, onToggle }: ProductGridProps) {
  return (
    <div className="flex flex-col gap-10">
      <Group
        label="Tools"
        items={tools}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
      <hr className="rule-dashed" />
      <Group
        label="The Numbers"
        items={numbers}
        selectedIds={selectedIds}
        onToggle={onToggle}
      />
    </div>
  );
}
