/* eslint-disable @next/next/no-img-element */
import type { Product } from "@/lib/products";
import { getCutout } from "@/lib/cutout";

/**
 * A product floating in the dark: its pre-built transparent cutout
 * (lib/cutout). Width/height attributes come from the file so the browser
 * reserves the right box before it loads — no layout jump.
 */
export default function ProductImage({
  product,
  className,
  style,
  priority = false,
}: {
  product: Product;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
}) {
  const c = getCutout(product.id);
  return (
    <img
      src={c.url}
      alt={product.name}
      width={c.w}
      height={c.h}
      draggable={false}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={className}
      style={{ objectFit: "contain", ...style }}
    />
  );
}
