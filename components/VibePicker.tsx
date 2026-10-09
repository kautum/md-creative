"use client";

import { VIBES, HAIR_CONCERNS } from "@/lib/products";

interface VibePickerProps {
  selectedVibe: string | null;
  onSelectVibe: (v: string) => void;
  selectedConcern: string | null;
  onSelectConcern: (c: string | null) => void;
  disabled: boolean;
  /** Options the selected products are made for (Product.bestFor / hairConcerns). */
  suggestedVibes: string[];
  suggestedConcerns: string[];
}

function ChipRow({
  label,
  hint,
  options,
  value,
  onChange,
  disabled,
  suggested,
}: {
  label: string;
  hint?: string;
  options: readonly string[];
  value: string | null;
  onChange: (v: string) => void;
  disabled: boolean;
  suggested: string[];
}) {
  return (
    <fieldset className="flex flex-col gap-[14px]" disabled={disabled}>
      <legend className="mb-[14px] flex items-baseline gap-3">
        <span className="label">{label}</span>
        {hint && (
          <span className="label-sm" style={{ color: "var(--cream-50)" }}>
            {hint}
          </span>
        )}
      </legend>
      <div className="flex flex-wrap gap-[10px]">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className="chip"
            aria-pressed={value === o}
            onClick={() => onChange(o)}
          >
            {suggested.includes(o) && <span aria-hidden>✦ </span>}
            {o}
            {suggested.includes(o) && <span className="sr-only"> (suggested)</span>}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function VibePicker({
  selectedVibe,
  onSelectVibe,
  selectedConcern,
  onSelectConcern,
  disabled,
  suggestedVibes,
  suggestedConcerns,
}: VibePickerProps) {
  const hasSuggestions = suggestedVibes.length + suggestedConcerns.length > 0;
  return (
    <div className="flex flex-col gap-8">
      {hasSuggestions && (
        <span className="label-sm" style={{ color: "var(--cream-50)" }}>
          ✦ Made for your selection
        </span>
      )}
      <ChipRow
        label="Vibe"
        options={VIBES}
        value={selectedVibe}
        onChange={onSelectVibe}
        disabled={disabled}
        suggested={suggestedVibes}
      />
      <ChipRow
        label="Hair concern"
        hint="Optional"
        options={HAIR_CONCERNS}
        value={selectedConcern}
        // Click the active one again to clear it.
        onChange={(c) => onSelectConcern(selectedConcern === c ? null : c)}
        disabled={disabled}
        suggested={suggestedConcerns}
      />
    </div>
  );
}
