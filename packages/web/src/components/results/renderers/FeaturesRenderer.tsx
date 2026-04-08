import { useState, useMemo } from "react";
import { Layers, Eye, EyeOff } from "lucide-react";
import type { RendererProps } from "./types";
import Modal from "../../ui/Modal";

interface Category {
  name: string;
  live: number;
  dead: number;
  latest: number;
  oldest: number;
}

interface Group {
  name: string;
  live: number;
  dead: number;
  latest: number;
  oldest: number;
  categories: Category[];
}

interface FeaturesData {
  domain: string;
  first: number;
  last: number;
  groups: Group[];
}

function parseData(data: unknown): FeaturesData | null {
  if (!data || typeof data !== "object") return null;
  const d = data as any;
  if (d.groups && Array.isArray(d.groups)) return d as FeaturesData;
  return null;
}

function formatDate(ts?: number): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function FeaturesRenderer({ data }: RendererProps) {
  const [showModal, setShowModal] = useState(false);
  const parsed = parseData(data);

  if (!parsed) {
    return <p className="text-sm text-muted">No features data available.</p>;
  }

  const { groups } = parsed;
  if (groups.length === 0) {
    return <p className="text-sm text-muted">No features detected.</p>;
  }

  // Sort groups: active first, then by total count
  const sorted = [...groups].sort((a, b) => {
    if (a.live !== b.live) return b.live - a.live;
    return (b.live + b.dead) - (a.live + a.dead);
  });

  const totalTech = groups.reduce((sum, g) => sum + g.live + g.dead, 0);
  const activeTech = groups.reduce((sum, g) => sum + g.live, 0);
  const preview = sorted.slice(0, 6);

  return (
    <div className="space-y-3">
      {/* Compact summary chips */}
      <div className="flex flex-wrap gap-2">
        {preview.map((g) => (
          <span
            key={g.name}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium border ${
              g.live > 0
                ? "border-success/25 bg-success/8 text-success"
                : "border-border/40 bg-surface-light/20 text-muted"
            }`}
          >
            <span className="capitalize">{g.name}</span>
            <span className="opacity-60">{g.live + g.dead}</span>
          </span>
        ))}
        {sorted.length > 6 && (
          <span className="text-xs text-muted self-center">+{sorted.length - 6} more</span>
        )}
      </div>

      {/* Stats + View all */}
      <p className="text-xs text-muted">
        {totalTech} technologies · {activeTech} active · {groups.length} categories
      </p>
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-border/30 bg-background/30 px-4 py-2.5 text-sm text-accent font-medium hover:border-accent/40 hover:bg-accent/5 transition-all"
      >
        <Layers className="h-3.5 w-3.5" />
        View all technologies
      </button>

      {/* Detail modal */}
      {showModal && (
        <FeaturesModal
          parsed={parsed}
          sorted={sorted}
          totalTech={totalTech}
          activeTech={activeTech}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function FeaturesModal({
  parsed,
  sorted,
  totalTech,
  activeTech,
  onClose,
}: {
  parsed: FeaturesData;
  sorted: Group[];
  totalTech: number;
  activeTech: number;
  onClose: () => void;
}) {
  const [showInactive, setShowInactive] = useState(false);

  const filteredGroups = useMemo(
    () => (showInactive ? sorted : sorted.filter((g) => g.live > 0)),
    [sorted, showInactive],
  );

  const activeGroups = sorted.filter((g) => g.live > 0).length;

  return (
    <Modal
      title={`Technologies — ${parsed.domain}`}
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      {/* Stats bar + toggle */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/30">
        <div className="flex gap-6">
          <Stat label="Total" value={totalTech} />
          <Stat label="Active" value={activeTech} accent />
          <Stat label="Past" value={totalTech - activeTech} />
          <Stat label="Categories" value={sorted.length} />
        </div>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border transition-all ${
            showInactive
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-border/40 bg-surface-light/20 text-muted hover:text-foreground"
          }`}
        >
          {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showInactive ? "All" : `Active (${activeGroups})`}
        </button>
      </div>

      {/* Groups grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-base">
        {filteredGroups.map((g) => (
          <GroupCard key={g.name} group={g} showInactive={showInactive} />
        ))}
      </div>

      {!showInactive && sorted.length > activeGroups && (
        <p className="text-sm text-muted text-center mt-4">
          {sorted.length - activeGroups} inactive categories hidden
        </p>
      )}
    </Modal>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${accent ? "text-success" : "text-foreground"}`}>{value}</p>
      <p className="text-sm text-muted uppercase tracking-wider">{label}</p>
    </div>
  );
}

function GroupCard({ group, showInactive }: { group: Group; showInactive: boolean }) {
  const first = formatDate(group.oldest);
  const last = formatDate(group.latest);
  const hasActive = group.live > 0;

  const visibleCats = showInactive
    ? group.categories
    : group.categories.filter((c) => c.live > 0);
  const hiddenCount = group.categories.length - visibleCats.length;

  return (
    <div className={`rounded-xl border p-4 ${
      hasActive
        ? "border-success/20 bg-success/3"
        : "border-border/30 bg-background/40"
    }`}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {hasActive && <span className="h-2 w-2 rounded-full bg-success shrink-0" />}
          <h4 className="text-base font-semibold text-foreground capitalize">{group.name}</h4>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          {group.live > 0 && <span className="text-success font-medium">{group.live} active</span>}
          {group.dead > 0 && <span>{group.dead} past</span>}
        </div>
      </div>

      {/* Date range */}
      {first && last && (
        <p className="text-sm text-muted/60 mb-2.5">{first} — {last}</p>
      )}

      {/* Categories */}
      {visibleCats.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {visibleCats.map((cat) => (
            <span
              key={cat.name}
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm ${
                cat.live > 0
                  ? "border border-accent/25 bg-accent/8 text-foreground"
                  : "border border-border/20 bg-surface-light/20 text-muted/70"
              }`}
            >
              {cat.name}
            </span>
          ))}
          {!showInactive && hiddenCount > 0 && (
            <span className="text-sm text-muted/50 self-center">+{hiddenCount} inactive</span>
          )}
        </div>
      ) : group.categories.length > 0 && !showInactive ? (
        <p className="text-sm text-muted/50">{group.categories.length} inactive categories</p>
      ) : (
        <p className="text-sm text-muted/40 italic">No subcategories</p>
      )}
    </div>
  );
}
