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

  const truncate = (url: string, max = 60) =>
    url.length > max ? url.slice(0, max) + "…" : url;

  return (
    <ol className="space-y-1.5">
      {redirects.map((url, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          <span className="shrink-0 text-muted font-medium w-5 text-right">
            {i + 1}.
          </span>
          <span className="break-all">{truncate(url)}</span>
          {i < redirects.length - 1 && (
            <span className="shrink-0 text-muted ml-auto">&rarr;</span>
          )}
        </li>
      ))}
    </ol>
  );
}
