import { useMemo, useState } from "react";
import { MinusCircle, Search, X } from "lucide-react";
import ResultCard from "./ResultCard";
import { classifyError } from "./classify-error";
import type {
  HandlerCategory,
  HandlerMetadata,
  HandlerResultData,
  ScanProgress,
} from "@/lib/api";

function isEmptyData(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") return Object.keys(data as object).length === 0;
  return false;
}

function isSkippedResult(result: HandlerResultData | undefined): boolean {
  if (!result) return false;
  if (result.skipped) return true;
  return !!result.error && classifyError(result.error, result.errorCategory) === "tool";
}

function stringifySearchableResult(result: HandlerResultData | undefined): string {
  if (!result) return "";

  try {
    return JSON.stringify(result).toLowerCase();
  } catch {
    return "";
  }
}

const CATEGORY_ORDER: HandlerCategory[] = [
  "security",
  "dns",
  "network",
  "content",
  "meta",
  "performance",
];

const CATEGORY_LABELS: Record<HandlerCategory, string> = {
  security: "Security",
  dns: "DNS",
  network: "Network",
  content: "Content",
  meta: "Meta",
  performance: "Performance",
};

interface ResultGridProps {
  results: Record<string, HandlerResultData>;
  handlers: HandlerMetadata[];
  isLoading?: boolean;
  url?: string;
  progress?: ScanProgress;
  liveStatus?: "idle" | "streaming" | "fallback-loading" | "completed" | "failed";
  lastCompletedLabel?: string | null;
  durationMs?: number | null;
}

export default function ResultGrid({
  results,
  handlers,
  isLoading = false,
  url,
  progress,
  liveStatus,
  lastCompletedLabel,
  durationMs,
}: ResultGridProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<HandlerCategory | "all">("all");
  type StatusFilter = "all" | "ok" | "issues" | "info" | "skipped";
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");

  const { normalHandlers, skippedHandlers } = useMemo(() => {
    const normal: HandlerMetadata[] = [];
    const skipped: HandlerMetadata[] = [];

    for (const h of handlers) {
      const r = results[h.name];
      if (isSkippedResult(r)) {
        skipped.push(h);
      } else {
        normal.push(h);
      }
    }

    normal.sort((a, b) => {
      const catA = CATEGORY_ORDER.indexOf(a.category);
      const catB = CATEGORY_ORDER.indexOf(b.category);
      if (catA !== catB) return catA - catB;
      return (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name);
    });

    return { normalHandlers: normal, skippedHandlers: skipped };
  }, [handlers, results]);

  function getResultStatus(r: HandlerResultData | undefined): StatusFilter {
    if (!r) return "all";
    if (isSkippedResult(r)) return "skipped";
    if (r.error) {
      const kind = classifyError(r.error, r.errorCategory);
      if (kind === "site") return "issues";
      if (kind === "info") return "info";
      return "skipped";
    }
    if (r.data !== undefined && !isEmptyData(r.data)) return "ok";
    return "all";
  }

  const filteredNormalHandlers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return normalHandlers.filter((handler) => {
      if (activeCategory !== "all" && handler.category !== activeCategory) return false;
      if (activeStatus !== "all" && getResultStatus(results[handler.name]) !== activeStatus) return false;
      if (!term) return true;

      const haystack = [
        handler.name,
        handler.displayName,
        handler.description,
        handler.shortDescription,
        stringifySearchableResult(results[handler.name]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [activeCategory, activeStatus, normalHandlers, search, results]);

  const filteredSkippedHandlers = useMemo(() => {
    const term = search.trim().toLowerCase();

    // If status filter is set and it's not "skipped" or "all", hide the skipped section
    if (activeStatus !== "all" && activeStatus !== "skipped") return [];

    return skippedHandlers.filter((handler) => {
      if (activeCategory !== "all" && handler.category !== activeCategory) return false;
      if (!term) return true;

      const haystack = [
        handler.name,
        handler.displayName,
        handler.description,
        handler.shortDescription,
        stringifySearchableResult(results[handler.name]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [activeCategory, activeStatus, search, skippedHandlers, results]);

  const total = progress?.total ?? handlers.length;
  const completed = progress?.completed ?? Object.keys(results).length;
  const succeeded = Object.values(results).filter(
    (r) => r.data !== undefined && !r.error && !r.skipped && !isEmptyData(r.data),
  ).length;
  const skippedCount = Object.values(results).filter((r) => isSkippedResult(r)).length;
  const errorResults = Object.values(results).filter((r) => r.error);
  const siteIssues = errorResults.filter((r) => classifyError(r.error!, r.errorCategory) === "site").length;
  const infoCount = errorResults.filter((r) => classifyError(r.error!, r.errorCategory) === "info").length;

  let animIndex = 0;

  return (
    <div className="space-y-10">
      {liveStatus === "streaming" && progress && (
        <div className="rounded-2xl border border-border/40 bg-surface/60 p-5 animate-fade-in">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <p className="text-[15px] font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
                Live scan in progress
              </p>
              <p className="text-sm text-muted mt-1">
                {lastCompletedLabel
                  ? `Last completed: ${lastCompletedLabel}`
                  : "Waiting for the first completed check."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {completed} / {total}
              </p>
              <p className="text-sm text-muted">{progress.active} active now</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-border/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: total > 0 ? `${(completed / total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {liveStatus === "fallback-loading" && (
        <div className="rounded-2xl border border-border/35 bg-surface/55 p-5 animate-fade-in">
          <p className="text-[15px] font-semibold text-foreground" style={{ fontFamily: "var(--font-display)" }}>
            Finalizing scan
          </p>
          <p className="mt-1 text-sm text-muted">
            Live streaming is unavailable, so the page is waiting for the server to finish the full scan response.
          </p>
        </div>
      )}

      {!isLoading && completed > 0 && (
        <div className="flex flex-wrap items-center gap-6 animate-fade-in">
          <StatBadge label="Total" value={total} />
          <StatBadge label="OK" value={succeeded} color="text-success" />
          {durationMs != null && (
            <StatBadge label="Duration" value={`${(durationMs / 1000).toFixed(1)}s`} />
          )}
          {siteIssues > 0 && <StatBadge label="Issues" value={siteIssues} color="text-danger" />}
          {infoCount > 0 && <StatBadge label="Info" value={infoCount} color="text-muted" />}
          {skippedCount > 0 && <StatBadge label="Skipped" value={skippedCount} color="text-muted" />}
        </div>
      )}

      <section className="rounded-2xl border border-border/40 bg-surface/75 p-4 animate-fade-in">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === "all"
                  ? "bg-accent text-background"
                  : "border border-border/50 text-muted hover:text-foreground hover:border-border"
              }`}
            >
              All
            </button>
            {CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeCategory === category
                    ? "bg-accent text-background"
                    : "border border-border/50 text-muted hover:text-foreground hover:border-border"
                }`}
              >
                {CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { key: "all", label: "All" },
                { key: "ok", label: `OK (${succeeded})` },
                { key: "issues", label: `Issues (${siteIssues})` },
                { key: "info", label: `Info (${infoCount})` },
                { key: "skipped", label: `Skipped (${skippedCount})` },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveStatus(key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeStatus === key
                    ? "bg-foreground/10 text-foreground ring-1 ring-foreground/20"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2 lg:max-w-sm">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search checks"
                className="w-full rounded-xl border border-border/50 bg-background/40 py-2 pl-9 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-border"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted">
          Showing {filteredNormalHandlers.length + filteredSkippedHandlers.length} of {handlers.length} checks
        </p>
      </section>

      <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
        {filteredNormalHandlers.map((handler) => {
          const idx = animIndex++;
          return (
            <div key={handler.name} className="mb-4 break-inside-avoid">
              <ResultCard
                name={handler.name}
                displayName={handler.displayName}
                category={handler.category}
                description={handler.description}
                shortDescription={handler.shortDescription}
                result={results[handler.name]}
                isLoading={isLoading && !results[handler.name]}
                animDelay={idx * 30}
                url={url}
              />
            </div>
          );
        })}
      </div>

      {filteredSkippedHandlers.length > 0 && (
        <section className="animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <MinusCircle className="h-5 w-5 text-muted/50" />
            <h2
              className="text-lg font-semibold tracking-tight text-muted/60"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Skipped
            </h2>
            <span className="text-sm text-muted/40 tabular-nums">{filteredSkippedHandlers.length}</span>
          </div>
          <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
            {filteredSkippedHandlers.map((handler) => {
              const idx = animIndex++;
              return (
                <div key={handler.name} className="mb-4 break-inside-avoid">
                  <ResultCard
                    name={handler.name}
                    displayName={handler.displayName}
                    category={handler.category}
                    description={handler.description}
                    shortDescription={handler.shortDescription}
                    result={results[handler.name]}
                    isLoading={false}
                    animDelay={idx * 30}
                    variant="skipped"
                    url={url}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function StatBadge({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
      <span className="text-sm text-muted uppercase tracking-wide">{label}</span>
    </div>
  );
}
