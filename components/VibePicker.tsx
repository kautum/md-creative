"use client";

import { motion } from "framer-motion";
import { VIBES, HAIR_CONCERNS } from "@/lib/products";

interface VibePickerProps {
  selectedVibe: string | null;
  onSelectVibe: (v: string) => void;
  selectedConcern: string | null;
  onSelectConcern: (c: string) => void;
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    // Entrance (opacity/y) is driven by the parent's stagger via these
    // variants. Colour is handled in `style` with a CSS transition — NOT via a
    // framer `animate` object, which would override variant propagation and
    // leave the pill stuck at opacity 0 (invisible).
    <motion.button
      type="button"
      onClick={onClick}
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
      }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className="rounded-sm px-4 py-2 text-xs font-medium uppercase tracking-[0.15em] focus:outline-none"
      style={{
        backgroundColor: active ? "var(--accent)" : "transparent",
        color: "var(--text-primary)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        transition:
          "background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease",
      }}
    >
      {label}
    </motion.button>
  );
}

export default function VibePicker({
  selectedVibe,
  onSelectVibe,
  selectedConcern,
  onSelectConcern,
}: VibePickerProps) {
  return (
    <motion.div
      className="flex flex-col gap-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="flex flex-col gap-4">
        <span
          className="font-heading text-xs font-medium uppercase tracking-[0.25em]"
          style={{ color: "var(--text-muted)" }}
        >
          Vibe
        </span>
        <motion.div
          className="flex flex-wrap gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
        >
          {VIBES.map((v) => (
            <Pill
              key={v}
              label={v}
              active={selectedVibe === v}
              onClick={() => onSelectVibe(v)}
            />
          ))}
        </motion.div>
      </div>

      <div className="flex flex-col gap-4">
        <span className="flex items-center gap-3">
          <span
            className="font-heading text-xs font-medium uppercase tracking-[0.25em]"
            style={{ color: "var(--text-muted)" }}
          >
            Hair Concern
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.15em]"
            style={{ color: "var(--text-muted)" }}
          >
            Optional
          </span>
        </span>
        <motion.div
          className="flex flex-wrap gap-3"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
        >
          {HAIR_CONCERNS.map((c) => (
            <Pill
              key={c}
              label={c}
              active={selectedConcern === c}
              // Click again to deselect.
              onClick={() => onSelectConcern(selectedConcern === c ? "" : c)}
            />
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
