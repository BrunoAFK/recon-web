import { ChecklistItem } from "./primitives";
import type { RendererProps } from "./types";

interface DnssecRecord {
  isFound: boolean;
  answer?: unknown;
  response?: unknown;
}

interface DnssecData {
  DNSKEY?: DnssecRecord;
  DS?: DnssecRecord;
  RRSIG?: DnssecRecord;
}

export function DnssecRenderer({ data }: RendererProps) {
  const d = data as DnssecData | undefined;
  if (!d || typeof d !== "object") return null;

  const dnskey = d.DNSKEY;
  const ds = d.DS;
  const rrsig = d.RRSIG;

  if (dnskey || ds || rrsig) {
    const allMissing =
      !(dnskey?.isFound) && !(ds?.isFound) && !(rrsig?.isFound);

    if (allMissing) {
      return <span className="text-sm text-muted">DNSSEC not configured</span>;
    }

    return (
      <div>
        <ChecklistItem label="DNSKEY" passed={dnskey?.isFound ?? false} />
        <ChecklistItem label="DS" passed={ds?.isFound ?? false} />
        <ChecklistItem label="RRSIG" passed={rrsig?.isFound ?? false} />
      </div>
    );
  }

  return <span className="text-sm text-muted">No DNSSEC data</span>;
}
