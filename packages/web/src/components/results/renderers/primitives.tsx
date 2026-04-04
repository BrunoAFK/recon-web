import type { ReactNode } from "react";
import { Check, X } from "lucide-react";

/* ── KeyValueRow ─────────────────────────────────────────── */

export function KeyValueRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(120px,180px)_1fr] gap-4 py-2.5 items-start">
      <span className="shrink-0 text-[12px] text-muted uppercase tracking-[0.18em] font-semibold">
        {label}
      </span>
      <span className="text-[15px] leading-6 break-all text-foreground">{value}</span>
    </div>
  );
}

/* ── KeyValueTable ───────────────────────────────────────── */

export function KeyValueTable({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="divide-y divide-border/25">
      {items.map((item, i) => (
        <KeyValueRow key={i} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

/* ── MiniTable ───────────────────────────────────────────── */

export function MiniTable({
  columns,
  rows,
  maxRows = 10,
}: {
  columns: { key: string; label: string }[];
  rows: Record<string, ReactNode>[];
  maxRows?: number;
}) {
  const displayed = rows.slice(0, maxRows);
  const remaining = rows.length - maxRows;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/30">
            {columns.map((col) => (
              <th
                key={col.key}
                className="text-left text-sm text-muted uppercase tracking-wider font-medium px-2 py-1.5"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, i) => (
            <tr key={i} className="border-b border-border/10">
              {columns.map((col) => (
                <td key={col.key} className="px-2 py-1.5 break-all">
                  {row[col.key] ?? <span className="text-muted">-</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {remaining > 0 && (
        <p className="text-sm text-muted mt-1.5 px-2">
          +{remaining} more
        </p>
      )}
    </div>
  );
}

/* ── StatusDot ───────────────────────────────────────────── */

export function StatusDot({
  status,
  label,
}: {
  status: "pass" | "fail" | "unknown";
  label?: string;
}) {
  const color =
    status === "pass"
      ? "bg-success"
      : status === "fail"
        ? "bg-danger"
        : "bg-muted";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

/* ── Chip ────────────────────────────────────────────────── */

export function Chip({
  label,
  variant = "default",
}: {
  label: string;
  variant?: "default" | "success" | "danger" | "warning" | "accent";
}) {
  const styles = {
    default: "bg-surface-light text-foreground border-border/30",
    success: "bg-success/10 text-success border-success/20",
    danger: "bg-danger/10 text-danger border-danger/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    accent: "bg-accent/10 text-accent border-accent/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-medium ${styles[variant]}`}
    >
      {label}
    </span>
  );
}

/* ── ChecklistItem ───────────────────────────────────────── */

export function ChecklistItem({
  label,
  passed,
  detail,
}: {
  label: string;
  passed: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      {passed ? (
        <Check className="h-3.5 w-3.5 text-success shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 text-danger shrink-0" />
      )}
      <span className="text-sm">{label}</span>
      {detail && (
        <span className="text-sm text-muted ml-auto">{detail}</span>
      )}
    </div>
  );
}

/* ── CodeBlock ───────────────────────────────────────────── */

export function CodeBlock({ children }: { children: string }) {
  return (
    <code className="inline-block rounded bg-surface-light px-1.5 py-0.5 text-sm font-mono break-all">
      {children}
    </code>
  );
}

/* ── DotGrid ─────────────────────────────────────────────── */

export function DotGrid({
  items,
}: {
  items: { label: string; status: boolean }[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
      {items.map((item, i) => (
        <StatusDot
          key={i}
          status={item.status ? "pass" : "fail"}
          label={item.label}
        />
      ))}
    </div>
  );
}

/* ── SectionLabel ────────────────────────────────────────── */

export function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-sm text-muted uppercase tracking-wider font-medium mb-1.5 mt-3 first:mt-0">
      {children}
    </p>
  );
}
