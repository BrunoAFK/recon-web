import { useState } from "react";
import { Chip, CodeBlock, KeyValueRow, KeyValueTable, MiniTable, SectionLabel } from "./primitives";
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

  // Primary records always visible
  const hasA = dns.A && dns.A.length > 0;
  const hasAAAA = dns.AAAA && dns.AAAA.length > 0;
  const hasMX = dns.MX && dns.MX.length > 0;
  const hasNS = dns.NS && dns.NS.length > 0;

  // Extended records behind toggle
  const hasCNAME = dns.CNAME && dns.CNAME.length > 0;
  const hasTXT = dns.TXT && dns.TXT.length > 0;
  const hasSOA = !!dns.SOA;
  const hasExtended = hasCNAME || hasTXT || hasSOA;

  return (
    <div className="space-y-4">
      {/* A record — inline if single, list if multiple */}
      {hasA && (
        dns.A!.length === 1 ? (
          <KeyValueRow label="A" value={dns.A![0].address} />
        ) : (
          <div>
            <SectionLabel>A Records</SectionLabel>
            {dns.A!.map((r) => (
              <p key={r.address} className="text-sm text-foreground ml-1 py-0.5">{r.address}</p>
            ))}
          </div>
        )
      )}

      {/* AAAA */}
      {hasAAAA && (
        <div>
          <SectionLabel>AAAA</SectionLabel>
          {dns.AAAA!.map((v) => (
            <p key={v} className="text-sm text-foreground ml-1 py-0.5 break-all">{v}</p>
          ))}
        </div>
      )}

      {/* MX */}
      {hasMX && (
        <div>
          <SectionLabel>MX Records</SectionLabel>
          <MiniTable
            columns={[
              { key: "exchange", label: "Exchange" },
              { key: "priority", label: "Priority" },
            ]}
            rows={dns.MX!.map((r) => ({
              exchange: r.exchange,
              priority: String(r.priority),
            }))}
          />
        </div>
      )}

      {/* Nameservers */}
      {hasNS && (
        <div>
          <SectionLabel>Nameservers</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {dns.NS!.map((s) => (
              <Chip key={s} label={s} />
            ))}
          </div>
        </div>
      )}

      {/* Toggle for extended records */}
      {hasExtended && (
        <>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-sm text-muted hover:text-foreground"
          >
            {showAll ? "Hide extended records \u25b2" : "Show extended records \u25bc"}
          </button>

          {showAll && (
            <div className="space-y-4">
              {hasCNAME && (
                <div>
                  <SectionLabel>CNAME</SectionLabel>
                  {dns.CNAME!.map((v) => (
                    <p key={v} className="text-sm text-foreground ml-1 py-0.5 break-all">{v}</p>
                  ))}
                </div>
              )}

              {hasTXT && (
                <div>
                  <SectionLabel>TXT Records</SectionLabel>
                  <div className="space-y-2 mt-1">
                    {dns.TXT!.map((entry, i) => (
                      <CodeBlock key={i}>{entry.join("")}</CodeBlock>
                    ))}
                  </div>
                </div>
              )}

              {hasSOA && (
                <div>
                  <SectionLabel>SOA Record</SectionLabel>
                  <KeyValueTable
                    items={[
                      { label: "Primary NS", value: dns.SOA!.nsname },
                      { label: "Hostmaster", value: dns.SOA!.hostmaster },
                      { label: "Serial", value: String(dns.SOA!.serial) },
                      { label: "Refresh", value: String(dns.SOA!.refresh) },
                      { label: "Retry", value: String(dns.SOA!.retry) },
                    ]}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
