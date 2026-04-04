import { useState } from "react";
import { Chip, CodeBlock, KeyValueTable, MiniTable, SectionLabel } from "./primitives";
import type { RendererProps } from "./types";

interface DnsData {
  A?: Array<{ address: string; family?: number }>;
  AAAA?: string[];
  MX?: Array<{ exchange: string; priority: number }>;
  TXT?: string[][];
  NS?: string[];
  CNAME?: string[];
  SOA?: {
    nsname: string;
    hostmaster: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minttl: number;
  };
  SRV?: Array<{ name: string; port: number; priority: number; weight: number }>;
  PTR?: string[];
}

export function DnsRenderer({ data }: RendererProps) {
  const dns = (data ?? {}) as DnsData;
  const [showAll, setShowAll] = useState(false);

  const summary: { label: string; value: React.ReactNode }[] = [];
  if (dns.A?.length) summary.push({ label: "IPv4", value: `${dns.A.length} record(s)` });
  if (dns.AAAA?.length) summary.push({ label: "IPv6", value: `${dns.AAAA.length} record(s)` });
  if (dns.MX?.length) summary.push({ label: "Mail", value: `${dns.MX.length} MX record(s)` });
  if (dns.NS?.length) summary.push({ label: "Nameservers", value: `${dns.NS.length} host(s)` });

  return (
    <div className="space-y-4">
      {summary.length > 0 && <KeyValueTable items={summary} />}

      {dns.A && dns.A.length > 0 && (
        <div>
          <SectionLabel>A Records</SectionLabel>
          <MiniTable
            columns={[{ key: "address", label: "Address" }]}
            rows={dns.A.map((record) => ({ address: record.address }))}
          />
        </div>
      )}

      {dns.MX && dns.MX.length > 0 && (
        <div>
          <SectionLabel>MX Records</SectionLabel>
          <MiniTable
            columns={[
              { key: "exchange", label: "Exchange" },
              { key: "priority", label: "Priority" },
            ]}
            rows={dns.MX.map((record) => ({
              exchange: record.exchange,
              priority: String(record.priority),
            }))}
          />
        </div>
      )}

      {dns.NS && dns.NS.length > 0 && (
        <div>
          <SectionLabel>Nameservers</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {dns.NS.map((server) => (
              <Chip key={server} label={server} />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowAll((value) => !value)}
        className="text-sm text-muted hover:text-foreground"
      >
        {showAll ? "Hide extended records ▲" : "Show extended records ▼"}
      </button>

      {showAll && (
        <div className="space-y-4">
          {dns.AAAA && dns.AAAA.length > 0 && (
            <div>
              <SectionLabel>AAAA Records</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {dns.AAAA.map((value) => (
                  <Chip key={value} label={value} />
                ))}
              </div>
            </div>
          )}

          {dns.TXT && dns.TXT.length > 0 && (
            <div>
              <SectionLabel>TXT Records</SectionLabel>
              <div className="space-y-2">
                {dns.TXT.map((entry, index) => (
                  <CodeBlock key={index}>{entry.join("")}</CodeBlock>
                ))}
              </div>
            </div>
          )}

          {dns.CNAME && dns.CNAME.length > 0 && (
            <div>
              <SectionLabel>CNAME Records</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {dns.CNAME.map((value) => (
                  <Chip key={value} label={value} />
                ))}
              </div>
            </div>
          )}

          {dns.SOA && (
            <div>
              <SectionLabel>SOA Record</SectionLabel>
              <KeyValueTable
                items={[
                  { label: "Primary NS", value: dns.SOA.nsname },
                  { label: "Hostmaster", value: dns.SOA.hostmaster },
                  { label: "Serial", value: String(dns.SOA.serial) },
                  { label: "Refresh", value: String(dns.SOA.refresh) },
                  { label: "Retry", value: String(dns.SOA.retry) },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
