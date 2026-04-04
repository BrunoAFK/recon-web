import { ChecklistItem, CodeBlock, KeyValueTable, Verdict } from "./primitives";
import type { RendererProps } from "./types";

interface SecurityTxtData {
  isPresent?: boolean;
  foundIn?: string;
  content?: string;
  isPgpSigned?: boolean;
  fields?: Record<string, string>;
}

export function SecurityTxtRenderer({ data }: RendererProps) {
  const d = data as SecurityTxtData | undefined;
  if (!d || typeof d !== "object") return null;

  const present = d.isPresent ?? false;

  // If fields object exists, show as key-value table
  if (d.fields && typeof d.fields === "object") {
    const items = Object.entries(d.fields)
      .filter(([, v]) => v != null && v !== "")
      .slice(0, 10)
      .map(([k, v]) => ({ label: k, value: String(v) }));

    return (
      <div className="space-y-3">
        <Verdict
          label="security.txt Present?"
          passed={present}
          description={present ? undefined : "No security.txt file found. Security researchers won't know how to report vulnerabilities."}
        />
        {present && d.isPgpSigned != null && (
          <ChecklistItem label="PGP Signed" passed={d.isPgpSigned} />
        )}
        {items.length > 0 && <KeyValueTable items={items} />}
      </div>
    );
  }

  // If content is a string, show in code block
  if (typeof d.content === "string" && d.content.length > 0) {
    return (
      <div className="space-y-3">
        <Verdict label="security.txt Present?" passed={present} />
        <CodeBlock>{d.content.length > 500 ? d.content.slice(0, 500) + "..." : d.content}</CodeBlock>
      </div>
    );
  }

  // Fallback: just show verdict
  return (
    <Verdict
      label="security.txt Present?"
      passed={present}
      description={present ? undefined : "No security.txt file found at /.well-known/security.txt or /security.txt."}
    />
  );
}
