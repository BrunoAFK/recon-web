import type { RendererProps } from "./types";
import { KeyValueRow, SectionLabel } from "./primitives";

interface LinkedPagesData {
  message?: string;
  internal?: string[];
  external?: string[];
}

export function LinkedPagesRenderer({ data }: RendererProps) {
  const d = (data ?? {}) as LinkedPagesData;
  const internal = d.internal ?? [];
  const external = d.external ?? [];

  if (internal.length === 0 && external.length === 0) {
    return <p className="text-sm text-muted">{d.message ?? "No links were detected in the returned HTML."}</p>;
  }

  return (
    <div>
      <KeyValueRow label="Internal" value={String(internal.length)} />
      <KeyValueRow label="External" value={String(external.length)} />

      {internal.length > 0 && (
        <>
          <SectionLabel>Internal</SectionLabel>
          <ul className="space-y-0.5">
            {internal.slice(0, 5).map((url, i) => (
              <li key={i} className="text-sm break-all truncate">
                {url}
              </li>
            ))}
            {internal.length > 5 && (
              <li className="text-sm text-muted">
                +{internal.length - 5} more
              </li>
            )}
          </ul>
        </>
      )}

      {external.length > 0 && (
        <>
          <SectionLabel>External</SectionLabel>
          <ul className="space-y-0.5">
            {external.slice(0, 5).map((url, i) => (
              <li key={i} className="text-sm break-all truncate">
                {url}
              </li>
            ))}
            {external.length > 5 && (
              <li className="text-sm text-muted">
                +{external.length - 5} more
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
