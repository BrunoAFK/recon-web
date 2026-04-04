import { KeyValueTable, SectionLabel, Chip, ChecklistItem } from "./primitives";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import type { RendererProps } from "./types";

interface SeoIssue {
  severity: "error" | "warning" | "info";
  message: string;
}

interface HeadingInfo {
  tag: string;
  count: number;
}

interface StructuredDataItem {
  type: string;
  name?: string;
}

interface SeoData {
  score?: number;
  title?: string | null;
  titleLength?: number;
  metaDescription?: string | null;
  metaDescriptionLength?: number;
  canonical?: string | null;
  canonicalIsSelf?: boolean;
  viewport?: string | null;
  language?: string | null;
  headings?: HeadingInfo[];
  h1Count?: number;
  h1Text?: string | null;
  images?: { total: number; withoutAlt: number; withAlt: number };
  wordCount?: number;
  textRatio?: number;
  structuredData?: StructuredDataItem[];
  hreflang?: string[];
  metaRobots?: string | null;
  issues?: SeoIssue[];
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
}

const SEVERITY_ICON = {
  error: <AlertTriangle className="h-3.5 w-3.5 text-danger shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />,
  info: <Info className="h-3.5 w-3.5 text-muted shrink-0 mt-0.5" />,
};

export function SeoRenderer({ data }: RendererProps) {
  const d = data as SeoData | undefined;
  if (!d) return <span className="text-sm text-muted">No SEO data</span>;

  const score = d.score ?? 0;

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="flex items-center gap-3">
        <span
          className={`text-4xl font-black tracking-tight ${scoreColor(score)}`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {score}
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">SEO Score</p>
          <p className="text-xs text-muted">
            {score >= 80 ? "Good" : score >= 50 ? "Needs improvement" : "Poor"} — {d.issues?.length ?? 0} issue{(d.issues?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Key checks */}
      <SectionLabel>Key Checks</SectionLabel>
      <div className="space-y-0.5">
        <ChecklistItem label="Title tag" passed={!!d.title} detail={d.titleLength ? `${d.titleLength} chars` : undefined} />
        <ChecklistItem label="Meta description" passed={!!d.metaDescription} detail={d.metaDescriptionLength ? `${d.metaDescriptionLength} chars` : undefined} />
        <ChecklistItem label="H1 tag" passed={d.h1Count === 1} detail={d.h1Count === 1 ? "1" : `${d.h1Count ?? 0}`} />
        <ChecklistItem label="Canonical URL" passed={!!d.canonical} />
        <ChecklistItem label="Viewport meta" passed={!!d.viewport} />
        <ChecklistItem label="Language attribute" passed={!!d.language} detail={d.language ?? undefined} />
      </div>

      {/* Content stats */}
      <SectionLabel>Content</SectionLabel>
      <KeyValueTable
        items={[
          { label: "Word Count", value: String(d.wordCount ?? 0) },
          { label: "Text Ratio", value: `${d.textRatio ?? 0}%` },
          ...(d.images ? [{ label: "Images", value: `${d.images.withAlt}/${d.images.total} with alt text` }] : []),
        ]}
      />

      {/* Headings */}
      {d.headings && d.headings.length > 0 && (
        <div>
          <SectionLabel>Headings</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.headings.map((h) => (
              <Chip key={h.tag} label={`${h.tag.toUpperCase()}: ${h.count}`} variant={h.tag === "h1" && h.count !== 1 ? "danger" : "default"} />
            ))}
          </div>
        </div>
      )}

      {/* Structured data */}
      {d.structuredData && d.structuredData.length > 0 && (
        <div>
          <SectionLabel>Structured Data</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.structuredData.map((sd, i) => (
              <Chip key={i} label={sd.type} variant="accent" />
            ))}
          </div>
        </div>
      )}

      {/* Hreflang */}
      {d.hreflang && d.hreflang.length > 0 && (
        <div>
          <SectionLabel>{`Hreflang (${d.hreflang.length})`}</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.hreflang.map((lang) => (
              <Chip key={lang} label={lang} />
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {d.issues && d.issues.length > 0 && (
        <div>
          <SectionLabel>{`Issues (${d.issues.length})`}</SectionLabel>
          <div className="space-y-2 mt-1">
            {d.issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {SEVERITY_ICON[issue.severity]}
                <span className="text-muted">{issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
