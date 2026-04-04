import { ChecklistItem, KeyValueTable } from "./primitives";
import type { RendererProps } from "./types";

interface HttpSecurityData {
  strictTransportPolicy?: boolean;
  xFrameOptions?: boolean;
  xContentTypeOptions?: boolean;
  xXSSProtection?: boolean;
  contentSecurityPolicy?: boolean;
}

const headers: { key: keyof HttpSecurityData; label: string; deprecated?: boolean }[] = [
  { key: "contentSecurityPolicy", label: "Content Security Policy" },
  { key: "xFrameOptions", label: "X-Frame-Options" },
  { key: "xContentTypeOptions", label: "X-Content-Type-Options" },
  { key: "strictTransportPolicy", label: "Strict-Transport-Security" },
  { key: "xXSSProtection", label: "X-XSS-Protection", deprecated: true },
];

export function HttpSecurityRenderer({ data }: RendererProps) {
  const details = data as HttpSecurityData | undefined;
  if (!details) {
    return <span className="text-sm text-muted">No security header data available</span>;
  }

  const presentCount = headers.filter((header) => details[header.key]).length;

  return (
    <div className="space-y-4">
      <KeyValueTable
        items={[
          { label: "Coverage", value: `${presentCount} of ${headers.length} headers present` },
        ]}
      />
      <div className="space-y-1.5">
        {headers.map((header) => (
          <div key={header.key} className={header.deprecated ? "opacity-60" : ""}>
            <ChecklistItem
              label={header.deprecated ? `${header.label} (legacy)` : header.label}
              passed={!!details[header.key]}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
