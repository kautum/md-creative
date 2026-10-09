/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/products";
import { getProductCutout } from "@/lib/cutout";

/**
 * A product floating in the dark: the background-removed cutout (lib/cutout,
 * cached per URL) so there's no white box on the walnut canvas. While the
 * cutout computes nothing is drawn; if it fails, the raw shot sits on a cream
 * tile instead of pretending.
 */
export default function ProductImage({
  product,
  className,
  style,
}: {
  product: Product;
  className?: string;
  style?: React.CSSProperties;
}) {
  // undefined = computing, null = failed, string = cutout data URL.
  const [state, setState] = useState<{ id: string; url: string | null }>();

  useEffect(() => {
    let cancelled = false;
    getProductCutout(product.imageUrl).then((c) => {
      if (!cancelled) setState({ id: product.id, url: c?.url ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [product.id, product.imageUrl]);

  const current = state?.id === product.id ? state : undefined;
  if (current === undefined) {
    return <div className={className} style={style} aria-hidden />;
  }
  if (current.url === null) {
    return (
      <img
        src={product.imageUrl}
        alt={product.name}
        className={className}
        style={{
          ...style,
          objectFit: "contain",
          background: "var(--cream)",
          borderRadius: "var(--radius-card)",
          padding: 8,
        }}
      />
    );
  }
  return (
    <img
      src={current.url}
      alt={product.name}
      className={className}
      style={{ ...style, objectFit: "contain" }}
    />
  );
}
