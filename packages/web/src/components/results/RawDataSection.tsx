import { useMemo, useState } from "react";
import { Braces, Download, ExternalLink, Eye, EyeOff, Loader2 } from "lucide-react";
import { buildScanExport, downloadScanExport } from "@/lib/export-scan";
import type { HandlerMetadata, HandlerResultData } from "@/lib/api";

interface RawDataSectionProps {
  url: string;
  scanId?: string | null;
  status: string;
  durationMs?: number | null;
  createdAt?: string | null;
  startedAt?: string | null;
  handlers: HandlerMetadata[];
  results: Record<string, HandlerResultData>;
  source: "live" | "history";
}

function toBase64Utf8(input: string): string {
  return btoa(unescape(encodeURIComponent(input)));
}

export default function RawDataSection(props: RawDataSectionProps) {
  const [jsonHeroUrl, setJsonHeroUrl] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(
    () =>
      buildScanExport({
        url: props.url,
        scanId: props.scanId,
        status: props.status,
        durationMs: props.durationMs,
        createdAt: props.createdAt,
        startedAt: props.startedAt,
        handlers: props.handlers,
        results: props.results,
        source: props.source,
      }),
    [props],
  );

  const hasResults = Object.keys(props.results).length > 0;

  const handleDownload = () => {
    downloadScanExport(payload);
  };

  const handleOpenJsonHero = async () => {
    setIsOpening(true);
    setError(null);

    try {
      const response = await fetch("https://jsonhero.io/api/create.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${props.url} scan results`,
          content: payload,
          readOnly: true,
          ttl: 60 * 60 * 24,
        }),
      });

      if (!response.ok) {
        throw new Error(`JSONHero ${response.status}`);
      }

      const data = (await response.json()) as { location?: string };
      if (!data.location) {
        throw new Error("Missing JSONHero location");
      }

      setJsonHeroUrl(data.location);
    } catch {
      const inlineFallback = `https://jsonhero.io/new?j=${toBase64Utf8(JSON.stringify(payload))}`;
      setJsonHeroUrl(inlineFallback);
      setError("JSONHero API was unavailable, so a direct payload link was used instead.");
    } finally {
      setIsOpening(false);
    }
  };

  if (!hasResults) return null;

  return (
    <section className="mt-10 rounded-3xl border border-border/40 bg-surface/70 p-6 animate-fade-in">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <Braces className="h-5 w-5 text-accent" />
            <h2
              className="text-xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-display)" }}
            >
              View / Download Raw Data
            </h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Download one complete JSON snapshot of this scan, or inspect the combined results in JSONHero.
          </p>
          {error && <p className="mt-2 text-sm text-muted">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted hover:text-foreground hover:border-border transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download JSON
          </button>

          {!jsonHeroUrl ? (
            <button
              type="button"
              onClick={handleOpenJsonHero}
              disabled={isOpening}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
            >
              {isOpening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              View in JSONHero
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setJsonHeroUrl(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted hover:text-foreground hover:border-border transition-colors"
              >
                <EyeOff className="h-3.5 w-3.5" />
                Hide JSONHero
              </button>
              <a
                href={jsonHeroUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted hover:text-foreground hover:border-border transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Tab
              </a>
            </>
          )}
        </div>
      </div>

      {jsonHeroUrl && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-border/40 bg-background/40">
          <iframe
            src={jsonHeroUrl}
            title="JSONHero viewer"
            className="h-[72vh] w-full"
          />
        </div>
      )}
    </section>
  );
}
