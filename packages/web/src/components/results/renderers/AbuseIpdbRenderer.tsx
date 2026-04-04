import { KeyValueTable, SectionLabel, Chip } from "./primitives";
import type { RendererProps } from "./types";

interface AbuseIpdbData {
  ipAddress?: string;
  abuseConfidenceScore?: number;
  totalReports?: number;
  lastReportedAt?: string | null;
  isp?: string | null;
  domain?: string | null;
  countryCode?: string | null;
  usageType?: string | null;
  isWhitelisted?: boolean;
}

function scoreColor(score: number): "success" | "warning" | "danger" {
  if (score === 0) return "success";
  if (score <= 25) return "warning";
  return "danger";
}

export function AbuseIpdbRenderer({ data }: RendererProps) {
  const d = data as AbuseIpdbData | undefined;
  if (!d) return <span className="text-sm text-muted">No AbuseIPDB data</span>;

  const score = d.abuseConfidenceScore ?? 0;
  const color = scoreColor(score);

  return (
    <div className="space-y-4">
      {/* Score display */}
      <div className="flex items-center gap-3">
        <span
          className={`text-3xl font-black tracking-tight ${
            color === "success" ? "text-success" : color === "warning" ? "text-warning" : "text-danger"
          }`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {score}%
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Abuse Confidence Score</p>
          <p className="text-xs text-muted">
            {score === 0 ? "No abuse reported" : `${d.totalReports ?? 0} report${(d.totalReports ?? 0) !== 1 ? "s" : ""} in last 90 days`}
          </p>
        </div>
      </div>

      {/* Details */}
      <SectionLabel>Details</SectionLabel>
      <KeyValueTable
        items={[
          { label: "IP", value: d.ipAddress ?? "-" },
          ...(d.isp ? [{ label: "ISP", value: d.isp }] : []),
          ...(d.countryCode ? [{ label: "Country", value: d.countryCode }] : []),
          ...(d.usageType ? [{ label: "Usage", value: d.usageType }] : []),
          ...(d.lastReportedAt
            ? [{ label: "Last Report", value: new Date(d.lastReportedAt).toLocaleDateString() }]
            : []),
        ]}
      />

      {d.isWhitelisted && (
        <Chip label="Whitelisted" variant="success" />
      )}
    </div>
  );
}
