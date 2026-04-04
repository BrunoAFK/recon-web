import { MiniTable, ChecklistItem, KeyValueRow } from "./primitives";
import type { RendererProps } from "./types";

interface DnsServerEntry {
  address: string;
  hostname: string[] | null;
  dohDirectSupports: boolean;
}

interface DnsServerData {
  domain?: string;
  dns?: DnsServerEntry[];
}

export function DnsServerRenderer({ data }: RendererProps) {
  const d = data as DnsServerData | undefined;
  if (!d || typeof d !== "object") return null;

  const entries = d.dns;
  if (!Array.isArray(entries) || entries.length === 0) {
    return <p className="text-sm text-muted">No DNS server data.</p>;
  }

  return (
    <div>
      {d.domain && <KeyValueRow label="Domain" value={d.domain} />}
      <MiniTable
        columns={[
          { key: "address", label: "Address" },
          { key: "hostname", label: "Hostname" },
          { key: "doh", label: "DoH" },
        ]}
        rows={entries.map((e) => ({
          address: e.address,
          hostname: e.hostname?.join(", ") ?? "-",
          doh: (
            <ChecklistItem label="" passed={e.dohDirectSupports} />
          ),
        }))}
      />
    </div>
  );
}
