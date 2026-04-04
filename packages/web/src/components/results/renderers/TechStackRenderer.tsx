import { Chip, KeyValueTable, SectionLabel } from "./primitives";
import type { RendererProps } from "./types";

interface Tech {
  name: string;
  categories?: string[];
  confidence?: number;
}

interface TechStackData {
  message?: string;
  technologies?: Tech[];
}

function chipVariant(confidence?: number): "accent" | "default" | "warning" {
  if (confidence == null) return "default";
  if (confidence > 80) return "accent";
  if (confidence > 50) return "default";
  return "warning";
}

export function TechStackRenderer({ data }: RendererProps) {
  const details = data as TechStackData | undefined;
  const technologies = details?.technologies ?? [];

  if (!technologies.length) {
    return <span className="text-sm text-muted">{details?.message ?? "No technologies detected"}</span>;
  }

  const grouped = new Map<string, Tech[]>();
  for (const technology of technologies) {
    const key = technology.categories?.[0] ?? "Other";
    const bucket = grouped.get(key) ?? [];
    bucket.push(technology);
    grouped.set(key, bucket);
  }

  return (
    <div className="space-y-4">
      <KeyValueTable items={[{ label: "Detected", value: `${technologies.length} technologies` }]} />
      {[...grouped.entries()].map(([category, items]) => (
        <div key={category}>
          <SectionLabel>{category}</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((technology) => (
              <Chip
                key={`${category}-${technology.name}`}
                label={technology.confidence != null ? `${technology.name} (${technology.confidence}%)` : technology.name}
                variant={chipVariant(technology.confidence)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
