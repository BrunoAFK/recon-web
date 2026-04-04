import { ChecklistItem, KeyValueTable } from "./primitives";
import type { RendererProps } from "./types";

interface ThreatsData {
  urlHaus?: unknown;
  phishTank?: unknown;
  cloudmersive?: unknown;
  safeBrowsing?: unknown;
}

function isSafe(result: unknown): boolean {
  if (result == null) return true;
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if (obj.threat === true || obj.isThreat === true) return false;
    if (obj.found === true || obj.match === true) return false;
    if (obj.status === "listed" || obj.status === "positive") return false;
    if (typeof obj.CleanResult === "boolean") return obj.CleanResult;
    if (Object.keys(obj).length === 0) return true;
  }
  return true;
}

const services: { key: keyof ThreatsData; label: string }[] = [
  { key: "urlHaus", label: "URLHaus" },
  { key: "phishTank", label: "PhishTank" },
  { key: "cloudmersive", label: "Cloudmersive" },
  { key: "safeBrowsing", label: "Safe Browsing" },
];

export function ThreatsRenderer({ data }: RendererProps) {
  const details = data as ThreatsData | undefined;
  if (!details) {
    return <span className="text-sm text-muted">No threat data available</span>;
  }

  const positiveFindings = services.filter((service) => !isSafe(details[service.key])).length;

  return (
    <div className="space-y-4">
      <KeyValueTable
        items={[
          {
            label: "Threats",
            value: positiveFindings === 0 ? "No detections across monitored feeds" : `${positiveFindings} service(s) flagged the target`,
          },
        ]}
      />
      <div className="space-y-1.5">
        {services.map((service) => (
          <ChecklistItem
            key={service.key}
            label={service.label}
            passed={isSafe(details[service.key])}
            detail={details[service.key] == null ? "No data" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
