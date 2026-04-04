import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { useHandlers, useLiveScan } from "@/hooks/use-scan";
import ResultGrid from "@/components/results/ResultGrid";
import RawDataSection from "@/components/results/RawDataSection";
export default function Results() {
  const { url } = useParams<{ url: string }>();
  const decodedUrl = url ? decodeURIComponent(url) : "";
  const scan = useLiveScan(decodedUrl);
  const handlers = useHandlers();

  useEffect(() => {
    if (decodedUrl) {
      document.title = `${decodedUrl} — recon-web`;
    }
    return () => {
      document.title = "recon-web";
    };
  }, [decodedUrl]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-8 animate-fade-in">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          New scan
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1
              className="text-3xl font-bold tracking-tight mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {decodedUrl}
            </h1>
            <div className="flex items-center gap-4 text-[14px] text-muted">
              {scan.status === "streaming" && (
                <span>
                  {scan.progress.completed} of {scan.progress.total || handlers.data?.length || 0} checks completed
                </span>
              )}
              {scan.status === "fallback-loading" && (
                <span>Waiting for the server to finish the full scan response.</span>
              )}
              {scan.status === "completed" && (
                <span>{Object.keys(scan.results).length} checks completed</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={decodedUrl.startsWith("http") ? decodedUrl : `https://${decodedUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted hover:text-foreground hover:border-border transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Visit
            </a>
          </div>
        </div>
      </div>

      {scan.status === "failed" && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 mb-8 animate-fade-in">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-danger mt-0.5 shrink-0" />
            <div className="flex-1">
              <p
                className="text-[16px] font-semibold text-danger mb-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Scan failed
              </p>
              <p className="text-[14px] text-muted">
                {scan.error instanceof Error ? scan.error.message : "An unexpected error occurred"}
              </p>
            </div>
          </div>
        </div>
      )}

      {handlers.data && (
        <>
          <ResultGrid
            results={scan.results}
            handlers={handlers.data}
            isLoading={scan.status === "streaming" || scan.status === "fallback-loading"}
            url={decodedUrl}
            progress={scan.progress}
            liveStatus={scan.status}
            lastCompletedLabel={scan.lastCompletedLabel}
            durationMs={scan.durationMs}
          />
          <RawDataSection
            url={decodedUrl}
            scanId={scan.scanId}
            status={scan.status}
            durationMs={scan.durationMs}
            startedAt={scan.startedAt}
            handlers={handlers.data}
            results={scan.results}
            source="live"
          />
        </>
      )}

      {handlers.isLoading && (
        <div className="flex items-center justify-center py-20 text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
    </div>
  );
}
