import type { RendererProps } from "./types";

interface Category {
  score: number;
  title: string;
}

interface QualityData {
  lighthouseResult?: {
    categories?: Record<string, Category>;
  };
}

function scoreColor(score: number): string {
  if (score > 89) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

export function QualityRenderer({ data }: RendererProps) {
  const d = data as QualityData | undefined;
  const cats = d?.lighthouseResult?.categories;

  if (!cats || Object.keys(cats).length === 0) {
    return <span className="text-sm text-muted">No quality data</span>;
  }

  return (
    <div className="space-y-2">
      {Object.values(cats).map((cat) => {
        const score = Math.round((cat.score ?? 0) * 100);
        return (
          <div key={cat.title} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
            <span className="text-sm text-muted">{cat.title}</span>
            <span className={`text-lg font-bold tabular-nums ${scoreColor(score)}`}>
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
}
