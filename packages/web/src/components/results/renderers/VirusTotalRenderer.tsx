import { KeyValueTable, SectionLabel } from "./primitives";
import type { RendererProps } from "./types";

interface VtStats {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout: number;
}

interface VtData {
  url?: string;
  stats?: VtStats;
  totalEngines?: number;
  positives?: number;
  scanDate?: string | null;
  permalink?: string | null;
}

export function VirusTotalRenderer({ data }: RendererProps) {
  const d = data as VtData | undefined;
  if (!d?.stats) return <span className="text-sm text-muted">No VirusTotal data</span>;

  const { stats, totalEngines = 0, positives = 0 } = d;
  const clean = positives === 0;

  return (
    <div className="space-y-4">
      {/* Big verdict */}
      <div className="flex items-center gap-3">
        <span
          className={`text-3xl font-black tracking-tight ${clean ? "text-success" : "text-danger"}`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {positives}/{totalEngines}
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">
            {clean ? "No threats detected" : `${positives} engine${positives > 1 ? "s" : ""} flagged this URL`}
          </p>
          <p className="text-xs text-muted">
            Scanned by {totalEngines} security engines
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <SectionLabel>Breakdown</SectionLabel>
      <KeyValueTable
        items={[
          { label: "Malicious", value: String(stats.malicious) },
          { label: "Suspicious", value: String(stats.suspicious) },
          { label: "Harmless", value: String(stats.harmless) },
          { label: "Undetected", value: String(stats.undetected) },
        ]}
      />

      {d.permalink && (
        <a
          href={d.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-accent hover:underline"
        >
          View full report on VirusTotal
        </a>
      )}
    </div>
  );
}
