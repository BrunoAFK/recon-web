import { KeyValueTable } from "./primitives";
import type { RendererProps } from "./types";

interface ArchivesData {
  message?: string;
  firstScan?: string | Date;
  lastScan?: string | Date;
  totalScans?: number;
  changeCount?: number;
  averagePageSize?: number;
  scanUrl?: string;
  scanFrequency?: {
    daysBetweenScans?: number;
    scansPerDay?: number;
    daysBetweenChanges?: number;
    changesPerDay?: number;
  };
}

function formatDate(d: string | Date | undefined): string {
  if (!d) return "-";
  try {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

function formatBytes(bytes?: number): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function ArchivesRenderer({ data }: RendererProps) {
  const d = data as ArchivesData | undefined;
  if (!d) return <span className="text-sm text-muted">No archive data</span>;

  if (d.message && d.totalScans == null) {
    return <span className="text-sm text-muted">{d.message}</span>;
  }

  const mainItems = [
    { label: "First Archived", value: formatDate(d.firstScan) },
    { label: "Last Archived", value: formatDate(d.lastScan) },
    { label: "Total Snapshots", value: d.totalScans != null ? String(d.totalScans) : "-" },
    { label: "Avg Page Size", value: formatBytes(d.averagePageSize) },
  ];

  return (
    <div>
      <KeyValueTable items={mainItems} />
    </div>
  );
}
