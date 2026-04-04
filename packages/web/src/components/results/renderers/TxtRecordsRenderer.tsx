import type { RendererProps } from "./types";
import { CodeBlock } from "./primitives";

export function TxtRecordsRenderer({ data }: RendererProps) {
  if (!data) {
    return <p className="text-sm text-muted">No TXT records found.</p>;
  }

  let records: string[] = [];

  if (Array.isArray(data)) {
    // Could be string[][] or string[] — handle both
    records = data.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (Array.isArray(item)) return item.filter((s): s is string => typeof s === "string");
      return [String(item)];
    });
  } else if (typeof data === "object") {
    // Could be { records: string[][] } or similar wrapper
    const d = data as Record<string, unknown>;
    const inner = d.records ?? d.txtRecords ?? d.txt;
    if (Array.isArray(inner)) {
      records = inner.flatMap((item: unknown) => {
        if (typeof item === "string") return [item];
        if (Array.isArray(item)) return item.filter((s): s is string => typeof s === "string");
        return [String(item)];
      });
    }
  }

  const unique = Array.from(new Set(records));

  if (unique.length === 0) {
    return <p className="text-sm text-muted">No TXT records found.</p>;
  }

  const displayed = unique.slice(0, 8);

  return (
    <div className="space-y-1">
      {displayed.map((rec, i) => (
        <div key={i}>
          <CodeBlock>{rec}</CodeBlock>
        </div>
      ))}
      {unique.length > 8 && (
        <p className="text-sm text-muted">+{unique.length - 8} more</p>
      )}
    </div>
  );
}
