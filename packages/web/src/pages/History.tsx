import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Trash2, ExternalLink, Loader2, AlertTriangle, GitCompareArrows } from "lucide-react";
import { deleteHistoryScan, getHistory } from "@/lib/api";

const PAGE_SIZE = 20;

export default function History() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["history"],
    queryFn: ({ pageParam = 0 }) => getHistory(PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    initialPageParam: 0,
    staleTime: 30_000,
  });

  const scans = data?.pages.flat() ?? [];

  const deleteMutation = useMutation({
    mutationFn: deleteHistoryScan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["history"] }),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) {
          // Replace oldest selection
          const first = next.values().next().value!;
          next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  };

  const canCompare = selected.size === 2;

  const handleCompare = () => {
    const [id1, id2] = Array.from(selected);
    navigate(`/compare/${id1}/${id2}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Scan History</h1>
        <p className="text-sm text-muted">
          Past scans are stored locally in SQLite. Select two scans to compare.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">
              {error instanceof Error ? error.message : "Failed to load history"}
            </p>
          </div>
        </div>
      )}

      {!isLoading && scans.length === 0 && (
        <div className="text-center py-20 text-muted">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No scans yet. Run a scan to see it here.</p>
        </div>
      )}

      {scans.length > 0 && (
        <div className="space-y-2">
          {scans.map((scan) => (
            <div
              key={scan.id}
              className={`rounded-xl border p-4 transition-colors ${
                selected.has(scan.id)
                  ? "border-accent/50 bg-accent/5"
                  : "border-border/50 bg-surface/50 hover:border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleSelect(scan.id)}
                  className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
                    selected.has(scan.id)
                      ? "border-accent bg-accent text-white"
                      : "border-border/60 hover:border-accent/50"
                  }`}
                  title="Select for comparison"
                >
                  {selected.has(scan.id) && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <Link
                    to={`/history/${scan.id}`}
                    className="text-sm font-medium text-foreground hover:text-accent transition-colors truncate block"
                  >
                    {scan.url}
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-sm text-muted">
                    <span>{new Date(scan.created_at).toLocaleString()}</span>
                    <span>{scan.handler_count} checks</span>
                    {scan.duration_ms != null && (
                      <span>{(scan.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                    <span
                      className={
                        scan.status === "completed"
                          ? "text-emerald-400"
                          : scan.status === "running"
                            ? "text-amber-400"
                            : "text-red-400"
                      }
                    >
                      {scan.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    to={`/history/${scan.id}`}
                    className="p-2 text-muted hover:text-foreground transition-colors"
                    title="View results"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => deleteMutation.mutate(scan.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete scan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex items-center gap-2 rounded-full border border-border/50 px-5 py-2.5 text-sm font-medium text-muted hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
              >
                {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sticky compare bar */}
      {canCompare && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <button
            onClick={handleCompare}
            className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition-opacity"
          >
            <GitCompareArrows className="h-4 w-4" />
            Compare 2 scans
          </button>
        </div>
      )}
    </div>
  );
}
