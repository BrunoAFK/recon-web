import { KeyValueTable, StatusDot } from "./primitives";
import type { RendererProps } from "./types";

interface CarbonData {
  message?: string;
  cleanerThan?: number;
  green?: boolean;
  statistics?: {
    co2?: {
      grid?: { grams: number };
      renewable?: { grams: number };
    };
    adjustedBytes?: number;
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CarbonRenderer({ data }: RendererProps) {
  const d = data as CarbonData | undefined;
  if (d?.message && d.statistics?.adjustedBytes === 0) {
    return <p className="text-sm text-muted">{d.message}</p>;
  }

  const items: { label: string; value: React.ReactNode }[] = [];

  if (d?.cleanerThan != null) {
    items.push({
      label: "Cleaner Than",
      value: `${Math.round(d.cleanerThan * 100)}%`,
    });
  }

  items.push({
    label: "Green Hosting",
    value: (
      <StatusDot
        status={d?.green ? "pass" : "fail"}
        label={d?.green ? "Yes" : "No"}
      />
    ),
  });

  if (d?.statistics?.co2?.grid?.grams != null) {
    items.push({
      label: "CO2 (grid)",
      value: `${d.statistics.co2.grid.grams.toFixed(4)} g`,
    });
  }

  if (d?.statistics?.co2?.renewable?.grams != null) {
    items.push({
      label: "CO2 (renewable)",
      value: `${d.statistics.co2.renewable.grams.toFixed(4)} g`,
    });
  }

  if (d?.statistics?.adjustedBytes != null) {
    items.push({
      label: "Page Size",
      value: formatBytes(d.statistics.adjustedBytes),
    });
  }

  return <KeyValueTable items={items} />;
}
