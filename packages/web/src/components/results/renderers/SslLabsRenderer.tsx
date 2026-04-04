import { KeyValueTable, SectionLabel, Chip } from "./primitives";
import type { RendererProps } from "./types";

interface SslLabsEndpoint {
  ipAddress: string;
  grade: string;
  gradeTrustIgnored: string;
  hasWarnings: boolean;
  isExceptional: boolean;
}

interface SslLabsData {
  host?: string;
  grade?: string | null;
  gradeTrustIgnored?: string | null;
  hasWarnings?: boolean;
  endpoints?: SslLabsEndpoint[];
  testTime?: string | null;
}

function gradeColor(grade: string): "success" | "warning" | "danger" | "default" {
  if (grade.startsWith("A")) return "success";
  if (grade === "B") return "warning";
  if (grade === "C" || grade === "D" || grade === "E") return "warning";
  if (grade === "F" || grade === "T") return "danger";
  return "default";
}

export function SslLabsRenderer({ data }: RendererProps) {
  const d = data as SslLabsData | undefined;
  if (!d) return <span className="text-sm text-muted">No SSL Labs data</span>;

  const grade = d.grade;

  return (
    <div className="space-y-4">
      {/* Big grade display */}
      {grade && (
        <div className="flex items-center gap-3">
          <span
            className={`text-4xl font-black tracking-tight ${
              gradeColor(grade) === "success"
                ? "text-success"
                : gradeColor(grade) === "warning"
                  ? "text-warning"
                  : gradeColor(grade) === "danger"
                    ? "text-danger"
                    : "text-foreground"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {grade}
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">SSL Labs Grade</p>
            {d.hasWarnings && (
              <p className="text-xs text-warning">Has warnings</p>
            )}
          </div>
        </div>
      )}

      {/* Endpoint details */}
      {d.endpoints && d.endpoints.length > 0 && (
        <div>
          <SectionLabel>Endpoints</SectionLabel>
          <div className="space-y-2 mt-1">
            {d.endpoints.map((ep) => (
              <div
                key={ep.ipAddress}
                className="flex items-center justify-between gap-3 py-1.5 border-b border-border/15 last:border-0"
              >
                <span className="text-sm text-foreground font-mono break-all">{ep.ipAddress}</span>
                <Chip label={ep.grade} variant={gradeColor(ep.grade)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {d.testTime && (
        <p className="text-xs text-muted">
          Tested {new Date(d.testTime).toLocaleString()}
        </p>
      )}
    </div>
  );
}
