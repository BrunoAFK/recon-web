import { useState } from "react";
import type { RendererProps } from "./types";

export function HeadersRenderer({ data }: RendererProps) {
  const headers = (data ?? {}) as Record<string, string>;
  const entries = Object.entries(headers);
  const [showAll, setShowAll] = useState(false);

  if (entries.length === 0) {
    return <p className="text-sm text-muted">No headers found.</p>;
  }

  const visible = showAll ? entries : entries.slice(0, 10);
  const hiddenCount = entries.length - 10;

  return (
    <div className="space-y-0">
      {visible.map(([key, value]) => (
        <div key={key} className="py-2 border-b border-border/15 last:border-0">
          <p className="text-[11px] text-muted uppercase tracking-[0.15em] font-semibold mb-0.5">
            {key}
          </p>
          <p className="text-sm text-foreground break-all font-mono leading-snug">
            {String(value)}
          </p>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-muted hover:text-foreground transition-colors pt-2"
        >
          {showAll ? "Show less \u25b4" : `+${hiddenCount} more headers \u25be`}
        </button>
      )}
    </div>
  );
}
