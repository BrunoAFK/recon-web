const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export type HandlerCategory =
  | "network"
  | "security"
  | "content"
  | "performance"
  | "dns"
  | "meta";

export interface HandlerResultData {
  data?: unknown;
  error?: string;
  errorCode?: string;
  errorCategory?: "tool" | "site" | "info";
  skipped?: string;
}

export interface ScanAllResponse {
  results: Record<string, HandlerResultData>;
  scanId: string;
}

export interface HandlerMetadata {
  name: string;
  description: string;
  displayName?: string;
  shortDescription?: string;
  category: HandlerCategory;
  requiresApiKey?: string[];
  requiresChromium?: boolean;
  lightMode?: boolean;
}

export interface ScanProgress {
  total: number;
  completed: number;
  active: number;
  failed: number;
}

interface ScanEventBase {
  scanId: string;
  url: string;
  timestamp: string;
  progress: ScanProgress;
}

export interface ScanStartedEvent extends ScanEventBase {
  type: "scan_started";
  startedAt: string;
}

export interface HandlerStartedEvent extends ScanEventBase {
  type: "handler_started";
  handler: string;
  displayName: string;
}

export interface HandlerFinishedEvent extends ScanEventBase {
  type: "handler_finished";
  handler: string;
  displayName: string;
  result: HandlerResultData;
  durationMs: number;
}

export interface ScanCompletedEvent extends ScanEventBase {
  type: "scan_completed";
  results: Record<string, HandlerResultData>;
  durationMs: number;
  completedAt: string;
}

export interface ScanFailedEvent extends ScanEventBase {
  type: "scan_failed";
  error: string;
  durationMs: number;
}

export type ScanStreamEvent =
  | ScanStartedEvent
  | HandlerStartedEvent
  | HandlerFinishedEvent
  | ScanCompletedEvent
  | ScanFailedEvent;

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = buildHeaders(init?.headers);
  // Don't send Content-Type on requests without a body (GET, DELETE)
  const method = init?.method?.toUpperCase() ?? 'GET';
  if (!init?.body && (method === 'GET' || method === 'DELETE')) {
    headers.delete("Content-Type");
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/** Run all handlers against the given URL. */
export function scanAll(url: string): Promise<ScanAllResponse> {
  return request<ScanAllResponse>(`?url=${encodeURIComponent(url)}`);
}

/** Run a single handler by name against the given URL. */
export function scanHandler(
  handlerName: string,
  url: string,
): Promise<HandlerResultData> {
  return request<HandlerResultData>(
    `/${handlerName}?url=${encodeURIComponent(url)}`,
  );
}

/** List all available scan handlers. */
export function getHandlers(): Promise<HandlerMetadata[]> {
  return request<HandlerMetadata[]>("/handlers");
}

/** Fetch a historical scan by ID. */
export interface HistoricalScanResult {
  id: string;
  scan_id: string;
  handler: string;
  result: HandlerResultData;
  duration_ms: number | null;
}

export interface HistoricalScan {
  id: string;
  url: string;
  created_at: string;
  handler_count: number;
  status: string;
  duration_ms: number | null;
  results: HistoricalScanResult[];
}

export function getHistoricalScan(scanId: string): Promise<HistoricalScan> {
  return request<HistoricalScan>(`/history/${scanId}`);
}

export interface HistoryScanListItem {
  id: string;
  url: string;
  created_at: string;
  handler_count: number;
  status: string;
  duration_ms: number | null;
  user_id?: string | null;
  result_summary?: { ok: number; issues: number; info: number; skipped: number };
}

export function getHistory(limit = 50, offset = 0, search = ''): Promise<HistoryScanListItem[]> {
  return request<HistoryScanListItem[]>(`/history?limit=${limit}&offset=${offset}${search ? `&search=${encodeURIComponent(search)}` : ''}`);
}

export function deleteHistoryScan(scanId: string): Promise<{ success: true }> {
  return request<{ success: true }>(`/history/${scanId}`, { method: "DELETE" });
}

/** Download or open a scan report. Tries PDF first, falls back to HTML in new tab. */
export async function downloadReport(scanId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/history/${scanId}/report?format=pdf`);

  if (!res.ok) {
    // Fall back to HTML in new tab
    window.open(`${BASE_URL}/history/${scanId}/report`, '_blank');
    return;
  }

  const contentType = res.headers.get('Content-Type') ?? '';

  if (contentType.includes('application/pdf')) {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? `report-${scanId.slice(0, 8)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    // Got HTML back (no Chromium on server) — open in new tab
    const html = await res.text();
    const blob = new Blob([html], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  }
}

function parseSseBlock(block: string): ScanStreamEvent | null {
  const lines = block.split("\n");
  let data = "";

  for (const line of lines) {
    if (line.startsWith("data:")) {
      data += line.slice(5).trimStart();
    }
  }

  if (!data) return null;

  return JSON.parse(data) as ScanStreamEvent;
}

export async function streamScan(
  url: string,
  opts: {
    signal?: AbortSignal;
    onEvent: (event: ScanStreamEvent) => void;
  },
): Promise<void> {
  const res = await fetch(`${BASE_URL}/stream?url=${encodeURIComponent(url)}`, {
    method: "GET",
    headers: buildHeaders({ Accept: "text/event-stream" }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  if (!res.body) {
    throw new Error("Streaming response body unavailable");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseSseBlock(block.trim());
      if (event) {
        opts.onEvent(event);
      }
    }
  }

  if (buffer.trim()) {
    const event = parseSseBlock(buffer.trim());
    if (event) {
      opts.onEvent(event);
    }
  }
}

// ── Demo ────────────────────────────────────────────────────────────
export function getDemoScan(): Promise<HistoricalScan> {
  return request<HistoricalScan>('/demo');
}
