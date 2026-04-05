import { ChecklistItem, KeyValueTable, SectionLabel, Chip } from "./primitives";
import type { RendererProps } from "./types";

interface GradeCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: "critical" | "warning" | "info";
  detail?: string;
}

interface SslLabsDetails {
  protocolVersion?: string | null;
  cipherSuite?: string | null;
  certValid?: boolean;
  certExpiresDays?: number | null;
  certIssuer?: string | null;
  certSubject?: string | null;
  hasHsts?: boolean;
  hstsMaxAge?: number | null;
  checks?: GradeCheck[];
}

interface SslLabsData {
  host?: string;
  grade?: string | null;
  gradeTrustIgnored?: string | null;
  hasWarnings?: boolean;
  endpoints?: Array<{
    ipAddress: string;
    grade: string;
    hasWarnings: boolean;
  }>;
  testTime?: string | null;
  details?: SslLabsDetails;
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
  if (!d) return <span className="text-sm text-muted">No SSL grade data</span>;

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
            <p className="text-sm font-medium text-foreground">SSL Grade</p>
            {d.hasWarnings && (
              <p className="text-xs text-warning">Has warnings</p>
            )}
          </div>
        </div>
      )}

      {/* Detailed checks */}
      {d.details?.checks && d.details.checks.length > 0 && (
        <div className="space-y-1.5">
          {d.details.checks.map((check) => (
            <div key={check.id}>
              <ChecklistItem label={check.label} passed={check.passed} />
              {check.detail && !check.passed && (
                <p className="text-xs text-muted ml-6">{check.detail}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Connection info */}
      {d.details && (
        <div>
          <SectionLabel>Connection</SectionLabel>
          <KeyValueTable
            items={[
              ...(d.details.protocolVersion ? [{ label: "Protocol", value: d.details.protocolVersion }] : []),
              ...(d.details.cipherSuite ? [{ label: "Cipher", value: d.details.cipherSuite }] : []),
              ...(d.details.certIssuer ? [{ label: "Issuer", value: d.details.certIssuer }] : []),
              ...(d.details.certExpiresDays != null ? [{ label: "Cert expires", value: `${d.details.certExpiresDays} days` }] : []),
            ]}
          />
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
