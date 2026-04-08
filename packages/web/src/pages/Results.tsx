import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, ExternalLink, Loader2, Globe, Eye } from "lucide-react";
import { useHandlers, useLiveScan } from "@/hooks/use-scan";
import ResultGrid from "@/components/results/ResultGrid";
import RawDataSection from "@/components/results/RawDataSection";

/** Show the "Show now" button after this many ms. */
const SHOW_NOW_DELAY = 8_000;

export default function Results() {
  const { url } = useParams<{ url: string }>();
  const decodedUrl = url ? decodeURIComponent(url) : "";
  const scan = useLiveScan(decodedUrl);
  const handlers = useHandlers();

  // Whether the user dismissed the loading screen to see partial results
  const [showPartial, setShowPartial] = useState(false);
  // Whether the "Show now" hint is visible
  const [showNowVisible, setShowNowVisible] = useState(false);

  useEffect(() => {
    if (decodedUrl) {
      document.title = `${decodedUrl} — recon-web`;
    }
    return () => {
      document.title = "recon-web";
    };
  }, [decodedUrl]);

  // Update browser URL as soon as scanId is known (without navigating away)
  // so that a refresh loads from history instead of re-triggering a scan
  useEffect(() => {
    if (scan.scanId) {
      window.history.replaceState(null, "", `/history/${scan.scanId}`);
    }
  }, [scan.scanId]);

  // Stale scan timeout — if no scanId arrives within 15s, something is wrong
  const [staleTimeout, setStaleTimeout] = useState(false);
  useEffect(() => {
    if (scan.status !== "streaming" || scan.scanId) {
      setStaleTimeout(false);
      return;
    }
    const timer = setTimeout(() => setStaleTimeout(true), 15_000);
    return () => clearTimeout(timer);
  }, [scan.status, scan.scanId]);

  // Show "Show now" button after a delay
  useEffect(() => {
    if (scan.status !== "streaming") return;
    setShowNowVisible(false);
    const timer = setTimeout(() => setShowNowVisible(true), SHOW_NOW_DELAY);
    return () => clearTimeout(timer);
  }, [scan.status]);

  const isScanning = scan.status === "streaming" || scan.status === "fallback-loading";
  const total = scan.progress.total || handlers.data?.length || 0;
  const completed = scan.progress.completed;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Rate limit (429) — show a clean, human-friendly page
  const errorMsg = scan.error instanceof Error ? scan.error.message : "";
  const isRateLimited = scan.status === "failed" && errorMsg.includes("429");

  if (isRateLimited) {
    return (
      <div className="mx-auto max-w-xl px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-foreground transition-colors mb-10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="flex flex-col items-center text-center animate-fade-in">
          <div className="rounded-full bg-red-500/10 p-5 mb-6">
            <AlertTriangle className="h-10 w-10 text-red-400" />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Daily scan limit reached
          </h1>
          <p className="text-muted text-[15px] leading-relaxed mb-2 max-w-sm">
            You've used all your scans for today.
            The limit resets at midnight UTC.
          </p>
          <p className="text-muted/50 text-xs font-mono mt-4">
            {decodedUrl} — HTTP 429
          </p>
        </div>
      </div>
    );
  }

  // If stale, treat as failed
  if (staleTimeout && !scan.scanId) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          New scan
        </Link>
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-6 animate-fade-in">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-danger mt-0.5 shrink-0" />
            <div>
              <p className="text-[16px] font-semibold text-danger mb-1" style={{ fontFamily: "var(--font-display)" }}>
                Scan failed
              </p>
              <p className="text-[14px] text-muted">
                The target URL did not respond in time. The domain may not exist, or the server is unreachable.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen scanning view (unless user clicked "Show now")
  if (isScanning && !showPartial) {
    return (
      <div className="mx-auto max-w-7xl px-6">
        {/* Cancel link — right under nav */}
        <div className="pt-6 mb-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[14px] text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Cancel
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
          <div className="flex flex-col items-center text-center max-w-lg">
            {/* Animated scanner icon */}
            <div className="relative mb-8">
              <div className="h-20 w-20 rounded-full border-2 border-accent/20 flex items-center justify-center">
                <Globe className="h-10 w-10 text-accent animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
            </div>

            {/* URL */}
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 break-all"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {decodedUrl}
            </h1>

            <p className="text-muted text-lg mb-10">
              {scan.status === "fallback-loading"
                ? "Waiting for scan to complete..."
                : scan.lastCompletedLabel
                  ? `Checking: ${scan.lastCompletedLabel}`
                  : "Starting scan..."}
            </p>

            {/* Progress bar */}
            <div className="w-full max-w-md">
              <div className="h-2 rounded-full bg-border/30 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-sm text-muted tabular-nums">
                <span>{completed} of {total} checks</span>
                <span>{pct}%</span>
              </div>
            </div>

            {/* Active handlers indicator */}
            {scan.progress.active > 0 && (
              <p className="mt-4 text-sm text-muted/60">
                {scan.progress.active} running in parallel
              </p>
            )}

            {/* Show now button — appears after delay */}
            {showNowVisible && completed > 0 && (
              <button
                type="button"
                onClick={() => setShowPartial(true)}
                className="mt-8 inline-flex items-center gap-2 rounded-xl border border-border/50 px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground hover:border-border transition-colors animate-fade-in"
              >
                <Eye className="h-4 w-4" />
                Show results now
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

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
              {isScanning && (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {completed} of {total} checks — still scanning...
                </span>
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
            isLoading={isScanning}
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
