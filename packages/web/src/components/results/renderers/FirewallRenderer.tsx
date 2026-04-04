import { Chip, KeyValueRow, StatusDot } from "./primitives";
import type { RendererProps } from "./types";

interface FirewallData {
  hasWaf?: boolean;
  waf?: string;
}

export function FirewallRenderer({ data }: RendererProps) {
  const d = data as FirewallData | undefined;

  return (
    <div>
      <KeyValueRow
        label="WAF"
        value={
          <StatusDot
            status={d?.hasWaf ? "pass" : "fail"}
            label={d?.hasWaf ? "Detected" : "None detected"}
          />
        }
      />
      {d?.hasWaf && d?.waf && (
        <KeyValueRow label="Provider" value={<Chip label={d.waf} variant="accent" />} />
      )}
    </div>
  );
}
