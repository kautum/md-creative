"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROUTINES, matchRoutine, type Product } from "@/lib/products";
import ProductImage from "@/components/ProductImage";

type Filter = "all" | "tool" | "number";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tool", label: "Tools" },
  { id: "number", label: "The Numbers" },
];
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag
const DRIFT_PX_PER_S = 34; // the carousel's idle glide
const RESUME_AFTER_MS = 4000; // drift resumes this long after you stop handling it

function Price({ product }: { product: Product }) {
  return (
    <span className="label flex items-baseline gap-2">
      {product.wasPrice && (
        <s style={{ color: "var(--fg-50)" }} aria-label={`was £${product.wasPrice}`}>
          £{product.wasPrice}
        </s>
      )}
      £{product.price}
    </span>
  );
}

function Card({
  product,
  index,
  selected,
  onPick,
  cardRef,
}: {
  product: Product;
  index: number;
  selected: boolean;
  onPick: (p: Product) => void;
  cardRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={cardRef}
      type="button"
      aria-pressed={selected}
      title={product.tagline}
      onClick={() => onPick(product)}
      className="group relative flex h-[min(62vh,520px)] w-[var(--card)] shrink-0 origin-left snap-start flex-col justify-between overflow-hidden p-6 text-left will-change-transform"
      style={{
        borderRadius: "var(--radius-card)",
        // Picked: a crisp blue outline on a barely-blue card — on ivory a heavy
        // tint reads as muddy grey.
        border: selected ? "1.5px solid var(--blue)" : "1px solid var(--line)",
        background: selected
          ? "color-mix(in srgb, var(--blue) 7%, var(--bg))"
          : "color-mix(in srgb, var(--raised) 55%, var(--bg))",
        transition: "background-color 0.3s ease, border-color 0.3s ease",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="label" style={{ color: "var(--fg-50)" }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="label" style={{ color: selected ? "var(--blue)" : "var(--fg-50)" }}>
          {selected ? "Picked ✓" : "Pick +"}
        </span>
      </div>
      <div className="relative my-4 flex-1">
        <div
          aria-hidden
          className="absolute inset-[6%] rounded-full transition-opacity duration-500 group-hover:opacity-100"
          style={{
            opacity: selected ? 0.95 : 0.5,
            background:
              "radial-gradient(circle at 55% 45%, rgba(255,255,255,0.8), rgba(255,255,255,0) 68%)",
          }}
        />
        <ProductImage
          product={product}
          className="pointer-events-none absolute inset-0 h-full w-full transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="heading" style={{ fontSize: "clamp(26px, 2.4vw, 32px)" }}>
            {product.name}
          </span>
          <Price product={product} />
        </div>
        {/* mdlondon's own line for the product, quoted. */}
        <p className="body-sm line-clamp-2 italic" style={{ color: "var(--fg-70)", fontSize: 15, lineHeight: 1.35 }}>
          “{product.slogan}”
        </p>
      </div>
    </button>
  );
}

function ArrowButton({ dir, onClick, disabled }: { dir: -1 | 1; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? "Previous product" : "Next product"}
      className="flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-30"
      style={{ border: "1px solid var(--fg-50)" }}
    >
      <span aria-hidden className="label" style={{ fontSize: 16 }}>
        {dir < 0 ? "←" : "→"}
      </span>
    </button>
  );
}

/**
 * The range as a carousel that keeps moving: a slow continuous glide that
 * loops without a seam. Hover, drag, swipe, the arrows or the ←/→ keys take
 * over (snapping card to card) and the glide resumes when you let go; the
 * pause button stops it for good. Tap any card to pick it as it passes — a
 * drag never counts as a tap.
 */
export default function RangeGallery({
  products,
  selectedIds,
  priceNote,
  promotions,
  onToggle,
  onSelectAll,
  onPickRoutine,
}: {
  products: Product[];
  selectedIds: string[];
  priceNote: string;
  promotions: string[];
  onToggle: (p: Product) => void;
  onSelectAll: () => void;
  onPickRoutine: (ids: string[]) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState(0); // raw index into the doubled list
  const [userPaused, setUserPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const drag = useRef({ down: false, startX: 0, startScroll: 0, moved: false });
  // Where a smooth scroll is heading, so quick repeated clicks keep stepping.
  const pending = useRef<number | null>(null);
  // Drift control: paused while hovered or being handled; resumes when idle.
  const hover = useRef(false);
  const holdUntil = useRef(0);

  const shown = filter === "all" ? products : products.filter((p) => p.category === filter);
  const n = shown.length;
  // The cards are drawn twice so the drift can loop without a seam.
  const looped = [...shown, ...shown];
  const routine = matchRoutine(selectedIds);

  // Focus effect + active index, from the scroll position (no re-render per frame).
  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const start = track.scrollLeft + parseFloat(getComputedStyle(track).paddingLeft);
    let best = 0;
    let bestDist = Infinity;
    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = (el.offsetLeft - start) / el.offsetWidth; // in card widths
      // Cards ahead recede gently; cards scrolled past fade out faster.
      const a = d >= 0 ? Math.min(d, 3) * 0.6 : Math.min(-d, 1.5) * 1.3;
      el.style.transform = `scale(${1 - Math.min(a, 1.4) * 0.06})`;
      el.style.opacity = String(Math.max(0.6, 1 - a * 0.18));
      if (Math.abs(d) < bestDist) {
        bestDist = Math.abs(d);
        best = i;
      }
    });
    if (pending.current === best) pending.current = null;
    setActive((prev) => (prev === best ? prev : best));
  }, []);

  /** Distance from the first card to its duplicate: one full lap. */
  const lap = useCallback(() => {
    const first = cardRefs.current[0];
    const twin = cardRefs.current[n];
    return first && twin ? twin.offsetLeft - first.offsetLeft : 0;
  }, [n]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      // Wrap a full lap back, invisibly, when the duplicate set is reached.
      const L = lap();
      if (L > 0 && track.scrollLeft >= L) track.scrollLeft -= L;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [update, lap, filter]);

  // The drift: a slow continuous glide, paused while you're using it.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    let carry = 0; // sub-pixel progress (scrollLeft is integer in some browsers)
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const drifting = !userPaused && !hover.current && now > holdUntil.current && !drag.current.down;
      if (drifting && !document.hidden) {
        track.style.scrollSnapType = "none";
        carry += (DRIFT_PX_PER_S * dt) / 1000;
        const whole = Math.floor(carry);
        if (whole > 0) {
          track.scrollLeft += whole;
          carry -= whole;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [userPaused, filter]);

  /** Someone is handling the carousel: stop drifting, snap, resume when idle. */
  const hold = useCallback(() => {
    holdUntil.current = performance.now() + RESUME_AFTER_MS;
    const track = trackRef.current;
    if (track && !drag.current.down) track.style.scrollSnapType = "";
  }, []);

  const goTo = useCallback(
    (i: number) => {
      const track = trackRef.current;
      if (!track) return;
      hold();
      // Stay inside the doubled list; wrap backwards across the seam.
      const L = lap();
      let target = i;
      if (target < 0 && L > 0) {
        track.scrollLeft += L;
        target += n;
      }
      const el = cardRefs.current[Math.max(0, Math.min(target, 2 * n - 1))];
      if (!el) return;
      pending.current = target;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      track.scrollTo({
        left: el.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft),
        behavior: reduced ? "auto" : "smooth",
      });
    },
    [hold, lap, n],
  );

  const changeFilter = (f: Filter) => {
    setFilter(f);
    cardRefs.current = [];
    trackRef.current?.scrollTo({ left: 0 });
  };

  // Mouse drag-to-scroll (touch and trackpads scroll natively).
  const onPointerDown = (e: React.PointerEvent) => {
    hold();
    if (e.pointerType !== "mouse" || !trackRef.current) return;
    drag.current = { down: true, startX: e.clientX, startScroll: trackRef.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d.down || !track) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
      track.style.scrollSnapType = "none"; // free movement while dragging
      track.style.cursor = "grabbing";
    }
    if (d.moved) track.scrollLeft = d.startScroll - dx;
  };
  const endDrag = () => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d.down || !track) return;
    d.down = false;
    if (d.moved) {
      track.style.cursor = "";
      goTo(active);
    }
  };
  const onPick = (p: Product) => {
    if (drag.current.moved) {
      drag.current.moved = false; // that was a drag, not a pick
      return;
    }
    onToggle(p);
  };

  const shownIndex = n ? active % n : 0;
  const step = (dir: -1 | 1) => goTo((pending.current ?? active) + dir);

  return (
    <section id="range" className="rule-dashed flex flex-col gap-8 overflow-x-clip py-[68px] lg:py-[110px]">
      <div className="relative isolate flex flex-col items-start gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 lg:pr-12">
        <span
          aria-hidden
          className="display outline pointer-events-none absolute -top-[0.45em] right-4 -z-10 select-none leading-none opacity-40 sm:right-6 lg:right-12"
          style={{ fontSize: "clamp(110px, 20vw, 320px)" }}
        >
          01
        </span>
        <div className="relative flex flex-col gap-4">
          <span className="label" style={{ color: "var(--fg-50)" }}>
            01 — The range · {priceNote}
          </span>
          <h2 className="heading">Pick the object.</h2>
        </div>
        <div className="relative flex items-center gap-6">
          <span className="label" style={{ color: "var(--fg-50)" }}>
            {selectedIds.length} / {products.length} picked
            {routine ? ` · ${routine.name} bundle` : ""}
          </span>
          <button type="button" onClick={onSelectAll} className="link">
            {selectedIds.length === products.length ? "Clear" : "Pick all"}
          </button>
        </div>
      </div>

      {promotions.length > 0 && (
        <p className="label-sm flex flex-wrap items-center gap-x-3 gap-y-1 px-4 sm:px-6" style={{ color: "var(--fg-70)" }}>
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--blue)" }} />
          <span style={{ color: "var(--fg-50)" }}>On now at mdlondon.com</span>
          {promotions.map((p) => (
            <span key={p}>{p}</span>
          ))}
        </p>
      )}

      {/* One swipeable row on phones; wraps on larger screens. */}
      <div className="flex items-center gap-[10px] overflow-x-auto px-4 [scrollbar-width:none] sm:flex-wrap sm:px-6 lg:pr-12 [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
        <span className="label-sm mr-2" style={{ color: "var(--fg-50)" }}>
          mdlondon routines
        </span>
        {ROUTINES.map((r) => (
          <button
            key={r.id}
            type="button"
            className="chip"
            aria-pressed={routine?.id === r.id}
            title={`${r.productIds.length} products · £${r.price} (save £${r.wasPrice - r.price})`}
            onClick={() => onPickRoutine(routine?.id === r.id ? [] : r.productIds)}
          >
            {r.name} · £{r.price}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:pr-12">
        <div
          role="tablist"
          aria-label="Filter the range"
          className="flex min-w-0 gap-[10px] overflow-x-auto [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden [&>*]:shrink-0"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className="chip"
              onClick={() => changeFilter(f.id)}
            >
              {f.label} {f.id === "all" ? products.length : products.filter((p) => p.category === f.id).length}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="label hidden tabular-nums sm:inline" style={{ color: "var(--fg-50)" }}>
            {String(shownIndex + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
          </span>
          {/* Auto-moving content needs a pause control (WCAG 2.2.2). */}
          <button
            type="button"
            onClick={() => setUserPaused((v) => !v)}
            aria-label={userPaused ? "Play the carousel" : "Pause the carousel"}
            aria-pressed={userPaused}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ border: "1px solid var(--fg-50)" }}
          >
            <span aria-hidden className="label" style={{ fontSize: 13 }}>
              {userPaused ? "▶" : "❚❚"}
            </span>
          </button>
          <ArrowButton dir={-1} onClick={() => step(-1)} disabled={false} />
          <ArrowButton dir={1} onClick={() => step(1)} disabled={false} />
        </div>
      </div>

      <div
        ref={trackRef}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label="mdlondon products"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
        }}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hover.current = true;
        }}
        onPointerLeave={() => {
          hover.current = false;
          endDrag();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onWheel={hold}
        onTouchStart={hold}
        onFocus={hold}
        className="flex cursor-grab snap-x snap-mandatory scroll-px-4 gap-[18px] overflow-x-auto py-4 pl-4 pr-4 [--card:74vw] [scrollbar-width:none] sm:scroll-px-6 sm:pl-6 sm:[--card:44vw] lg:[--card:340px] [&::-webkit-scrollbar]:hidden"
      >
        {looped.map((p, i) => (
          <Card
            key={`${p.id}-${i < n ? "a" : "b"}`}
            product={p}
            index={products.indexOf(p)}
            selected={selectedIds.includes(p.id)}
            onPick={onPick}
            cardRef={(el) => {
              cardRefs.current[i] = el;
            }}
          />
        ))}
      </div>

      <div className="mx-4 h-px sm:mx-6 lg:mr-12" style={{ background: "var(--line)" }}>
        <div
          className="h-px transition-[width] duration-300"
          style={{ width: `${((shownIndex + 1) / Math.max(1, n)) * 100}%`, background: "var(--blue)" }}
        />
      </div>
    </section>
  );
}
