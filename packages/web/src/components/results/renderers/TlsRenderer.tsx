import { ChecklistItem, KeyValueTable, SectionLabel } from "./primitives";
import type { RendererProps } from "./types";

interface TlsData {
  target?: string;
  has_tls?: boolean;
  is_valid?: boolean;
  completion_perc?: number;
  connection_info?: {
    cipher?: string;
    protocol?: string;
    cert_valid?: boolean;
  };
  analysis?: Array<Record<string, unknown>>;
}

export function TlsRenderer({ data }: RendererProps) {
  const details = data as TlsData | undefined;
  if (!details || typeof details !== "object") {
    return <span className="text-sm text-muted">No TLS data available</span>;
  }

  const summaryItems: { label: string; value: React.ReactNode }[] = [];
  if (details.target) summaryItems.push({ label: "Target", value: details.target });
  if (details.completion_perc != null) summaryItems.push({ label: "Coverage", value: `${details.completion_perc}%` });
  if (details.connection_info?.protocol) summaryItems.push({ label: "Protocol", value: details.connection_info.protocol });
  if (details.connection_info?.cipher) summaryItems.push({ label: "Cipher", value: details.connection_info.cipher });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        {details.has_tls != null && (
          <ChecklistItem label="TLS is supported" passed={details.has_tls} />
        )}
        {details.is_valid != null && (
          <ChecklistItem label="Configuration is valid" passed={details.is_valid} />
        )}
        {details.connection_info?.cert_valid != null && (
          <ChecklistItem label="Certificate is valid" passed={details.connection_info.cert_valid} />
        )}
      </div>

      {summaryItems.length > 0 && <KeyValueTable items={summaryItems} />}

      {details.analysis && details.analysis.length > 0 && (
        <div>
          <SectionLabel>Analysis Notes</SectionLabel>
          <p className="text-sm text-muted">
            {details.analysis.length} detailed observations are available in raw data.
          </p>
        </div>
      )}
    </div>
  );
}
