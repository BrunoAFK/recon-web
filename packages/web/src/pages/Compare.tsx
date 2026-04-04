import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useHistoricalScan, useHandlers } from "@/hooks/use-scan";
import type { HandlerResultData, HandlerMetadata } from "@/lib/api";

type ChangeStatus = "improved" | "degraded" | "changed" | "unchanged" | "added" | "removed";

interface HandlerDiff {
  handler: string;
  displayName: string;
  category: string;
  status: ChangeStatus;
  resultA: HandlerResultData | null;
  resultB: HandlerResultData | null;
  fields: FieldDiff[];
}

interface FieldDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "(none)";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  return JSON.stringify(v, null, 2);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function computeDiffs(
  resultsA: Record<string, HandlerResultData>,
  resultsB: Record<string, HandlerResultData>,
  handlers: HandlerMetadata[],
): HandlerDiff[] {
  const handlerMap = new Map(handlers.map((h) => [h.name, h]));
  const allNames = new Set([...Object.keys(resultsA), ...Object.keys(resultsB)]);
  const diffs: HandlerDiff[] = [];

  for (const name of allNames) {
    const meta = handlerMap.get(name);
    const displayName = meta?.displayName ?? name;
    const category = meta?.category ?? "meta";
    const a = resultsA[name] ?? null;
    const b = resultsB[name] ?? null;

    if (!a && b) {
      diffs.push({ handler: name, displayName, category, status: "added", resultA: null, resultB: b, fields: [] });
      continue;
    }
    if (a && !b) {
      diffs.push({ handler: name, displayName, category, status: "removed", resultA: a, resultB: null, fields: [] });
      continue;
    }

    // Both exist — compare
    const aJson = JSON.stringify(a);
    const bJson = JSON.stringify(b);

    if (aJson === bJson) {
      diffs.push({ handler: name, displayName, category, status: "unchanged", resultA: a, resultB: b, fields: [] });
      continue;
    }

    // Compute field-level diffs
    const fields: FieldDiff[] = [];
    const aData = a?.data;
    const bData = b?.data;

    if (a?.error !== b?.error) {
      fields.push({ field: "error", oldValue: a?.error ?? null, newValue: b?.error ?? null });
    }

    if (isRecord(aData) && isRecord(bData)) {
      const allKeys = new Set([...Object.keys(aData), ...Object.keys(bData)]);
      for (const key of allKeys) {
        if (JSON.stringify(aData[key]) !== JSON.stringify(bData[key])) {
          fields.push({ field: key, oldValue: aData[key] ?? null, newValue: bData[key] ?? null });
        }
      }
    } else if (JSON.stringify(aData) !== JSON.stringify(bData)) {
      fields.push({ field: "data", oldValue: aData, newValue: bData });
    }

    // Classify improvement vs degradation
    let status: ChangeStatus = "changed";
    // Error resolved = improved, new error = degraded
    if (a?.error && !b?.error) status = "improved";
    else if (!a?.error && b?.error) status = "degraded";

    diffs.push({ handler: name, displayName, category, status, resultA: a, resultB: b, fields });
  }

  // Sort: degraded first, then improved, changed, added, removed, unchanged
  const ORDER: Record<ChangeStatus, number> = {
    degraded: 0, improved: 1, changed: 2, added: 3, removed: 4, unchanged: 5,
  };
  diffs.sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  return diffs;
}

const STATUS_COLORS: Record<ChangeStatus, string> = {
  improved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  degraded: "text-red-400 bg-red-500/10 border-red-500/20",
  changed: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  unchanged: "text-muted bg-surface/50 border-border/30",
  added: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  removed: "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

type Filter = "all" | "changed" | "issues";

export default function Compare() {
  const { id1, id2 } = useParams<{ id1: string; id2: string }>();
  const scanA = useHistoricalScan(id1 ?? "");
  const scanB = useHistoricalScan(id2 ?? "");
  const handlers = useHandlers();
  const [filter, setFilter] = useState<Filter>("changed");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const resultsA: Record<string, HandlerResultData> = useMemo(() => {
    const map: Record<string, HandlerResultData> = {};
    if (scanA.data?.results) {
      for (const r of scanA.data.results) map[r.handler] = r.result;
    }
    return map;
  }, [scanA.data]);

  const resultsB: Record<string, HandlerResultData> = useMemo(() => {
    const map: Record<string, HandlerResultData> = {};
    if (scanB.data?.results) {
      for (const r of scanB.data.results) map[r.handler] = r.result;
    }
    return map;
  }, [scanB.data]);

  const diffs = useMemo(() => {
    if (!handlers.data) return [];
    return computeDiffs(resultsA, resultsB, handlers.data);
  }, [resultsA, resultsB, handlers.data]);

  const filtered = useMemo(() => {
    if (filter === "all") return diffs;
    if (filter === "changed") return diffs.filter((d) => d.status !== "unchanged");
    return diffs.filter((d) => d.status === "degraded" || d.status === "removed");
  }, [diffs, filter]);

  const toggleExpand = (handler: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(handler)) next.delete(handler);
      else next.add(handler);
      return next;
    });
  };

  const isLoading = scanA.isLoading || scanB.isLoading;
  const isError = scanA.isError || scanB.isError;

  const changedCount = diffs.filter((d) => d.status !== "unchanged").length;
  const degradedCount = diffs.filter((d) => d.status === "degraded").length;
  const improvedCount = diffs.filter((d) => d.status === "improved").length;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link
        to="/history"
        className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-foreground transition-colors mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to history
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Scan Comparison
      </h1>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 mb-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-danger mt-0.5 shrink-0" />
            <p className="text-sm text-muted">Failed to load one or both scans.</p>
          </div>
        </div>
      )}

      {scanA.data && scanB.data && (
        <>
          {/* Scan headers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="rounded-xl border border-border/50 bg-surface/50 p-4">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Scan A (older)</div>
              <div className="text-sm font-medium truncate">{scanA.data.url}</div>
              <div className="text-xs text-muted mt-1">
                {new Date(scanA.data.created_at).toLocaleString()}
                {scanA.data.duration_ms != null && ` · ${(scanA.data.duration_ms / 1000).toFixed(1)}s`}
              </div>
            </div>
            <div className="rounded-xl border border-border/50 bg-surface/50 p-4">
              <div className="text-xs text-muted uppercase tracking-wider mb-1">Scan B (newer)</div>
              <div className="text-sm font-medium truncate">{scanB.data.url}</div>
              <div className="text-xs text-muted mt-1">
                {new Date(scanB.data.created_at).toLocaleString()}
                {scanB.data.duration_ms != null && ` · ${(scanB.data.duration_ms / 1000).toFixed(1)}s`}
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-4 mb-6 text-sm">
            <span className="text-muted">{diffs.length} handlers</span>
            <span className="text-amber-400">{changedCount} changed</span>
            {degradedCount > 0 && <span className="text-red-400">{degradedCount} degraded</span>}
            {improvedCount > 0 && <span className="text-emerald-400">{improvedCount} improved</span>}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-6">
            {(["all", "changed", "issues"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  filter === f
                    ? "bg-accent/15 text-accent font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : f === "changed" ? "Changed only" : "Issues only"}
              </button>
            ))}
            <span className="text-xs text-muted ml-2">
              Showing {filtered.length} of {diffs.length}
            </span>
          </div>

          {/* Diff list */}
          <div className="space-y-2">
            {filtered.map((diff) => {
              const isOpen = expanded.has(diff.handler);
              const hasDetails = diff.fields.length > 0;

              return (
                <div
                  key={diff.handler}
                  className={`rounded-xl border transition-colors ${STATUS_COLORS[diff.status]}`}
                >
                  <button
                    onClick={() => hasDetails && toggleExpand(diff.handler)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                    disabled={!hasDetails}
                  >
                    {hasDetails ? (
                      isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    <span className="font-medium text-sm flex-1">{diff.displayName}</span>

                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        diff.status === "unchanged" ? "bg-border/20 text-muted" : ""
                      }`}
                    >
                      {diff.status}
                    </span>
                  </button>

                  {isOpen && hasDetails && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="rounded-lg bg-background/50 border border-border/30 overflow-x-auto">
                        {/* Desktop: table layout */}
                        <table className="w-full text-sm hidden sm:table">
                          <thead>
                            <tr className="border-b border-border/30 text-xs text-muted">
                              <th className="text-left px-3 py-2 font-medium w-1/5">Field</th>
                              <th className="text-left px-3 py-2 font-medium w-2/5">Scan A</th>
                              <th className="text-left px-3 py-2 font-medium w-2/5">Scan B</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diff.fields.map((f, i) => (
                              <tr key={i} className="border-b border-border/20 last:border-0">
                                <td className="px-3 py-2 text-muted font-medium">{f.field}</td>
                                <td className="px-3 py-2 text-red-300/80 break-all">
                                  <pre className="whitespace-pre-wrap text-xs max-h-32 overflow-auto">
                                    {stringify(f.oldValue)}
                                  </pre>
                                </td>
                                <td className="px-3 py-2 text-emerald-300/80 break-all">
                                  <pre className="whitespace-pre-wrap text-xs max-h-32 overflow-auto">
                                    {stringify(f.newValue)}
                                  </pre>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Mobile: stacked layout */}
                        <div className="sm:hidden divide-y divide-border/20">
                          {diff.fields.map((f, i) => (
                            <div key={i} className="p-3 space-y-2">
                              <p className="text-xs font-medium text-muted uppercase tracking-wider">{f.field}</p>
                              <div className="space-y-1.5">
                                <div>
                                  <span className="text-[10px] text-muted uppercase">A: </span>
                                  <pre className="inline whitespace-pre-wrap text-xs text-red-300/80 break-all">
                                    {stringify(f.oldValue)}
                                  </pre>
                                </div>
                                <div>
                                  <span className="text-[10px] text-muted uppercase">B: </span>
                                  <pre className="inline whitespace-pre-wrap text-xs text-emerald-300/80 break-all">
                                    {stringify(f.newValue)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted">
              <p className="text-sm">No handlers match this filter.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
