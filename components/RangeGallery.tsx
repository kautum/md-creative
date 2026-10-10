"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, useMotionValue, type AnimationPlaybackControls } from "framer-motion";
import { ROUTINES, matchRoutine, type Product } from "@/lib/products";
import ProductImage from "@/components/ProductImage";

type Filter = "all" | "tool" | "number";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "tool", label: "Tools" },
  { id: "number", label: "The Numbers" },
];
const DRAG_THRESHOLD = 10; // px before a press becomes a drag (SKILL.md §10)
const VELOCITY_WINDOW_MS = 100; // release velocity is measured over this
const MOMENTUM_PX_S = 300; // faster than this counts as a throw

/** Apple's momentum projection (SKILL.md §6): where a fling comes to rest. */
function project(velocityPxS: number, decelerationRate = 0.998) {
  return ((velocityPxS / 1000) * decelerationRate) / (1 - decelerationRate);
}
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
      className="press flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30"
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

  // The carousel's position lives in one unbounded motion value, `sx`.
  // Everything moves it — drag, springs, the idle drift — so every motion
  // starts from the live value and inherits its velocity (SKILL.md §3).
  // It's shown modulo one lap, over a doubled list, so it loops seamlessly.
  const sx = useMotionValue(0);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const restingAt = useRef<number | null>(null); // where a spring is heading
  const lastWritten = useRef(-1);
  const drag = useRef({ down: false, startX: 0, startSx: 0, moved: false, id: -1 });
  const history = useRef<{ x: number; t: number }[]>([]);
  // Drift control: paused while hovered or being handled; resumes when idle.
  const hover = useRef(false);
  const holdUntil = useRef(0);

  const shown = filter === "all" ? products : products.filter((p) => p.category === filter);
  const n = shown.length;
  const looped = [...shown, ...shown];
  const routine = matchRoutine(selectedIds);

  /** Distance from the first card to its duplicate: one full lap. */
  const lap = useCallback(() => {
    const first = cardRefs.current[0];
    const twin = cardRefs.current[n];
    return first && twin ? twin.offsetLeft - first.offsetLeft : 0;
  }, [n]);

  /** Card start positions within one lap (plus the lap end, which is card 0 again). */
  const stops = useCallback(() => {
    const first = cardRefs.current[0];
    if (!first) return [];
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const el = cardRefs.current[i];
      if (el) out.push(el.offsetLeft - first.offsetLeft);
    }
    return out;
  }, [n]);

  /** The card start nearest `p`, in unbounded sx space. */
  const nearestStop = useCallback(
    (p: number) => {
      const L = lap();
      const s = stops();
      if (!L || !s.length) return p;
      const base = Math.floor(p / L) * L;
      let best = 0;
      let bd = Infinity;
      for (const o of [...s, L]) {
        const d = Math.abs(o - (p - base));
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      return base + best;
    },
    [lap, stops],
  );

  // sx → the track's scrollLeft (modulo one lap).
  useEffect(
    () =>
      sx.on("change", (v) => {
        const track = trackRef.current;
        if (!track) return;
        const L = lap();
        track.scrollLeft = L > 0 ? ((v % L) + L) % L : Math.max(0, v);
        lastWritten.current = track.scrollLeft;
      }),
    [sx, lap],
  );

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
      const a = d >= 0 ? Math.min(d, 3) * 0.6 : Math.min(-d, 1.5) * 1.3;
      el.style.transform = `scale(${1 - Math.min(a, 1.4) * 0.06})`;
      el.style.opacity = String(Math.max(0.6, 1 - a * 0.18));
      if (Math.abs(d) < bestDist) {
        bestDist = Math.abs(d);
        best = i;
      }
    });
    setActive((prev) => (prev === best ? prev : best));
  }, []);

  /** Someone is handling the carousel: stop drifting; resume when idle. */
  const hold = useCallback(() => {
    holdUntil.current = performance.now() + RESUME_AFTER_MS;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      // A scroll we didn't write is the user's own (wheel, trackpad, touch):
      // it wins — stop our motion and adopt their position (§3).
      if (Math.abs(track.scrollLeft - lastWritten.current) > 1) {
        anim.current?.stop();
        restingAt.current = null;
        const L = lap();
        if (L > 0 && track.scrollLeft >= L) track.scrollLeft -= L;
        lastWritten.current = track.scrollLeft;
        sx.jump(track.scrollLeft);
        hold();
      }
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
  }, [update, lap, sx, hold, filter]);

  // The idle drift: a slow continuous glide, paused while you're using it.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const idle =
        !userPaused && !hover.current && now > holdUntil.current && !drag.current.down && !anim.current;
      if (idle && !document.hidden) {
        track.style.scrollSnapType = "none";
        sx.set(sx.get() + (DRIFT_PX_PER_S * dt) / 1000);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [userPaused, filter, sx]);

  /** Spring to a resting position, from the live value and velocity. */
  const springTo = useCallback(
    (target: number, opts: { bounce: number; velocity?: number }) => {
      const track = trackRef.current;
      anim.current?.stop();
      restingAt.current = target;
      if (track) track.style.scrollSnapType = "none"; // our spring, not CSS snap
      hold();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        sx.jump(target);
        restingAt.current = null;
        return;
      }
      const controls = animate(sx, target, {
        type: "spring",
        bounce: opts.bounce,
        visualDuration: 0.4,
        ...(opts.velocity !== undefined ? { velocity: opts.velocity } : {}),
        onComplete: () => {
          if (anim.current !== controls) return;
          anim.current = null;
          restingAt.current = null;
          // Fold back into the first lap; restore CSS snap for touch.
          const L = lap();
          if (L > 0) sx.jump(((sx.get() % L) + L) % L);
          if (track) track.style.scrollSnapType = "";
        },
      });
      anim.current = controls;
    },
    [sx, lap, hold],
  );

  /** Step one card, from wherever we're heading — quick clicks keep stepping. */
  const step = (dir: -1 | 1) => {
    const L = lap();
    const s = stops();
    if (!L || !s.length) return;
    const from = restingAt.current ?? nearestStop(sx.get());
    const base = Math.floor(from / L) * L;
    const m = from - base;
    let k = 0;
    let bd = Infinity;
    s.forEach((o, i) => {
      const d = Math.min(Math.abs(o - m), Math.abs(o + L - m));
      if (d < bd) {
        bd = d;
        k = i;
      }
    });
    const nk = k + dir;
    const pos = nk < 0 ? s[n - 1] - L : nk >= n ? L + s[0] : s[nk];
    springTo(base + pos, { bounce: 0 }); // critically damped: no momentum here
  };

  const changeFilter = (f: Filter) => {
    anim.current?.stop();
    anim.current = null;
    restingAt.current = null;
    setFilter(f);
    cardRefs.current = [];
    sx.jump(0);
  };

  // Drag: 1:1 tracking after a 10px threshold, then momentum projection.
  const onPointerDown = (e: React.PointerEvent) => {
    hold();
    if (e.pointerType !== "mouse") return; // touch scrolls natively
    anim.current?.stop(); // grab it mid-flight (§3)
    anim.current = null;
    drag.current = { down: true, startX: e.clientX, startSx: sx.get(), moved: false, id: e.pointerId };
    history.current = [{ x: e.clientX, t: performance.now() }];
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d.down || !track) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) > DRAG_THRESHOLD) {
      d.moved = true;
      // Capture only once it's a drag, so a plain tap still picks a card.
      track.setPointerCapture(d.id);
      track.style.scrollSnapType = "none";
      track.style.cursor = "grabbing";
    }
    if (!d.moved) return;
    sx.set(d.startSx - dx); // the grab offset is respected: content moves with the hand
    const now = performance.now();
    history.current.push({ x: e.clientX, t: now });
    while (history.current.length > 2 && now - history.current[0].t > VELOCITY_WINDOW_MS) history.current.shift();
  };
  const endDrag = () => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d.down || !track) return;
    d.down = false;
    if (!d.moved) return;
    track.style.cursor = "";
    if (track.hasPointerCapture(d.id)) track.releasePointerCapture(d.id);
    // Release velocity from the recent history, in scroll direction (px/s).
    const h = history.current;
    const first = h[0];
    const lastP = h[h.length - 1];
    const dt = (lastP.t - first.t) / 1000;
    const pointerV = dt > 0 ? (lastP.x - first.x) / dt : 0;
    const v = -pointerV;
    // Project where the fling is going, then land on the card nearest that (§6).
    const projected = sx.get() + project(v);
    springTo(nearestStop(projected), {
      bounce: Math.abs(v) > MOMENTUM_PX_S ? 0.2 : 0, // bounce only when it was thrown
      velocity: v,
    });
  };
  const onPick = (p: Product) => {
    if (drag.current.moved) {
      drag.current.moved = false; // that was a drag, not a pick
      return;
    }
    onToggle(p);
  };

  const shownIndex = n ? active % n : 0;

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
            className="press flex h-11 w-11 items-center justify-center rounded-full"
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
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
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
