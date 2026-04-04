import { ChecklistItem, SectionLabel } from "./primitives";
import type { RendererProps } from "./types";

interface DnsAnswer {
  name?: string;
  type?: number;
  TTL?: number;
  data?: string;
}

interface DnsResponse {
  Status?: number;
  TC?: boolean;
  RD?: boolean;
  RA?: boolean;
  AD?: boolean;
  CD?: boolean;
  Answer?: DnsAnswer[];
  [key: string]: unknown;
}

interface DnssecRecord {
  isFound: boolean;
  answer?: DnsAnswer[] | null;
  response?: DnsAnswer[] | DnsResponse;
}

interface DnssecData {
  DNSKEY?: DnssecRecord;
  DS?: DnssecRecord;
  RRSIG?: DnssecRecord;
}

function getFlags(response: unknown): { label: string; value: boolean }[] | null {
  if (!response || typeof response !== "object" || Array.isArray(response)) return null;
  const r = response as DnsResponse;
  // Only show flags if they look like a Google DNS response object (not an Answer array)
  if (r.RD === undefined && r.RA === undefined && r.AD === undefined) return null;
  return [
    { label: "Recursion Desired (RD)", value: !!r.RD },
    { label: "Recursion Available (RA)", value: !!r.RA },
    { label: "Truncation (TC)", value: !!r.TC },
    { label: "Authentic Data (AD)", value: !!r.AD },
    { label: "Checking Disabled (CD)", value: !!r.CD },
  ];
}

export function DnssecRenderer({ data }: RendererProps) {
  const d = data as DnssecData | undefined;
  if (!d || typeof d !== "object") return null;

  const records: { key: string; record: DnssecRecord | undefined }[] = [
    { key: "DNSKEY", record: d.DNSKEY },
    { key: "DS", record: d.DS },
    { key: "RRSIG", record: d.RRSIG },
  ];

  return (
    <div className="space-y-3">
      {records.map(({ key, record }) => {
        const flags = getFlags(record?.response);
        return (
          <div key={key}>
            <SectionLabel>{key}</SectionLabel>
            <ChecklistItem
              label={`${key} — Present?`}
              passed={record?.isFound ?? false}
              detail={record?.isFound ? "Yes" : "No"}
            />
            {flags && (
              <div className="ml-5 mt-1 space-y-0.5">
                {flags.map((flag) => (
                  <ChecklistItem key={flag.label} label={flag.label} passed={flag.value} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
