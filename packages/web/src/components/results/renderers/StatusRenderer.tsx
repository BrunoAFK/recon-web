import { KeyValueTable, StatusDot } from "./primitives";
import type { RendererProps } from "./types";

interface StatusData {
  isUp?: boolean;
  dnsLookupTime?: number;
  responseTime?: number;
  responseCode?: number;
}

function statusColorClass(code?: number): string {
  if (!code) return "text-danger";
  if (code < 300) return "text-success";
  if (code < 400) return "text-warning";
  return "text-danger";
}

export function StatusRenderer({ data }: RendererProps) {
  const d = data as StatusData | undefined;

  return (
    <KeyValueTable
      items={[
        {
          label: "Status",
          value: (
            <StatusDot
              status={d?.isUp ? "pass" : "fail"}
              label={d?.isUp ? "Up" : "Down"}
            />
          ),
        },
        {
          label: "Status Code",
          value: (
            <span className={statusColorClass(d?.responseCode)}>
              {d?.responseCode ?? "-"}
            </span>
          ),
        },
        {
          label: "Response Time",
          value: d?.responseTime != null ? `${d.responseTime}ms` : "-",
        },
        {
          label: "DNS Lookup",
          value: d?.dnsLookupTime != null ? `${d.dnsLookupTime}ms` : "-",
        },
      ]}
    />
  );
}
