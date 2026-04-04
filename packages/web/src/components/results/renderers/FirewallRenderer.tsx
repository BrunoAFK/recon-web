import { Chip, KeyValueRow, Verdict } from "./primitives";
import type { RendererProps } from "./types";

interface FirewallData {
  hasWaf?: boolean;
  waf?: string;
}

export function FirewallRenderer({ data }: RendererProps) {
  const d = data as FirewallData | undefined;
  const hasWaf = d?.hasWaf ?? false;

  return (
    <div className="space-y-3">
      <Verdict
        label="WAF Detected?"
        passed={hasWaf}
        description={hasWaf ? undefined : "No Web Application Firewall detected. The server may be directly exposed to attacks."}
      />
      {hasWaf && d?.waf && (
        <KeyValueRow label="Provider" value={<Chip label={d.waf} variant="accent" />} />
      )}
    </div>
  );
}
