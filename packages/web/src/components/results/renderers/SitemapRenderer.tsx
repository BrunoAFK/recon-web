import { KeyValueRow } from "./primitives";
import type { RendererProps } from "./types";

function extractUrls(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.filter((item): item is string => typeof item === "string");
  }
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    // Handle { urls: string[] }
    if (Array.isArray(d.urls)) return d.urls.filter((u): u is string => typeof u === "string");
    // Handle xml2js parsed sitemap: { urlset: { url: [{ loc: [string] }] } }
    const urlset = d.urlset as Record<string, unknown> | undefined;
    if (urlset && typeof urlset === "object") {
      const urlEntries = (urlset as Record<string, unknown>).url;
      if (Array.isArray(urlEntries)) {
        return urlEntries
          .map((entry: unknown) => {
            if (typeof entry === "string") return entry;
            if (entry && typeof entry === "object") {
              const loc = (entry as Record<string, unknown>).loc;
              if (Array.isArray(loc)) return String(loc[0]);
              if (typeof loc === "string") return loc;
            }
            return null;
          })
          .filter((u): u is string => u !== null);
      }
    }
    // Handle { sitemapindex: { sitemap: [{ loc: [string] }] } }
    const sitemapindex = d.sitemapindex as Record<string, unknown> | undefined;
    if (sitemapindex && typeof sitemapindex === "object") {
      const sitemaps = (sitemapindex as Record<string, unknown>).sitemap;
      if (Array.isArray(sitemaps)) {
        return sitemaps
          .map((entry: unknown) => {
            if (typeof entry === "string") return entry;
            if (entry && typeof entry === "object") {
              const loc = (entry as Record<string, unknown>).loc;
              if (Array.isArray(loc)) return String(loc[0]);
              if (typeof loc === "string") return loc;
            }
            return null;
          })
          .filter((u): u is string => u !== null);
      }
    }
  }
  return [];
}

export function SitemapRenderer({ data }: RendererProps) {
  const message =
    data && typeof data === "object" && !Array.isArray(data) && typeof (data as { message?: unknown }).message === "string"
      ? (data as { message: string }).message
      : undefined;
  const urls = extractUrls(data);

  if (urls.length === 0) {
    return <span className="text-sm text-muted">{message ?? "No sitemap URLs found"}</span>;
  }

  return (
    <div>
      <KeyValueRow label="Total URLs" value={String(urls.length)} />
      <ul className="mt-1.5 space-y-0.5">
        {urls.slice(0, 5).map((url, i) => (
          <li key={i} className="text-sm text-muted truncate">{url}</li>
        ))}
        {urls.length > 5 && (
          <li className="text-sm text-muted">+{urls.length - 5} more</li>
        )}
      </ul>
    </div>
  );
}
