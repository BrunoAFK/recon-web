import type {
  HandlerMetadata,
  HandlerResultData,
  HistoricalScan,
} from "@/lib/api";

interface ExportScanOptions {
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

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9.-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function getFilename(url: string, scanId?: string | null): string {
  const fallback = "scan";

  try {
    const parsed = new URL(url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`);
    const host = sanitizeFilenamePart(parsed.host) || fallback;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const suffix = scanId ? `-${sanitizeFilenamePart(scanId).slice(0, 8)}` : "";
    return `${host}${suffix}-${stamp}.json`;
  } catch {
    return `${fallback}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  }
}

export function buildScanExport({
  url,
  scanId,
  status,
  durationMs,
  createdAt,
  startedAt,
  handlers,
  results,
  source,
}: ExportScanOptions) {
  const orderedHandlers = handlers.map((handler) => ({
    ...handler,
    result: results[handler.name] ?? null,
  }));

  return {
    format: "recon-web-scan-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    source,
    scan: {
      id: scanId ?? null,
      url,
      status,
      createdAt: createdAt ?? null,
      startedAt: startedAt ?? null,
      durationMs: durationMs ?? null,
      handlerCount: handlers.length,
      resultCount: Object.keys(results).length,
    },
    handlers: orderedHandlers,
    results,
  };
}

export function downloadScanExport(payload: ReturnType<typeof buildScanExport>, filenameHint?: string) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filenameHint || getFilename(payload.scan.url, payload.scan.id);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

export function buildHistoricalExport(scan: HistoricalScan, handlers: HandlerMetadata[]) {
  const results = Object.fromEntries(scan.results.map((result) => [result.handler, result.result]));

  return buildScanExport({
    url: scan.url,
    scanId: scan.id,
    status: scan.status,
    durationMs: scan.duration_ms,
    createdAt: scan.created_at,
    handlers,
    results,
    source: "history",
  });
}
