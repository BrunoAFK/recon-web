import { useState } from "react";
import type { RendererProps } from "./types";
import { DotGrid, KeyValueRow } from "./primitives";

interface BlockListsData {
  blocklists?: Array<{
    server: string;
    serverIp?: string;
    isBlocked: boolean;
  }>;
}

export function BlockListsRenderer({ data }: RendererProps) {
  const d = (data ?? {}) as BlockListsData;
  const lists = d.blocklists ?? [];

  if (lists.length === 0) {
    return <p className="text-sm text-muted">No blocklist data.</p>;
  }

  const blockedCount = lists.filter((l) => l.isBlocked).length;
  const [showDetails, setShowDetails] = useState(false);

  const summary =
    blockedCount === 0
      ? `Not blocked on any of ${lists.length} lists \u2713`
      : `Blocked on ${blockedCount} of ${lists.length} lists \u2717`;

  return (
    <div>
      <p className={`text-sm font-medium ${blockedCount === 0 ? "text-success" : "text-danger"}`}>
        {summary}
      </p>
      <button
        type="button"
        onClick={() => setShowDetails((v) => !v)}
        className="text-sm text-muted hover:text-foreground mt-1"
      >
        {showDetails ? "Hide details" : "Show details"}
      </button>
      {showDetails && (
        <div className="mt-2">
          <DotGrid
            items={lists.map((l) => ({
              label: l.server,
              status: !l.isBlocked,
            }))}
          />
        </div>
      )}
    </div>
  );
}
