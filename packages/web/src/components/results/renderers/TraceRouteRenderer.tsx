import { useState } from "react";
import { Verdict } from "./primitives";
import type { RendererProps } from "./types";

interface TracerouteHop {
  hop: number;
  ip: string | null;
  rtt1: string | null;
  rtt2: string | null;
  rtt3: string | null;
}

interface TraceData {
  message?: string;
  result?: TracerouteHop[];
  reachedTarget?: boolean;
  respondingHops?: number;
  totalHops?: number;
}

type DisplayEntry =
  | { type: "hop"; hop: TracerouteHop }
  | { type: "gap"; count: number };

function bestRtt(hop: TracerouteHop): string {
  const rtts = [hop.rtt1, hop.rtt2, hop.rtt3]
    .filter(Boolean)
    .map((v) => parseFloat(v!))
    .filter((v) => !isNaN(v));
  if (rtts.length === 0) return "*";
  return `${Math.min(...rtts).toFixed(3)} ms`;
}

function hasData(hop: TracerouteHop): boolean {
  return hop.ip !== null || hop.rtt1 !== null || hop.rtt2 !== null || hop.rtt3 !== null;
}

function collapseHops(hops: TracerouteHop[]): DisplayEntry[] {
  const entries: DisplayEntry[] = [];
  let gapCount = 0;

  for (const hop of hops) {
    if (hasData(hop)) {
      if (gapCount > 0) {
        entries.push({ type: "gap", count: gapCount });
        gapCount = 0;
      }
      entries.push({ type: "hop", hop });
    } else {
      gapCount++;
    }
  }
  if (gapCount > 0) {
    entries.push({ type: "gap", count: gapCount });
  }
  return entries;
}

export function TraceRouteRenderer({ data }: RendererProps) {
  if (!data) return <span className="text-sm text-muted">No traceroute data</span>;

  if (typeof data === "string") {
    return <pre className="text-xs text-muted whitespace-pre-wrap">{data.slice(0, 500)}</pre>;
  }

  const d = data as TraceData;
  const hops = d.result;
  const respondingHops = d.respondingHops ?? hops?.filter(hasData).length ?? 0;

  if (!Array.isArray(hops) || hops.length === 0 || respondingHops === 0) {
    return (
      <Verdict
        label="Route traced?"
        passed={false}
        description={d.message ?? "Traceroute could not reach any hops. ICMP may be blocked."}
      />
    );
  }

  const entries = collapseHops(hops);
  const [showAll, setShowAll] = useState(false);
  const visibleEntries = showAll ? entries : entries.slice(0, 8);
  const hiddenCount = entries.length - 8;

  const lastResponding = [...hops].reverse().find(hasData);
  const totalRtt = lastResponding ? bestRtt(lastResponding) : "*";

  return (
    <div className="space-y-3">
      {/* Summary */}
      <p className="text-sm text-muted">{d.message}</p>

      {/* Hop chain */}
      <div className="flex flex-col items-center">
        {visibleEntries.map((entry, i) => (
          <div key={i} className="flex flex-col items-center">
            {entry.type === "hop" ? (
              <div className="text-center py-1.5">
                <p className="text-sm font-medium text-foreground font-mono">{entry.hop.ip ?? "*"}</p>
                <p className="text-xs text-muted">
                  Hop {entry.hop.hop} — {bestRtt(entry.hop)}
                </p>
              </div>
            ) : (
              <div className="text-center py-1">
                <p className="text-xs text-muted/40 italic">
                  {entry.count} hop{entry.count > 1 ? "s" : ""} no response
                </p>
              </div>
            )}

            {i < visibleEntries.length - 1 && (
              <div className="flex flex-col items-center text-accent/50 leading-none">
                <span className="text-[10px]">|</span>
                <span className="text-xs">{"\u25BC"}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {hiddenCount > 0 && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            {showAll ? "Show less \u25B2" : `+${hiddenCount} more \u25BC`}
          </button>
        </div>
      )}

      <p className="text-sm font-medium text-center text-muted pt-2 border-t border-border/20">
        {respondingHops} responding hop{respondingHops > 1 ? "s" : ""} — last RTT: {totalRtt}
      </p>
    </div>
  );
}
