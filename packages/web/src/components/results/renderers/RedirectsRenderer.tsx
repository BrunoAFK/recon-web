import { CornerDownRight } from "lucide-react";
import type { RendererProps } from "./types";

export function RedirectsRenderer({ data }: RendererProps) {
  let redirects: string[] = [];

  if (Array.isArray(data)) {
    redirects = data as string[];
  } else if (data && typeof data === "object" && "redirects" in data) {
    redirects = (data as { redirects?: string[] }).redirects ?? [];
  }

  if (redirects.length === 0) {
    return <p className="text-sm text-muted">No redirects detected.</p>;
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Followed {redirects.length} redirect{redirects.length > 1 ? "s" : ""} when contacting host
      </p>
      <div className="space-y-0">
        {redirects.map((url, i) => (
          <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border/15 last:border-0">
            <CornerDownRight className="h-4 w-4 text-accent shrink-0 mt-0.5" />
            <span className="text-sm text-foreground break-all">{url}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
