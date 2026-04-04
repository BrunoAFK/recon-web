import type { RendererProps } from "./types";
import { MiniTable, CodeBlock } from "./primitives";

export function HeadersRenderer({ data }: RendererProps) {
  const headers = (data ?? {}) as Record<string, string>;
  const entries = Object.entries(headers);

  if (entries.length === 0) {
    return <p className="text-sm text-muted">No headers found.</p>;
  }

  return (
    <MiniTable
      columns={[
        { key: "header", label: "Header" },
        { key: "value", label: "Value" },
      ]}
      rows={entries.map(([k, v]) => ({
        header: k,
        value: <CodeBlock>{String(v)}</CodeBlock>,
      }))}
      maxRows={15}
    />
  );
}
