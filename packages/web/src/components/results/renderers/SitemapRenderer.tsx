import { KeyValueRow } from "./primitives";
import type { RendererProps } from "./types";

interface SitemapData {
  sitemapUrl?: string;
  source?: string;
  type?: string;
  urls?: string[];
  message?: string;
  // Legacy format (xml2js raw output)
  urlset?: Record<string, unknown>;
  sitemapindex?: Record<string, unknown>;
}

/**
 * Extract URL strings from the handler result, handling both the new
 * structured format ({ urls: string[] }) and legacy xml2js raw output.
 */
function extractUrls(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const d = data as SitemapData;

  // New format: handler already extracted urls
  if (Array.isArray(d.urls)) {
    return d.urls.filter((u): u is string => typeof u === "string");
  }

  return [];
}

export function SitemapRenderer({ data }: RendererProps) {
  const d = data as SitemapData | undefined;
  const message = d?.message;
  const urls = extractUrls(data);

  if (urls.length === 0) {
    return <span className="text-sm text-muted">{message ?? "No sitemap URLs found"}</span>;
  }

  const isIndex = d?.type === "sitemapindex";

  return (
    <div>
      {d?.sitemapUrl && <KeyValueRow label="Sitemap URL" value={d.sitemapUrl} />}
      {d?.source && <KeyValueRow label="Found via" value={d.source} />}
      <KeyValueRow label={isIndex ? "Sub-sitemaps" : "Total URLs"} value={String(urls.length)} />
      <ul className="mt-1.5 space-y-0.5">
        {urls.slice(0, 8).map((url, i) => (
          <li key={i} className="text-sm text-muted truncate">{url}</li>
        ))}
        {urls.length > 8 && (
          <li className="text-sm text-muted">+{urls.length - 8} more</li>
        )}
      </ul>
    </div>
  );
}
