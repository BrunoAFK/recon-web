import { Chip, CodeBlock, KeyValueRow } from "./primitives";
import type { RendererProps } from "./types";

interface IpData {
  ip?: string;
  family?: number;
}

export function GetIpRenderer({ data }: RendererProps) {
  const d = data as IpData | undefined;

  return (
    <div>
      <KeyValueRow
        label="IP Address"
        value={d?.ip ? <CodeBlock>{d.ip}</CodeBlock> : "-"}
      />
      <KeyValueRow
        label="Family"
        value={
          d?.family != null ? (
            <Chip label={d.family === 6 ? "IPv6" : "IPv4"} variant="accent" />
          ) : (
            "-"
          )
        }
      />
    </div>
  );
}
