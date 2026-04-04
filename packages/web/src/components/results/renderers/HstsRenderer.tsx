import { ChecklistItem, CodeBlock, KeyValueRow } from "./primitives";
import type { RendererProps } from "./types";

interface HstsData {
  message?: string;
  compatible?: boolean;
  hstsHeader?: string;
}

export function HstsRenderer({ data }: RendererProps) {
  const d = data as HstsData | undefined;

  const noHsts = d?.message?.toLowerCase().includes("does not serve any hsts headers");

  if (noHsts) {
    return (
      <div>
        <span className="text-sm text-muted">No HSTS headers</span>
      </div>
    );
  }

  return (
    <div>
      <ChecklistItem
        label="Preload Compatible"
        passed={d?.compatible ?? false}
      />
      {d?.hstsHeader && (
        <KeyValueRow
          label="Header"
          value={<CodeBlock>{d.hstsHeader}</CodeBlock>}
        />
      )}
      {d?.message && (
        <KeyValueRow label="Message" value={d.message} />
      )}
    </div>
  );
}
