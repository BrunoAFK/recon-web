import { KeyValueTable } from "./primitives";
import type { RendererProps } from "./types";

const PRIORITY_KEYS = [
  "Registrar",
  "registrar",
  "Creation Date",
  "creationDate",
  "Updated Date",
  "updatedDate",
  "Registry Expiry Date",
  "registryExpiryDate",
  "Registrant Organization",
  "registrantOrganization",
  "Registrant Country",
  "registrantCountry",
  "Name Server",
  "nameServer",
  "Domain Status",
  "domainStatus",
];

export function WhoisRenderer({ data }: RendererProps) {
  const d = data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return null;

  // Collect items, matching any casing of priority keys
  const seen = new Set<string>();
  const items: { label: string; value: string }[] = [];

  for (const key of PRIORITY_KEYS) {
    if (key.startsWith("_")) continue;
    if (d[key] != null && d[key] !== "") {
      const normalizedLabel = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
      if (seen.has(normalizedLabel.toLowerCase())) continue;
      seen.add(normalizedLabel.toLowerCase());
      const val = d[key];
      items.push({
        label: normalizedLabel,
        value: typeof val === "string" ? val : String(val),
      });
    }
  }

  // If no priority keys matched, show first 6 entries
  if (items.length === 0) {
    const entries = Object.entries(d)
      .filter(([k]) => !k.startsWith("_"))
      .slice(0, 6);
    for (const [k, v] of entries) {
      if (v != null && v !== "" && typeof v !== "object") {
        items.push({ label: String(k), value: String(v) });
      }
    }
  }

  if (items.length === 0) return <p className="text-sm text-muted">No WHOIS data.</p>;

  return <KeyValueTable items={items.slice(0, 8)} />;
}
