/* eslint-disable @next/next/no-img-element */
"use client";

import { motion } from "framer-motion";
import {
  BatteryFull,
  Bookmark,
  Camera,
  Heart,
  Home,
  MessageCircle,
  Music,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Share2,
  SignalHigh,
  User,
  Wifi,
} from "lucide-react";
import type { GeneratedCopy, Product } from "@/lib/products";
import ProductOverlays from "@/components/ProductOverlays";

interface PlatformPreviewsProps {
  products: Product[];
  copyResult: GeneratedCopy;
  imageUrl: string | null;
  isRevealing: boolean;
}

/**
 * The AD CREATIVE composite (AI scene + tiered product overlay) rendered to fill
 * whatever positioned parent it sits in. ≤4 products → composite; 5+ → the scene
 * shows as pure atmosphere (ProductOverlays renders nothing). Falls back to a
 * teal skeleton until the scene URL exists.
 */
function SceneComposite({
  products,
  imageUrl,
}: {
  products: Product[];
  imageUrl: string | null;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ isolation: "isolate", backgroundColor: "var(--skeleton)" }}
    >
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <ProductOverlays products={products} />
        </>
      ) : (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ backgroundColor: "var(--skeleton)" }}
        />
      )}
    </div>
  );
}

/** Small orange "md" avatar stand-in. */
function Avatar({ size }: { size: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: "var(--accent)",
        color: "#fff",
        fontSize: size * 0.42,
        letterSpacing: "0.02em",
      }}
    >
      md
    </div>
  );
}

const PHONE_BASE =
  "relative w-full max-w-[330px] shrink-0 transition-transform duration-500 ease-out";

function InstagramPhone({
  products,
  copyResult,
  imageUrl,
}: {
  products: Product[];
  copyResult: GeneratedCopy;
  imageUrl: string | null;
}) {
  const tags = copyResult.hashtags.slice(0, 4);
  return (
    <div
      className={`${PHONE_BASE} [transform:rotateY(8deg)_rotateX(2deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)_scale(1.03)]`}
      style={{
        aspectRatio: "9 / 19",
        borderRadius: "2.8rem",
        border: "8px solid #d0d0d0",
        backgroundColor: "#f0f0f0",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-white text-black"
        style={{ borderRadius: "2.2rem" }}
      >
        {/* dynamic island */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: 6,
            width: 72,
            height: 19,
            borderRadius: 999,
            backgroundColor: "#000",
            zIndex: 20,
          }}
        />
        {/* status bar */}
        <div
          className="flex items-center justify-between px-4"
          style={{ height: 26 }}
        >
          <span style={{ fontSize: 11, fontWeight: 600 }}>9:41</span>
          <div className="flex items-center gap-1">
            <SignalHigh size={12} />
            <Wifi size={12} />
            <BatteryFull size={15} />
          </div>
        </div>

        {/* nav bar */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ borderBottom: "1px solid #eee" }}
        >
          <Camera size={18} strokeWidth={1.8} />
          <span
            className="font-heading"
            style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}
          >
            Instagram
          </span>
          <Send size={18} strokeWidth={1.8} />
        </div>

        {/* profile row */}
        <div className="flex items-center gap-2" style={{ padding: "8px 12px" }}>
          <Avatar size={26} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>mdlondon</span>
          <span
            className="ml-auto rounded-md px-3 py-1 font-semibold"
            style={{ fontSize: 11, backgroundColor: "#0095f6", color: "#fff" }}
          >
            Follow
          </span>
        </div>

        {/* post image — square */}
        <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
          <SceneComposite products={products} imageUrl={imageUrl} />
        </div>

        {/* action bar */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-4">
            <Heart size={22} strokeWidth={1.8} />
            <MessageCircle size={22} strokeWidth={1.8} />
            <Send size={22} strokeWidth={1.8} />
          </div>
          <Bookmark size={22} strokeWidth={1.8} />
        </div>

        {/* caption */}
        <div style={{ padding: "0 12px 12px", fontSize: 11, lineHeight: 1.45 }}>
          <p style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
            1,284 likes
          </p>
          <p
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            <span style={{ fontWeight: 700 }}>mdlondon</span>{" "}
            <span>{copyResult.instagramCaption}</span>
          </p>
          <p className="mt-1" style={{ color: "#0095f6" }}>
            {tags.join(" ")}
          </p>
          <p className="mt-2" style={{ color: "#8e8e8e" }}>
            View all 86 comments
          </p>
          <p
            className="mt-1.5"
            style={{
              color: "#8e8e8e",
              fontSize: 9.5,
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            2 hours ago
          </p>
        </div>
      </div>
    </div>
  );
}

function TikTokPhone({
  products,
  copyResult,
  imageUrl,
}: {
  products: Product[];
  copyResult: GeneratedCopy;
  imageUrl: string | null;
}) {
  const tt = copyResult.tiktok_script;
  return (
    <div
      className={`${PHONE_BASE} [transform:rotateY(-8deg)_rotateX(2deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)_scale(1.03)]`}
      style={{
        aspectRatio: "9 / 19",
        borderRadius: "2.8rem",
        border: "8px solid #111",
        backgroundColor: "#1a1a1a",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ borderRadius: "2.2rem", backgroundColor: "#000" }}
      >
        {/* full-screen scene */}
        <SceneComposite products={products} imageUrl={imageUrl} />

        {/* readability gradient over the bottom half */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            height: "60%",
            background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
            zIndex: 1,
          }}
        />

        {/* dynamic island */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: 6,
            width: 72,
            height: 19,
            borderRadius: 999,
            backgroundColor: "#000",
            zIndex: 20,
          }}
        />

        {/* top bar */}
        <div
          className="absolute inset-x-0 top-0 flex items-center justify-center gap-5"
          style={{ zIndex: 3, paddingTop: 30, paddingBottom: 10 }}
        >
          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
            Following
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              paddingBottom: 3,
              borderBottom: "2px solid #fff",
            }}
          >
            For You
          </span>
        </div>

        {/* right action rail */}
        <div
          className="absolute right-2 flex flex-col items-center"
          style={{ bottom: "18%", zIndex: 3, gap: 18, color: "#fff" }}
        >
          <div className="relative mb-1">
            <Avatar size={40} />
            <span
              className="absolute -bottom-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--accent)" }}
            >
              <Plus size={11} strokeWidth={3} />
            </span>
          </div>
          <RailIcon icon={<Heart size={30} fill="#fff" strokeWidth={0} />} label="24.5k" />
          <RailIcon icon={<MessageCircle size={29} fill="#fff" strokeWidth={0} />} label="318" />
          <RailIcon icon={<Share2 size={28} strokeWidth={1.8} />} label="1.2k" />
          <RailIcon icon={<MoreHorizontal size={26} strokeWidth={2} />} label="" />
        </div>

        {/* bottom caption block */}
        <div
          className="absolute left-3 bottom-16"
          style={{ zIndex: 3, color: "#fff", right: 64 }}
        >
          <p style={{ fontSize: 13, fontWeight: 700 }}>@mdlondon</p>
          <p
            className="mt-1"
            style={{
              fontSize: 12.5,
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {tt.hook || "Your dryer is the reason your hair looks like that."}
          </p>
          <p
            className="mt-2 flex items-center gap-1.5"
            style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}
          >
            <Music size={12} />
            <span
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {tt.audio_vibe || "original sound — mdlondon"}
            </span>
          </p>
        </div>

        {/* bottom nav */}
        <div
          className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-2 pt-2"
          style={{ zIndex: 4, backgroundColor: "#000", color: "#fff" }}
        >
          <NavItem icon={<Home size={20} fill="#fff" strokeWidth={0} />} label="Home" />
          <NavItem icon={<Search size={20} strokeWidth={2} />} label="Discover" />
          <span
            className="flex items-center justify-center"
            style={{
              width: 42,
              height: 28,
              borderRadius: 8,
              backgroundColor: "var(--accent)",
              color: "#fff",
            }}
          >
            <Plus size={20} strokeWidth={3} />
          </span>
          <NavItem icon={<MessageCircle size={20} strokeWidth={2} />} label="Inbox" />
          <NavItem icon={<User size={20} strokeWidth={2} />} label="Profile" />
        </div>
      </div>
    </div>
  );
}

function RailIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 3 }}>
      {icon}
      {label && (
        <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
      )}
    </div>
  );
}

function NavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 3 }}>
      {icon}
      <span style={{ fontSize: 9.5, opacity: 0.85 }}>{label}</span>
    </div>
  );
}

export default function PlatformPreviews({
  products,
  copyResult,
  imageUrl,
  isRevealing,
}: PlatformPreviewsProps) {
  return (
    <section
      className="w-full"
      style={{ backgroundColor: "var(--bg-dark)" }}
    >
      <div className="mx-auto max-w-5xl px-6 sm:px-10 py-20">
        {/* section label */}
        <div className="flex items-center justify-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: "var(--accent)" }}
          />
          <span
            className="font-heading uppercase"
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: "0.8rem",
              letterSpacing: "0.34em",
            }}
          >
            How It Lands
          </span>
        </div>
        <p
          className="mx-auto mt-3 max-w-md text-center"
          style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}
        >
          The same campaign, in the feeds it was built for.
        </p>

        <motion.div
          className="mt-14 flex flex-col items-center justify-center gap-12 md:flex-row md:gap-16"
          style={{ perspective: "1200px" }}
          initial={{ opacity: 0, y: 40 }}
          animate={{
            opacity: isRevealing ? 1 : 0,
            y: isRevealing ? 0 : 40,
          }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        >
          <InstagramPhone
            products={products}
            copyResult={copyResult}
            imageUrl={imageUrl}
          />
          <TikTokPhone
            products={products}
            copyResult={copyResult}
            imageUrl={imageUrl}
          />
        </motion.div>
      </div>
    </section>
  );
}
