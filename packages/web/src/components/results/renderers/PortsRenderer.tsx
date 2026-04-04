import type { RendererProps } from "./types";
import { Chip, KeyValueRow } from "./primitives";

interface PortsData {
  openPorts?: number[];
  failedPorts?: number[];
}

export function PortsRenderer({ data }: RendererProps) {
  const d = (data ?? {}) as PortsData;
  const open = d.openPorts ?? [];
  const closed = d.failedPorts ?? [];

  return (
    <div>
      <KeyValueRow
        label="Summary"
        value={`${open.length} open, ${closed.length} closed`}
      />

      {open.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {open.map((port) => (
            <Chip key={port} label={String(port)} variant="accent" />
          ))}
        </div>
      )}
    </div>
  );
}
