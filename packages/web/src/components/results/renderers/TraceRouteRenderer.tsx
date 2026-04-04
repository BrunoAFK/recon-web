import { useState } from "react";
import { CodeBlock, MiniTable, KeyValueRow } from "./primitives";
import type { RendererProps } from "./types";

interface TracerouteHop {
  hop: number;
  ip: string | null;
  rtt1: string | null;
  rtt2: string | null;
  rtt3: string | null;
}

interface TraceData {
  message?: string;
  result?: TracerouteHop[];
}

export function TraceRouteRenderer({ data }: RendererProps) {
  if (!data) return <span className="text-sm text-muted">No traceroute data</span>;

  if (typeof data === "string") {
    const truncated = data.length > 500 ? data.slice(0, 500) + "\n..." : data;
    return <CodeBlock>{truncated}</CodeBlock>;
  }

  const d = data as TraceData;
  const hops = d.result;

  if (!Array.isArray(hops) || hops.length === 0) {
    return (
      <div>
        {d.message && <KeyValueRow label="Message" value={d.message} />}
        <span className="text-sm text-muted">No hops recorded</span>
      </div>
    );
  }

  const [showTrace, setShowTrace] = useState(false);
  const firstHop = hops.find((h) => h.ip);
  const firstRtt = firstHop ? [firstHop.rtt1, firstHop.rtt2, firstHop.rtt3].filter(Boolean)[0] ?? "-" : "-";
  const summaryText = `Completed \u2014 first hop: ${firstHop?.ip ?? "*"} (${firstRtt})`;

  return (
    <div>
      {d.message && <KeyValueRow label="Message" value={d.message} />}
      <p className="text-sm text-foreground">{summaryText}</p>
      <button
        type="button"
        onClick={() => setShowTrace((v) => !v)}
        className="text-sm text-muted hover:text-foreground mt-1"
      >
        {showTrace ? "Hide full trace \u25b4" : "Show full trace \u25be"}
      </button>
      {showTrace && (
        <MiniTable
          columns={[
            { key: "hop", label: "#" },
            { key: "ip", label: "IP" },
            { key: "rtt", label: "RTT" },
          ]}
          rows={hops.map((h) => ({
            hop: String(h.hop),
            ip: h.ip ?? "*",
            rtt: [h.rtt1, h.rtt2, h.rtt3].filter(Boolean).join(" / ") || "-",
          }))}
          maxRows={6}
        />
      )}
    </div>
  );
}
