import type { RendererProps } from "./types";
import { Chip, SectionLabel } from "./primitives";

export function FeaturesRenderer({ data }: RendererProps) {
  if (!data || typeof data !== "object") {
    return <p className="text-sm text-muted">No features data available.</p>;
  }

  // BuiltWith can return various shapes — handle arrays and objects
  const entries = Array.isArray(data)
    ? data
    : Object.entries(data).flatMap(([category, items]) =>
        Array.isArray(items)
          ? items.map((item: unknown) => ({
              category,
              name: typeof item === "string" ? item : (item as Record<string, unknown>)?.Name ?? (item as Record<string, unknown>)?.name ?? String(item),
            }))
          : [{ category, name: String(items) }],
      );

  if (entries.length === 0) {
    return <p className="text-sm text-muted">No features detected.</p>;
  }

  // Group by category if available
  const grouped = new Map<string, string[]>();
  for (const entry of entries) {
    const cat = typeof entry === "object" && entry !== null && "category" in entry
      ? String((entry as Record<string, unknown>).category)
      : "Other";
    const name = typeof entry === "object" && entry !== null && "name" in entry
      ? String((entry as Record<string, unknown>).name)
      : String(entry);
    const list = grouped.get(cat) ?? [];
    list.push(name);
    grouped.set(cat, list);
  }

  return (
    <div className="space-y-2">
      {[...grouped.entries()].map(([category, names]) => (
        <div key={category}>
          <SectionLabel>{category}</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {names.slice(0, 12).map((name, i) => (
              <Chip key={i} label={name} />
            ))}
            {names.length > 12 && (
              <span className="text-sm text-muted self-center">+{names.length - 12} more</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
