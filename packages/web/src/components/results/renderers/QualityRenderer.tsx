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
    <div className="flex flex-wrap gap-4">
      {Object.values(cats).map((cat) => {
        const score = Math.round((cat.score ?? 0) * 100);
        return (
          <div key={cat.title} className="flex flex-col items-center gap-0.5">
            <span className={`text-xl font-bold ${scoreColor(score)}`}>
              {score}
            </span>
            <span className="text-sm text-muted text-center leading-tight max-w-[70px]">
              {cat.title}
            </span>
          </div>
        );
      })}
    </div>
  );
}
