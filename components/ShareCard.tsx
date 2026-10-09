"use client";

import { useState } from "react";
import { encodeCampaign, type SharedCampaign } from "@/lib/share";

/**
 * Send the campaign to someone: the whole thing is packed into the link
 * itself, so it opens exactly as generated, with no account and no server.
 */
export default function ShareCard({ campaign }: { campaign: SharedCampaign }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const [link, setLink] = useState("");

  const share = async () => {
    const hash = await encodeCampaign(campaign);
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState((s) => (s === "copied" ? "idle" : s)), 2500);
    } catch {
      setState("manual"); // clipboard blocked — show the link to copy by hand
    }
  };

  return (
    <div className="card flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3">
        <span className="label">Share the campaign</span>
        <p className="body-sm" style={{ color: "var(--cream-70)" }}>
          One link carries everything — products, brief, copy and scene. Whoever
          opens it sees this exact campaign.
        </p>
      </div>
      <button type="button" onClick={share} className="btn-ghost self-start">
        {state === "copied" ? "Link copied ✓" : "Copy share link"}
      </button>
      {state === "manual" && (
        <input
          readOnly
          value={link}
          aria-label="Share link"
          onFocus={(e) => e.currentTarget.select()}
          className="input-line"
          style={{ fontSize: 12 }}
        />
      )}
    </div>
  );
}
