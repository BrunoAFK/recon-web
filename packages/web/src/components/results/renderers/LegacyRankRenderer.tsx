import type { RendererProps } from "./types";
import { KeyValueTable } from "./primitives";

export function LegacyRankRenderer({ data }: RendererProps) {
  if (!data || typeof data !== "object") {
    return <p className="text-sm text-muted">No ranking data available.</p>;
  }

  const d = data as Record<string, unknown>;
  const rank = d.rank ?? d.Rank;
  const domain = d.domain ?? d.Domain;
  const message = typeof d.message === "string" ? String(d.message) : undefined;
  const domainLabel = domain != null ? String(domain) : undefined;

  if (message && (rank == null || rank === "")) {
    return (
      <div>
        <p className="text-sm text-muted">{message}</p>
        {domainLabel && <p className="mt-2 text-sm text-muted">{domainLabel}</p>}
      </div>
    );
  }

  return (
    <div>
      {rank != null && (
        <div className="mb-2">
          <span
            className="text-2xl font-bold tabular-nums text-accent"
            style={{ fontFamily: "var(--font-display)" }}
          >
            #{String(rank)}
          </span>
        </div>
      )}
      <KeyValueTable
        items={[
          ...(domainLabel ? [{ label: "Domain", value: domainLabel }] : []),
          ...(d.date ? [{ label: "Date", value: String(d.date) }] : []),
          ...(d.source ? [{ label: "Source", value: String(d.source) }] : []),
        ].filter((item) => item.value !== "undefined")}
      />
    </div>
  );
}
