import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  MinusCircle,
  Search,
  X,
  Layers,
  Activity,
  LayoutGrid,
  ArrowUpDown,
  ChevronsUpDown,
  Shield,
  Globe2,
  Network,
  FileText,
  Database,
  Gauge,
  ChevronDown,
} from "lucide-react";
import ResultCard from "./ResultCard";
import { classifyError } from "./classify-error";
import { getDefaultGroupBy, getDefaultSortBy, getDefaultStatusOrder, type GroupBy, type SortBy, type StatusOrder } from "@/hooks/use-preferences";
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

/**
 * DOM-aware masonry grid. Renders all items in a hidden single-column
 * measurement container, reads their heights, then distributes them
 * across columns using a shortest-column-first algorithm.
 * Falls back to round-robin before measurements are available.
 */
function MasonryGrid<T extends { key: string }>({
  items,
  columnCount,
  renderItem,
}: {
  items: T[];
  columnCount: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}) {
  const cols = Math.max(1, columnCount);
  const measureRef = useRef<HTMLDivElement>(null);
  const [distribution, setDistribution] = useState<number[][]>(() =>
    buildRoundRobin(items.length, cols),
  );

  const itemKeys = items.map((i) => i.key).join(',');

  // After items render in the measurement container, read heights and distribute
  useLayoutEffect(() => {
    if (cols <= 1) {
      setDistribution([items.map((_, i) => i)]);
      return;
    }

    const el = measureRef.current;
    if (!el) {
      setDistribution(buildRoundRobin(items.length, cols));
      return;
    }

    const children = Array.from(el.children) as HTMLElement[];
    if (children.length !== items.length) {
      setDistribution(buildRoundRobin(items.length, cols));
      return;
    }

    const GAP = 16;
    const colHeights = new Array(cols).fill(0);
    const newDist: number[][] = Array.from({ length: cols }, () => []);

    for (let i = 0; i < items.length; i++) {
      const shortest = colHeights.indexOf(Math.min(...colHeights));
      newDist[shortest].push(i);
      colHeights[shortest] += children[i].offsetHeight + GAP;
    }

    setDistribution(newDist);
  }, [items.length, cols, itemKeys]);

  return (
    <>
      {/* Hidden measurement container — single column, all items rendered */}
      <div
        ref={measureRef}
        aria-hidden
        className="fixed left-[-9999px] top-0"
        style={{ width: `calc((100% - ${(cols - 1) * 16}px) / ${cols})`, visibility: 'hidden' }}
      >
        {items.map((item, i) => (
          <div key={item.key}>{renderItem(item, i)}</div>
        ))}
      </div>

      {/* Visible columns */}
      <div className="flex gap-4">
        {distribution.map((indices, colIdx) => (
          <div key={colIdx} className="flex-1 min-w-0 space-y-4">
            {indices.map((i) => {
              const item = items[i];
              return item ? <React.Fragment key={item.key}>{renderItem(item, i)}</React.Fragment> : null;
            })}
          </div>
        ))}
      </div>
    </>
  );
}

function buildRoundRobin(count: number, cols: number): number[][] {
  const dist: number[][] = Array.from({ length: cols }, () => []);
  for (let i = 0; i < count; i++) dist[i % cols].push(i);
  return dist;
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
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>(getDefaultGroupBy);
  const [sortBy, setSortBy] = useState<SortBy>(getDefaultSortBy);
  const [statusOrder, setStatusOrder] = useState<StatusOrder>(getDefaultStatusOrder);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Track how many CSS columns are active based on viewport breakpoints
  const [columnCount, setColumnCount] = useState(1);
  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setColumnCount(w >= 1280 ? 3 : w >= 768 ? 2 : 1);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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

  function sortHandlers(list: HandlerMetadata[], sort: SortBy): HandlerMetadata[] {
    const sorted = [...list];
    sorted.sort((a, b) => {
      const nameA = (a.displayName ?? a.name).toLowerCase();
      const nameB = (b.displayName ?? b.name).toLowerCase();
      return sort === "name-asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
    return sorted;
  }

  const filteredNormalHandlers = useMemo(() => {
    const term = search.trim().toLowerCase();

    const filtered = normalHandlers.filter((handler) => {
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

    return sortHandlers(filtered, sortBy);
  }, [activeCategory, activeStatus, normalHandlers, search, results, sortBy]);

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
      {isLoading && progress && total > 0 && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 animate-fade-in">
          <div className="flex items-center justify-between gap-4 mb-2">
            <p className="text-sm font-medium text-foreground">
              Still scanning{lastCompletedLabel ? ` — ${lastCompletedLabel}` : ""}
            </p>
            <p className="text-sm text-muted tabular-nums">{completed}/{total}</p>
          </div>
          <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
              style={{ width: total > 0 ? `${(completed / total) * 100}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {!isLoading && completed > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 animate-fade-in">
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

      <section className="relative z-20 animate-fade-in">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category dropdown */}
          <FilterDropdown
            icon={<Layers className="h-3.5 w-3.5" />}
            label={activeCategory === "all" ? "Category" : CATEGORY_LABELS[activeCategory]}
            active={activeCategory !== "all"}
          >
            <DropdownItem
              label="All categories"
              active={activeCategory === "all"}
              onClick={() => setActiveCategory("all")}
            />
            <div className="my-1 border-t border-border/30" />
            {CATEGORY_ORDER.map((cat) => {
              const Icon = CATEGORY_ICONS[cat];
              return (
                <DropdownItem
                  key={cat}
                  icon={<Icon className="h-3.5 w-3.5" />}
                  label={CATEGORY_LABELS[cat]}
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                />
              );
            })}
          </FilterDropdown>

          {/* Status dropdown */}
          <FilterDropdown
            icon={<Activity className="h-3.5 w-3.5" />}
            label={
              activeStatus === "all"
                ? "Status"
                : activeStatus === "ok"
                  ? `OK (${succeeded})`
                  : activeStatus === "issues"
                    ? `Issues (${siteIssues})`
                    : activeStatus === "info"
                      ? `Info (${infoCount})`
                      : `Skipped (${skippedCount})`
            }
            active={activeStatus !== "all"}
          >
            <DropdownItem label="All statuses" active={activeStatus === "all"} onClick={() => setActiveStatus("all")} />
            <div className="my-1 border-t border-border/30" />
            <DropdownItem label={`OK (${succeeded})`} active={activeStatus === "ok"} onClick={() => setActiveStatus("ok")} />
            <DropdownItem label={`Issues (${siteIssues})`} active={activeStatus === "issues"} onClick={() => setActiveStatus("issues")} />
            <DropdownItem label={`Info (${infoCount})`} active={activeStatus === "info"} onClick={() => setActiveStatus("info")} />
            <DropdownItem label={`Skipped (${skippedCount})`} active={activeStatus === "skipped"} onClick={() => setActiveStatus("skipped")} />
          </FilterDropdown>

          {/* Group by dropdown */}
          <FilterDropdown
            icon={<LayoutGrid className="h-3.5 w-3.5" />}
            label={groupBy === "none" ? "Group" : groupBy === "category" ? "By Category" : "By Status"}
            active={groupBy !== "none"}
          >
            <DropdownItem label="No grouping" active={groupBy === "none"} onClick={() => setGroupBy("none")} />
            <div className="my-1 border-t border-border/30" />
            <DropdownItem label="By Category" active={groupBy === "category"} onClick={() => setGroupBy("category")} />
            <DropdownItem label="By Status" active={groupBy === "status"} onClick={() => setGroupBy("status")} />
          </FilterDropdown>

          {/* Sort dropdown — card name ordering */}
          <FilterDropdown
            icon={<ArrowUpDown className="h-3.5 w-3.5" />}
            label={sortBy === "name-asc" ? "A → Z" : "Z → A"}
            active={false}
          >
            <DropdownItem label="Name A → Z" active={sortBy === "name-asc"} onClick={() => setSortBy("name-asc")} />
            <DropdownItem label="Name Z → A" active={sortBy === "name-desc"} onClick={() => setSortBy("name-desc")} />
          </FilterDropdown>

          {/* Status group order — only when grouped by status */}
          {groupBy === "status" && (
            <FilterDropdown
              icon={<Activity className="h-3.5 w-3.5" />}
              label={statusOrder === "ok-first" ? "OK first" : "Issues first"}
              active={false}
            >
              <DropdownItem label="OK first" active={statusOrder === "ok-first"} onClick={() => setStatusOrder("ok-first")} />
              <DropdownItem label="Issues first" active={statusOrder === "issues-first"} onClick={() => setStatusOrder("issues-first")} />
            </FilterDropdown>
          )}

          {/* Collapse controls (only when grouped) */}
          {groupBy !== "none" && (
            <button
              type="button"
              onClick={() => {
                if (collapsedGroups.size > 0) {
                  setCollapsedGroups(new Set());
                } else {
                  const allKeys = groupBy === "category"
                    ? CATEGORY_ORDER.map(String)
                    : ["ok", "issues", "info", "all"];
                  setCollapsedGroups(new Set(allKeys));
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-surface/50 px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground hover:border-border/60 transition-colors"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              {collapsedGroups.size > 0 ? "Expand all" : "Collapse all"}
            </button>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-border/40 bg-surface/50 py-1.5 pl-9 pr-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Count */}
          <span className="text-sm text-muted ml-auto tabular-nums">
            {filteredNormalHandlers.length + filteredSkippedHandlers.length}/{handlers.length}
          </span>
        </div>
      </section>

      {groupBy === "none" ? (
        <MasonryGrid
          items={filteredNormalHandlers.map((h) => ({ ...h, key: h.name }))}
          columnCount={columnCount}
          renderItem={(handler, idx) => (
            <ResultCard
              key={handler.name}
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
          )}
        />
      ) : (
        <GroupedCards
          handlers={filteredNormalHandlers}
          results={results}
          isLoading={isLoading}
          url={url}
          groupBy={groupBy}
          statusOrder={statusOrder}
          getResultStatus={getResultStatus}
          animIndexRef={{ current: animIndex }}
          collapsedGroups={collapsedGroups}
          onToggleGroup={(key) => {
            setCollapsedGroups((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          }}
          columnCount={columnCount}
        />
      )}

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
          <MasonryGrid
            items={filteredSkippedHandlers.map((h) => ({ ...h, key: h.name }))}
            columnCount={columnCount}
            renderItem={(handler, idx) => (
              <ResultCard
                key={handler.name}
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
            )}
          />
        </section>
      )}
    </div>
  );
}

const CATEGORY_ICONS: Record<HandlerCategory, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  dns: Globe2,
  network: Network,
  content: FileText,
  meta: Database,
  performance: Gauge,
};

function FilterDropdown({
  icon,
  label,
  active,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? "border-accent/40 bg-accent/10 text-accent"
            : "border-border/40 bg-surface/50 text-muted hover:text-foreground hover:border-border/60"
        }`}
      >
        {icon}
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-surface p-1.5 shadow-xl z-[100] animate-fade-in">
          {React.Children.map(children, (child) =>
            React.isValidElement(child)
              ? React.cloneElement(child as React.ReactElement<{ onClose?: () => void }>, {
                  onClose: () => setOpen(false),
                })
              : child,
          )}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  label,
  icon,
  active,
  onClick,
  onClose,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
  onClose?: () => void;
}) {
  // Dividers don't have onClick
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={() => {
        onClick();
        onClose?.();
      }}
      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-left transition-colors ${
        active ? "bg-accent/10 text-accent font-medium" : "text-muted hover:text-foreground hover:bg-surface-light/40"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

type StatusFilter = "all" | "ok" | "issues" | "info" | "skipped";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "Other",
  ok: "OK",
  issues: "Issues",
  info: "Info",
  skipped: "Skipped",
};

function GroupedCards({
  handlers,
  results,
  isLoading,
  url,
  groupBy,
  statusOrder,
  getResultStatus,
  animIndexRef,
  collapsedGroups,
  onToggleGroup,
  columnCount,
}: {
  handlers: HandlerMetadata[];
  results: Record<string, HandlerResultData>;
  isLoading: boolean;
  url?: string;
  groupBy: "category" | "status";
  statusOrder: StatusOrder;
  getResultStatus: (r: HandlerResultData | undefined) => StatusFilter;
  animIndexRef: { current: number };
  columnCount: number;
  collapsedGroups: Set<string>;
  onToggleGroup: (key: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, HandlerMetadata[]>();

    if (groupBy === "category") {
      for (const cat of CATEGORY_ORDER) {
        const items = handlers.filter((h) => h.category === cat);
        if (items.length > 0) map.set(cat, items);
      }
    } else {
      const order: StatusFilter[] = statusOrder === "ok-first"
        ? ["ok", "issues", "info", "all"]
        : ["issues", "info", "ok", "all"];
      for (const status of order) {
        const items = handlers.filter((h) => getResultStatus(results[h.name]) === status);
        if (items.length > 0) map.set(status, items);
      }
    }

    return map;
  }, [handlers, results, groupBy, statusOrder, getResultStatus]);

  return (
    <div className="space-y-8">
      {Array.from(groups).map(([key, items]) => {
        const Icon = groupBy === "category" ? CATEGORY_ICONS[key as HandlerCategory] : undefined;
        const label = groupBy === "category"
          ? CATEGORY_LABELS[key as HandlerCategory]
          : STATUS_LABELS[key as StatusFilter];

        const isCollapsed = collapsedGroups.has(key);

        return (
          <section key={key}>
            <button
              type="button"
              onClick={() => onToggleGroup(key)}
              className="flex items-center gap-2 mb-4 group w-full text-left"
            >
              <ChevronDown className={`h-4 w-4 text-muted transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
              {Icon && <Icon className="h-5 w-5 text-accent" />}
              <h2
                className="text-lg font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {label}
              </h2>
              <span className="text-sm text-muted tabular-nums">{items.length}</span>
            </button>
            {!isCollapsed && (
              <MasonryGrid
                items={items.map((h) => ({ ...h, key: h.name }))}
                columnCount={columnCount}
                renderItem={(handler, idx) => {
                  animIndexRef.current++;
                  return (
                    <ResultCard
                      key={handler.name}
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
                  );
                }}
              />
            )}
          </section>
        );
      })}
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
