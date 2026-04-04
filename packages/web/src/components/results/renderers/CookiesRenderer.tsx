import type { RendererProps } from "./types";
import { MiniTable, StatusDot, SectionLabel, CodeBlock, KeyValueRow } from "./primitives";

interface CookiesData {
  message?: string;
  headerCookies?: string[] | null;
  clientCookies?: Array<{
    name: string;
    value?: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: string;
  }> | null;
}

export function CookiesRenderer({ data }: RendererProps) {
  const d = (data ?? {}) as CookiesData;
  const clients = d.clientCookies ?? [];
  const headers = d.headerCookies ?? [];

  if (clients.length === 0 && headers.length === 0) {
    return <p className="text-sm text-muted">{d.message ?? "No cookies found."}</p>;
  }

  return (
    <div>
      {clients.length > 0 && (
        <>
          <SectionLabel>Client Cookies</SectionLabel>
          <MiniTable
            columns={[
              { key: "name", label: "Name" },
              { key: "domain", label: "Domain" },
              { key: "secure", label: "Secure" },
              { key: "httpOnly", label: "HttpOnly" },
            ]}
            rows={clients.map((c) => ({
              name: c.name,
              domain: c.domain ?? "-",
              secure: (
                <StatusDot status={c.secure ? "pass" : "fail"} />
              ),
              httpOnly: (
                <StatusDot status={c.httpOnly ? "pass" : "fail"} />
              ),
            }))}
            maxRows={clients.length}
          />
        </>
      )}

      {clients.length === 0 && headers.length > 0 && (
        <>
          <KeyValueRow label="Count" value={String(headers.length)} />
          <SectionLabel>Raw Cookies</SectionLabel>
          <div className="space-y-1">
            {headers.map((h, i) => (
              <div key={i}>
                <CodeBlock>{h}</CodeBlock>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
