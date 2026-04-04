import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Clock,
  Calendar,
  FileText,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useHistoricalScan, useHandlers } from "@/hooks/use-scan";
import ResultGrid from "@/components/results/ResultGrid";
import { downloadReport, type HandlerResultData } from "@/lib/api";
import { useEffect, useState } from "react";
import RawDataSection from "@/components/results/RawDataSection";

export default function HistoryResults() {
  const { scanId } = useParams<{ scanId: string }>();
  const scan = useHistoricalScan(scanId ?? "");
  const handlers = useHandlers();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const url = scan.data?.url ?? "";

  // Set page title
  useEffect(() => {
    if (url) {
      document.title = `${url} — recon-web`;
    }
    return () => { document.title = "recon-web"; };
  }, [url]);

  // Transform historical results into the format ResultGrid expects
  const results: Record<string, HandlerResultData> = {};
  if (scan.data?.results) {
    for (const r of scan.data.results) {
      results[r.handler] = r.result;
    }
  }

  const resultCount = Object.keys(results).length;
  const [reportLoading, setReportLoading] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <Link
          to="/history"
          className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to history
        </Link>

        {scan.data && (
          <div>
            <h1
              className="text-3xl font-bold tracking-tight mb-2"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {url}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted mb-4">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(scan.data.created_at).toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {resultCount} checks
              </span>
              {scan.data.duration_ms != null && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {(scan.data.duration_ms / 1000).toFixed(1)}s
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  if (!scanId) return;
                  setReportLoading(true);
                  try { await downloadReport(scanId); } finally { setReportLoading(false); }
                }}
                disabled={reportLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
              >
                {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                PDF Report
              </button>
              <button
                onClick={() => {
                  queryClient.removeQueries({ queryKey: ['scan', url] });
                  navigate(`/results/${encodeURIComponent(url)}`);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted hover:text-foreground hover:border-border transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Rescan
              </button>
              <a
                href={url.startsWith("http") ? url : `https://${url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-sm text-muted hover:text-foreground hover:border-border transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Visit
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Loading */}
      {scan.isLoading && (
        <div className="flex items-center justify-center py-20 text-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {/* Error */}
      {scan.isError && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 mb-8 animate-fade-in">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-danger mt-0.5 shrink-0" />
            <div>
              <p
                className="text-[16px] font-semibold text-danger mb-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Failed to load scan
              </p>
              <p className="text-[14px] text-muted">
                {scan.error instanceof Error
                  ? scan.error.message
                  : "Scan not found"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results grid */}
      {handlers.data && scan.data && (
        <>
          <ResultGrid
            results={results}
            handlers={handlers.data}
            isLoading={false}
            url={url}
            durationMs={scan.data.duration_ms}
            liveStatus="completed"
          />
          <RawDataSection
            url={url}
            scanId={scan.data.id}
            status={scan.data.status}
            durationMs={scan.data.duration_ms}
            createdAt={scan.data.created_at}
            handlers={handlers.data}
            results={results}
            source="history"
          />
        </>
      )}
    </div>
  );
}
