import { startTransition, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  scanAll,
  scanHandler,
  getHandlers,
  getHistoricalScan,
  streamScan,
  type HandlerResultData,
  type ScanProgress,
  type ScanStreamEvent,
} from "@/lib/api";

export function useScanAll(url: string) {
  return useQuery({
    queryKey: ["scan", url],
    queryFn: () => scanAll(url),
    enabled: !!url,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useScanHandler(name: string, url: string) {
  return useQuery({
    queryKey: ["scan", name, url],
    queryFn: () => scanHandler(name, url),
    enabled: !!name && !!url,
    staleTime: Infinity,
    retry: 1,
  });
}

export function useHandlers() {
  return useQuery({
    queryKey: ["handlers"],
    queryFn: getHandlers,
    staleTime: 5 * 60 * 1000,
  });
}

export function useHistoricalScan(scanId: string) {
  return useQuery({
    queryKey: ["history-scan", scanId],
    queryFn: () => getHistoricalScan(scanId),
    enabled: !!scanId,
    staleTime: Infinity,
  });
}

interface LiveScanState {
  scanId: string | null;
  results: Record<string, HandlerResultData>;
  progress: ScanProgress;
  status: "idle" | "streaming" | "fallback-loading" | "completed" | "failed";
  error: Error | null;
  lastCompletedLabel: string | null;
  durationMs: number | null;
  startedAt: string | null;
}

const EMPTY_PROGRESS: ScanProgress = {
  total: 0,
  completed: 0,
  active: 0,
  failed: 0,
};

function initialState(): LiveScanState {
  return {
    scanId: null,
    results: {},
    progress: EMPTY_PROGRESS,
    status: "idle",
    error: null,
    lastCompletedLabel: null,
    durationMs: null,
    startedAt: null,
  };
}

function applyStreamEvent(prev: LiveScanState, event: ScanStreamEvent): LiveScanState {
  switch (event.type) {
    case "scan_started":
      return {
        ...prev,
        scanId: event.scanId,
        progress: event.progress,
        status: "streaming",
        error: null,
        startedAt: event.startedAt,
      };
    case "handler_started":
      return {
        ...prev,
        scanId: event.scanId,
        progress: event.progress,
        status: "streaming",
      };
    case "handler_finished":
      return {
        ...prev,
        scanId: event.scanId,
        progress: event.progress,
        results: {
          ...prev.results,
          [event.handler]: event.result,
        },
        lastCompletedLabel: event.displayName,
      };
    case "scan_completed":
      return {
        ...prev,
        scanId: event.scanId,
        progress: event.progress,
        results: event.results,
        status: "completed",
        durationMs: event.durationMs,
      };
    case "scan_failed":
      return {
        ...prev,
        scanId: event.scanId,
        progress: event.progress,
        status: "failed",
        durationMs: event.durationMs,
        error: new Error(event.error),
      };
    default:
      return prev;
  }
}

export function useLiveScan(url: string) {
  const [state, setState] = useState<LiveScanState>(() => initialState());

  useEffect(() => {
    if (!url) {
      setState(initialState());
      return;
    }

    const abortController = new AbortController();
    let cancelled = false;

    setState({
      ...initialState(),
      status: "streaming",
    });

    const run = async () => {
      try {
        await streamScan(url, {
          signal: abortController.signal,
          onEvent: (event) => {
            startTransition(() => {
              setState((prev) => applyStreamEvent(prev, event));
            });
          },
        });
      } catch (error) {
        if (cancelled || abortController.signal.aborted) return;

        startTransition(() => {
          setState((prev) => ({
            ...prev,
            status: "fallback-loading",
            error: null,
          }));
        });

        try {
          const response = await scanAll(url);
          if (cancelled) return;

          startTransition(() => {
            const total = Object.keys(response.results).length;
            const failed = Object.values(response.results).filter((result) => result.error).length;
            setState((prev) => ({
              ...prev,
              scanId: response.scanId,
              results: response.results,
              progress: { total, completed: total, active: 0, failed },
              status: "completed",
              error: null,
            }));
          });
        } catch (fallbackError) {
          if (cancelled) return;

          startTransition(() => {
            setState((prev) => ({
              ...prev,
              status: "failed",
              error: fallbackError instanceof Error ? fallbackError : new Error("Scan failed"),
            }));
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [url]);

  return state;
}
