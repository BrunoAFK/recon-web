import { useState } from "react";
import { Chip, KeyValueTable, SectionLabel } from "./primitives";
import type { RendererProps } from "./types";

interface SslData {
  subject?: { CN?: string; O?: string };
  issuer?: { O?: string; CN?: string; C?: string };
  validFrom?: string;
  validTo?: string;
  valid_from?: string;
  valid_to?: string;
  serialNumber?: string;
  fingerprint?: string;
  fingerprint256?: string;
  subjectaltname?: string;
  bits?: number;
  pubkey?: { type?: string; bits?: number };
  asn1Curve?: string;
  nistCurve?: string;
  ext_key_usage?: string[];
  [key: string]: unknown;
}

function getValidFrom(data: SslData | undefined): string | undefined {
  return data?.validFrom ?? data?.valid_from;
}

function getValidTo(data: SslData | undefined): string | undefined {
  return data?.validTo ?? data?.valid_to;
}

function formatDate(raw?: string): string {
  if (!raw) return "Not provided";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function parseSans(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim().replace(/^DNS:/, ""))
    .filter(Boolean);
}

function daysUntil(raw?: string): number | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function SslRenderer({ data }: RendererProps) {
  const details = (data ?? {}) as SslData;
  const [showMore, setShowMore] = useState(false);

  const validFrom = getValidFrom(details);
  const validTo = getValidTo(details);
  const expiresIn = daysUntil(validTo);
  const expired = expiresIn != null && expiresIn < 0;
  const sans = parseSans(details.subjectaltname);
  const keyUsage = details.ext_key_usage ?? [];

  const statusLabel = expired
    ? "Expired"
    : expiresIn != null && expiresIn <= 30
      ? `Valid, ${expiresIn} days left`
      : "Valid";

  const primaryItems: { label: string; value: React.ReactNode }[] = [
    { label: "Subject", value: details.subject?.CN ?? details.subject?.O ?? "Unavailable from target" },
    {
      label: "Issuer",
      value: [details.issuer?.O, details.issuer?.CN].filter(Boolean).join(" — ") || "Unavailable from target",
    },
    { label: "Renewed", value: formatDate(validFrom) },
    {
      label: "Expires",
      value: (
        <span className={expired ? "text-danger font-medium" : expiresIn != null && expiresIn <= 30 ? "text-warning font-medium" : ""}>
          {formatDate(validTo)}
        </span>
      ),
    },
  ];

  if (details.bits || details.pubkey?.bits) {
    primaryItems.push({ label: "Key Size", value: `${details.bits ?? details.pubkey?.bits} bit` });
  }

  if (details.asn1Curve || details.nistCurve) {
    primaryItems.push({
      label: "Curve",
      value: [details.asn1Curve, details.nistCurve].filter(Boolean).join(" / "),
    });
  }

  const secondaryItems: { label: string; value: React.ReactNode }[] = [];
  if (details.serialNumber) {
    secondaryItems.push({ label: "Serial", value: details.serialNumber });
  }
  if (details.fingerprint) {
    secondaryItems.push({ label: "Fingerprint", value: details.fingerprint });
  }
  if (details.fingerprint256) {
    secondaryItems.push({ label: "SHA-256", value: details.fingerprint256 });
  }

  return (
    <div className="space-y-4">
      <p className={`text-sm font-medium ${expired ? "text-danger" : "text-success"}`}>
        {statusLabel}
      </p>

      <KeyValueTable items={primaryItems} />

      {sans.length > 0 && (
        <div>
          <SectionLabel>Subject Alternative Names</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {sans.slice(0, showMore ? sans.length : 6).map((san) => (
              <Chip key={san} label={san} />
            ))}
            {!showMore && sans.length > 6 && (
              <button
                onClick={() => setShowMore(true)}
                className="text-sm text-accent hover:underline"
              >
                +{sans.length - 6} more
              </button>
            )}
          </div>
        </div>
      )}

      {keyUsage.length > 0 && (
        <div>
          <SectionLabel>Key Usage</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {keyUsage.map((usage) => (
              <Chip key={usage} label={usage} variant="accent" />
            ))}
          </div>
        </div>
      )}

      {secondaryItems.length > 0 && (
        <div>
          <button
            onClick={() => setShowMore((value) => !value)}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            {showMore ? "Hide details ▲" : "More details ▼"}
          </button>
          {showMore && (
            <div className="mt-3">
              <KeyValueTable items={secondaryItems} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
