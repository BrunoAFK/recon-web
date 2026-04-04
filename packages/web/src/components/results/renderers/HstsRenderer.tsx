import { ChecklistItem, CodeBlock, KeyValueRow, Verdict } from "./primitives";
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
      <Verdict
        label="HSTS Enabled?"
        passed={false}
        description="Site does not serve any HSTS headers. Browsers can be tricked into connecting over plain HTTP."
      />
    );
  }

  return (
    <div className="space-y-3">
      <Verdict label="HSTS Enabled?" passed={true} />
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
    </div>
  );
}
