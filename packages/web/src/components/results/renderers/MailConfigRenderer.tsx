import { Chip, CodeBlock, MiniTable, SectionLabel } from "./primitives";
import type { RendererProps } from "./types";

interface MailConfigData {
  message?: string;
  mxRecords?: Array<{ exchange: string; priority: number }>;
  txtRecords?: string[];
  mailServices?: Array<{ provider: string; value?: string }>;
}

export function MailConfigRenderer({ data }: RendererProps) {
  const d = data as MailConfigData | undefined;
  if (!d) return <span className="text-sm text-muted">No mail config data</span>;

  const relevantTxt = d.txtRecords
    ?.filter((r): r is string => typeof r === "string")
    .filter(
      (r) =>
        r.toLowerCase().includes("spf") ||
        r.toLowerCase().includes("dkim") ||
        r.toLowerCase().includes("dmarc"),
    );

  if ((!d.mxRecords || d.mxRecords.length === 0) && (!d.mailServices || d.mailServices.length === 0) && (!relevantTxt || relevantTxt.length === 0)) {
    return <span className="text-sm text-muted">{d.message ?? "No mail configuration data found."}</span>;
  }

  return (
    <div>
      {d.mxRecords && d.mxRecords.length > 0 && (
        <>
          <SectionLabel>MX Records</SectionLabel>
          <MiniTable
            columns={[
              { key: "exchange", label: "Exchange" },
              { key: "priority", label: "Priority" },
            ]}
            rows={d.mxRecords.map((r) => ({
              exchange: r.exchange,
              priority: String(r.priority),
            }))}
          />
        </>
      )}
      {d.mailServices && d.mailServices.length > 0 && (
        <>
          <SectionLabel>Mail Services</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {d.mailServices.map((s, i) => (
              <Chip key={i} label={s.provider} />
            ))}
          </div>
        </>
      )}
      {relevantTxt && relevantTxt.length > 0 && (
        <>
          <SectionLabel>SPF / DKIM / DMARC</SectionLabel>
          {relevantTxt.map((txt, i) => (
            <div key={i} className="mb-1">
              <CodeBlock>{txt}</CodeBlock>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
