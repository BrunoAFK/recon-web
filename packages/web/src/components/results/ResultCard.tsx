import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  AlertCircle,
  Loader2,
  Lock,
  Code2,
  Info,
  RefreshCw,
} from "lucide-react";
import type { HandlerCategory, HandlerResultData } from "@/lib/api";
import { scanHandler } from "@/lib/api";
import { DataView } from "./DataView";
import { rendererRegistry } from "./renderers";
import RawDataModal from "./RawDataModal";
import InfoModal from "./InfoModal";
import { HANDLER_INFO } from "./handler-info";
import { classifyError } from "./classify-error";

const CATEGORY_PILL: Record<HandlerCategory, { bg: string; text: string; label: string }> = {
  dns: { bg: "bg-sky-500/12", text: "text-sky-500", label: "DNS" },
  security: { bg: "bg-blue-500/12", text: "text-blue-500", label: "Security" },
  network: { bg: "bg-emerald-500/12", text: "text-emerald-500", label: "Network" },
  content: { bg: "bg-violet-500/12", text: "text-violet-500", label: "Content" },
  performance: { bg: "bg-amber-500/12", text: "text-amber-500", label: "Performance" },
  meta: { bg: "bg-slate-500/12", text: "text-slate-500", label: "Meta" },
};

function isEmptyData(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === "object") return Object.keys(data as object).length === 0;
  return false;
}

function getDataMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : undefined;
}

function getFinalUrl(data: unknown): string | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const finalUrl = (data as { finalUrl?: unknown }).finalUrl;
  return typeof finalUrl === "string" && finalUrl.trim() ? finalUrl : undefined;
}

function normalizeComparableUrl(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`);
    return parsed.toString();
  } catch {
    return null;
  }
}

function getRedirectLabel(inputUrl: string | undefined, finalUrl: string | undefined): string | null {
  if (!inputUrl || !finalUrl) return null;
  const normalizedInput = normalizeComparableUrl(inputUrl);
  const normalizedFinal = normalizeComparableUrl(finalUrl);
  if (!normalizedInput || !normalizedFinal || normalizedInput === normalizedFinal) return null;

  try {
    const finalHost = new URL(normalizedFinal).host;
    return `Redirected to ${finalHost}`;
  } catch {
    return `Redirected to ${finalUrl}`;
  }
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => key !== "message" && hasMeaningfulValue(nested),
    );
  }
  return true;
}

function hasMeaningfulPayload(data: unknown): boolean {
  if (!data || typeof data !== "object" || Array.isArray(data)) return !isEmptyData(data);
  return Object.entries(data as Record<string, unknown>).some(
    ([key, value]) => key !== "message" && hasMeaningfulValue(value),
  );
}

type CardState =
  | "loading"
  | "success"
  | "issue"
  | "unavailable"
  | "informational"
  | "skipped"
  | "empty";

interface ResultCardProps {
  name: string;
  displayName?: string;
  category: HandlerCategory;
  description: string;
  shortDescription?: string;
  result?: HandlerResultData;
  isLoading?: boolean;
  disabled?: boolean;
  animDelay?: number;
  url?: string;
  variant?: "normal" | "skipped";
}

function getCardState(
  activeResult: HandlerResultData | undefined,
  isLoading: boolean,
  refreshing: boolean,
): CardState {
  if (isLoading || refreshing) return "loading";
  if (activeResult?.skipped) return "skipped";
  if (activeResult?.error) {
    const kind = classifyError(activeResult.error, activeResult.errorCategory);
    if (kind === "tool") return "unavailable";
    if (kind === "info") return "informational";
    return "issue";
  }
  if (activeResult?.data !== undefined) {
    if (getDataMessage(activeResult.data) && !hasMeaningfulPayload(activeResult.data)) {
      return "informational";
    }
    if (isEmptyData(activeResult.data)) return "empty";
  }
  return "success";
}

function getStateLabel(state: CardState): string {
  switch (state) {
    case "loading":
      return "Running";
    case "success":
      return "Completed";
    case "issue":
      return "Issue detected";
    case "unavailable":
      return "Unavailable";
    case "informational":
      return "Informational";
    case "skipped":
      return "Skipped";
    case "empty":
      return "No data";
  }
}

function getSurfaceClasses(state: CardState): string {
  switch (state) {
    case "loading":
      return "border-border/55 bg-surface/90";
    case "success":
      return "border-border/55 bg-surface/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)]";
    case "issue":
      return "border-danger/25 bg-danger/[0.05]";
    case "unavailable":
      return "border-border/45 bg-surface/85";
    case "informational":
      return "border-border/50 bg-surface/88";
    case "skipped":
      return "border-border/40 bg-surface/78";
    case "empty":
      return "border-border/50 bg-surface/90";
  }
}

function StateIcon({ state }: { state: CardState }) {
  switch (state) {
    case "loading":
      return <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-success shrink-0" />;
    case "issue":
      return <XCircle className="h-4 w-4 text-danger shrink-0" />;
    case "unavailable":
      return <AlertCircle className="h-4 w-4 text-muted shrink-0" />;
    case "informational":
      return <Info className="h-4 w-4 text-muted shrink-0" />;
    case "skipped":
    case "empty":
      return <MinusCircle className="h-4 w-4 text-muted shrink-0" />;
  }
}

export default function ResultCard({
  name,
  displayName,
  category,
  description,
  shortDescription,
  result,
  isLoading = false,
  disabled,
  animDelay = 0,
  url,
  variant = "normal",
}: ResultCardProps) {
  const [rawOpen, setRawOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<HandlerResultData | null>(null);

  const title = displayName ?? name;
  const activeResult = refreshResult ?? result;
  const state = variant === "skipped" ? "skipped" : getCardState(activeResult, isLoading, refreshing);
  const pill = CATEGORY_PILL[category] ?? CATEGORY_PILL.meta;
  const InlineRenderer = rendererRegistry[name];
  const detailedInfo = HANDLER_INFO[name];
  const redirectLabel = getRedirectLabel(url, getFinalUrl(activeResult?.data));
  const hasStructuredData =
    activeResult?.data !== undefined &&
    !activeResult.error &&
    !activeResult.skipped &&
    !isEmptyData(activeResult.data);

  const summaryText =
    state === "loading"
      ? refreshing
        ? "Refreshing this check with live data."
        : "Waiting for this check to finish."
      : state === "skipped"
        ? activeResult?.skipped ??
          (activeResult?.error && classifyError(activeResult.error, activeResult?.errorCategory) === "tool" ? activeResult.error : undefined) ??
          "Skipped for this scan."
      : state === "issue" || state === "informational"
          ? activeResult?.error ?? getDataMessage(activeResult?.data) ?? shortDescription ?? description
          : state === "unavailable"
            ? "This check is unavailable in the current runtime or configuration."
            : state === "empty"
              ? getDataMessage(activeResult?.data) ?? "No actionable data was returned by the target."
              : getDataMessage(activeResult?.data) ?? shortDescription ?? description;

  const handleRefresh = async () => {
    if (!url || refreshing) return;
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const res = await scanHandler(name, url);
      setRefreshResult(res);
    } catch {
      // Keep the existing result if the refresh attempt fails.
    } finally {
      setRefreshing(false);
    }
  };

  if (disabled) {
    return (
      <div
        className="rounded-2xl border border-border/20 bg-surface/30 px-4 py-3 opacity-40 animate-fade-in"
        style={{ animationDelay: `${animDelay}ms` }}
      >
        <div className="flex items-center gap-3">
          <Lock className="h-3.5 w-3.5 text-muted" />
          <span className="font-semibold text-sm text-muted" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`rounded-2xl border p-5 transition-all duration-300 animate-fade-in ${getSurfaceClasses(state)}`}
        style={{ animationDelay: `${animDelay}ms` }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <StateIcon state={state} />
              <h3
                className="font-semibold text-[17px] text-foreground truncate"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {title}
              </h3>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill.bg} ${pill.text}`}>
                {pill.label}
              </span>
              <span className="text-[12px] font-medium text-muted">{getStateLabel(state)}</span>
            </div>

            <p className="mt-2 text-[15px] leading-6 text-muted">
              {summaryText}
            </p>
            {redirectLabel && (
              <p className="mt-2 text-[12px] font-medium text-muted">
                {redirectLabel}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setInfoOpen(true)}
              className="rounded-xl border border-border/50 bg-background/40 p-2 text-muted hover:text-foreground hover:border-border transition-colors"
              title="About this check"
            >
              <Info className="h-4 w-4" />
            </button>
            {url && (
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded-xl border border-border/50 bg-background/40 p-2 text-muted hover:text-foreground hover:border-border transition-colors disabled:opacity-40"
                title="Re-run this check"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            )}
            {activeResult && (
              <button
                onClick={() => setRawOpen(true)}
                className="rounded-xl border border-border/50 bg-background/40 p-2 text-muted hover:text-foreground hover:border-border transition-colors"
                title="View raw data"
              >
                <Code2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          {state === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{refreshing ? "Refreshing check..." : "Awaiting live result..."}</span>
            </div>
          ) : hasStructuredData && InlineRenderer ? (
            <InlineRenderer data={activeResult!.data} handlerName={name} />
          ) : hasStructuredData ? (
            <div className="text-sm">
              <DataView data={activeResult!.data} />
            </div>
          ) : null}
        </div>
      </div>

      {rawOpen && activeResult && (
        <RawDataModal
          title={title}
          data={activeResult}
          onClose={() => setRawOpen(false)}
        />
      )}

      {infoOpen && (
        <InfoModal
          name={title}
          description={shortDescription ?? description}
          detail={detailedInfo?.detail}
          examples={detailedInfo?.examples}
          links={detailedInfo?.links}
          onClose={() => setInfoOpen(false)}
        />
      )}
    </>
  );
}
