import type { RendererProps } from "./types";

interface RankData {
  domain?: string;
  message?: string;
  ranks?: Array<{ date: string; rank: number }>;
}

export function RankRenderer({ data }: RendererProps) {
  const d = data as RankData | undefined;

  const latestRank = d?.ranks?.length
    ? d.ranks.reduce((a, b) => (a.date > b.date ? a : b)).rank
    : undefined;

  return (
    <div className="flex flex-col items-center py-2">
      <span className="text-3xl font-bold tabular-nums">
        {latestRank != null ? `#${latestRank.toLocaleString()}` : "Not ranked"}
      </span>
      {d?.domain && (
        <span className="text-sm text-muted mt-1">{d.domain}</span>
      )}
      {d?.message && (
        <span className="mt-2 text-center text-sm text-muted">{d.message}</span>
      )}
    </div>
  );
}
