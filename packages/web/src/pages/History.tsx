import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Trash2, ExternalLink, Loader2, AlertTriangle, GitCompareArrows, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { deleteHistoryScan, getHistory, type HistoryScanListItem } from "@/lib/api";
import Modal from "@/components/ui/Modal";

const PAGE_SIZE = 20;

export default function History() {
  const navigate = useNavigate();

  // Data
  const [scans, setScans] = useState<HistoryScanListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState("");

  // Compare selection (max 2)
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set());

  // Delete mode
  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteSelected, setDeleteSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Fetch
  const fetchScans = useCallback((p: number, q: string) => {
    setLoading(true);
    setError(null);
    getHistory(PAGE_SIZE, p * PAGE_SIZE, q)
      .then((data) => {
        setScans(data);
        setTotal(data.length < PAGE_SIZE ? p * PAGE_SIZE + data.length : (p + 2) * PAGE_SIZE);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load history");
        setLoading(false);
      });
  }, []);

  // Refetch on search/page change
  useEffect(() => {
    fetchScans(page, search);
  }, [page, search, fetchScans]);

  // Filtered scans
  // Search is server-side, scans are already filtered
  const filteredScans = scans;

  // Compare
  const toggleCompare = (id: string) => {
    setCompareSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) {
          const first = next.values().next().value!;
          next.delete(first);
        }
        next.add(id);
      }
      return next;
    });
  };

  const handleCompare = () => {
    const [id1, id2] = Array.from(compareSelected);
    navigate(`/compare/${id1}/${id2}`);
  };

  // Delete
  const toggleDeleteSelect = (id: string) => {
    setDeleteSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllForDelete = () => {
    if (deleteSelected.size === filteredScans.length) {
      setDeleteSelected(new Set());
    } else {
      setDeleteSelected(new Set(filteredScans.map((s) => s.id)));
    }
  };

  async function executeDelete(ids: string[]) {
    setDeleting(true);
    try {
      for (const id of ids) {
        await deleteHistoryScan(id);
      }
      setDeleteSelected(new Set());
      setDeleteMode(false);
      fetchScans(page, search);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function handleDeleteSelected() {
    const count = deleteSelected.size;
    if (count === 0) return;
    setConfirmDialog({
      title: "Delete scans",
      message: `Are you sure you want to delete ${count} scan${count > 1 ? "s" : ""}? This action cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog(null);
        executeDelete(Array.from(deleteSelected));
      },
    });
  }

  function handleDeleteAll() {
    setConfirmDialog({
      title: "Delete all scans",
      message: `Are you sure you want to delete all ${filteredScans.length} visible scans? This action cannot be undone.`,
      onConfirm: () => {
        setConfirmDialog(null);
        executeDelete(filteredScans.map((s) => s.id));
      },
    });
  }

  function cancelDeleteMode() {
    setDeleteMode(false);
    setDeleteSelected(new Set());
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Scan History
          </h1>
          <p className="text-sm text-muted">
            {deleteMode
              ? "Select scans to delete"
              : "Select two scans to compare"}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!deleteMode ? (
            <button
              onClick={() => setDeleteMode(true)}
              disabled={scans.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-2 text-xs font-medium text-muted hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          ) : (
            <>
              <button
                onClick={handleDeleteSelected}
                disabled={deleteSelected.size === 0 || deleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({deleteSelected.size})
              </button>
              <button
                onClick={selectAllForDelete}
                className="rounded-lg border border-border/50 px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-light/50 transition-colors"
              >
                {deleteSelected.size === filteredScans.length ? "Deselect all" : "Select all"}
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={filteredScans.length === 0 || deleting}
                className="rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                Delete all
              </button>
              <button
                onClick={cancelDeleteMode}
                className="rounded-lg border border-border/50 px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-light/50 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
        <input
          type="text"
          placeholder="Search by URL..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="w-full rounded-xl border border-border/50 bg-surface pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-colors"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Empty */}
      {!loading && scans.length === 0 && !error && (
        <div className="text-center py-20 text-muted">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No scans yet. Run a scan to see it here.</p>
        </div>
      )}

      {/* Scan list */}
      {filteredScans.length > 0 && (
        <div className="space-y-2">
          {filteredScans.map((scan) => (
            <div
              key={scan.id}
              className={`rounded-xl border p-4 transition-colors ${
                deleteMode && deleteSelected.has(scan.id)
                  ? "border-red-500/50 bg-red-500/5"
                  : compareSelected.has(scan.id)
                    ? "border-accent/50 bg-accent/5"
                    : "border-border/50 bg-surface/50 hover:border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                {deleteMode ? (
                  <button
                    onClick={() => toggleDeleteSelect(scan.id)}
                    className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
                      deleteSelected.has(scan.id)
                        ? "border-red-500 bg-red-500 text-white"
                        : "border-red-400/40 hover:border-red-400/70"
                    }`}
                  >
                    {deleteSelected.has(scan.id) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => toggleCompare(scan.id)}
                    className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-colors flex items-center justify-center ${
                      compareSelected.has(scan.id)
                        ? "border-accent bg-accent text-white"
                        : "border-border/60 hover:border-accent/50"
                    }`}
                    title="Select for comparison"
                  >
                    {compareSelected.has(scan.id) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Content */}
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

                {/* Actions (only in normal mode) */}
                {!deleteMode && (
                  <Link
                    to={`/history/${scan.id}`}
                    className="p-2 text-muted hover:text-foreground transition-colors shrink-0"
                    title="View results"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-sm text-muted">
                Page {page + 1}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                  className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-light/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={scans.length < PAGE_SIZE}
                  className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-light/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search empty state */}
      {!loading && scans.length > 0 && filteredScans.length === 0 && (
        <div className="text-center py-12 text-muted text-sm">
          No scans match "{search}"
        </div>
      )}

      {/* Sticky compare bar */}
      {!deleteMode && compareSelected.size === 2 && (
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

      {/* Confirm dialog */}
      {confirmDialog && (
        <Modal title={confirmDialog.title} onClose={() => setConfirmDialog(null)} maxWidth="max-w-sm">
          <p className="text-sm text-muted mb-6">{confirmDialog.message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDialog(null)}
              className="rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-light/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDialog.onConfirm}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
