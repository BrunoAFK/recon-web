import { Chip, KeyValueRow, SectionLabel, Verdict } from "./primitives";
import type { RendererProps } from "./types";
import { AlertTriangle } from "lucide-react";

interface WpPlugin {
  slug: string;
  version: string | null;
}

interface WpTheme {
  slug: string;
  version: string | null;
}

interface WpExposedFile {
  path: string;
  accessible: boolean;
}

interface WordPressData {
  isWordPress?: boolean;
  version?: string | null;
  plugins?: WpPlugin[];
  themes?: WpTheme[];
  exposedFiles?: WpExposedFile[];
  issues?: string[];
}

export function WordPressRenderer({ data }: RendererProps) {
  const d = data as WordPressData | undefined;
  if (!d) return null;

  if (!d.isWordPress) {
    return (
      <Verdict
        label="WordPress Detected?"
        passed={false}
        description="This site does not appear to run WordPress."
      />
    );
  }

  const issueCount = d.issues?.length ?? 0;

  return (
    <div className="space-y-4">
      <Verdict label="WordPress Detected?" passed={true} />

      {d.version && <KeyValueRow label="Version" value={d.version} />}

      {/* Plugins */}
      {d.plugins && d.plugins.length > 0 && (
        <div>
          <SectionLabel>{`Plugins (${d.plugins.length})`}</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.plugins.map((p) => (
              <Chip
                key={p.slug}
                label={p.version ? `${p.slug} v${p.version}` : p.slug}
                variant="default"
              />
            ))}
          </div>
        </div>
      )}

      {/* Themes */}
      {d.themes && d.themes.length > 0 && (
        <div>
          <SectionLabel>{`Themes (${d.themes.length})`}</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.themes.map((t) => (
              <Chip
                key={t.slug}
                label={t.version ? `${t.slug} v${t.version}` : t.slug}
                variant="default"
              />
            ))}
          </div>
        </div>
      )}

      {/* Exposed files */}
      {d.exposedFiles && d.exposedFiles.length > 0 && (
        <div>
          <SectionLabel>{`Exposed Files (${d.exposedFiles.length})`}</SectionLabel>
          <div className="flex flex-wrap gap-2 mt-1">
            {d.exposedFiles.map((f) => (
              <Chip key={f.path} label={f.path} variant="danger" />
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {issueCount > 0 && (
        <div>
          <SectionLabel>{`Issues (${issueCount})`}</SectionLabel>
          <div className="space-y-2 mt-1">
            {d.issues!.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span className="text-muted">{issue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
