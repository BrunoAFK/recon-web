import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import ResultGrid from "@/components/results/ResultGrid";
import { getDemoScan, type HistoricalScan, type HandlerResultData } from "@/lib/api";
import { useHandlers } from "@/hooks/use-scan";

export default function Demo() {
  const [scan, setScan] = useState<HistoricalScan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const handlers = useHandlers();

  useEffect(() => {
    getDemoScan()
      .then((data) => {
        setScan(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted text-sm">
        Loading demo scan...
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
        <div className="rounded-full bg-surface-light p-5">
          <Eye className="h-8 w-8 text-muted" />
        </div>
        <h2
          className="text-xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          No Demo Available
        </h2>
        <p className="text-sm text-muted max-w-xs">
          No demo scan has been configured. Ask your administrator to set one up.
        </p>
      </div>
    );
  }

  // Convert results array to Record<string, any> keyed by handler
  const results: Record<string, HandlerResultData> = {};
  for (const r of scan.results) {
    results[r.handler] = r.result;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Eye className="h-5 w-5 text-accent" />
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Demo Scan
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted mt-1">
          <span className="font-mono">{scan.url}</span>
          <span className="text-border">·</span>
          <span>{new Date(scan.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <ResultGrid results={results} handlers={handlers.data ?? []} />
    </div>
  );
}
