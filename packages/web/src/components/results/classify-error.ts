export type ErrorType = "tool" | "site" | "info";

/**
 * Classify an error message to determine how it should be displayed.
 * - tool: internal tool/config error (missing API key, invalid URL bug, connection refused)
 * - info: normal/expected state, not a real problem (not found, no mail server)
 * - site: actual issue with the scanned site
 *
 * If errorCategory is provided by the backend, use it directly.
 */
export function classifyError(error: string, errorCategory?: ErrorType): ErrorType {
  if (errorCategory) return errorCategory;
  const lower = error.toLowerCase();

  // Tool/config errors — not the site's fault
  if (
    lower.includes("api key") ||
    lower.includes("api_key") ||
    lower.includes("invalid url") ||
    lower.includes("typeerror") ||
    lower.includes("econnrefused") ||
    lower.includes("is required for") ||
    lower.includes("provide built") ||
    lower.includes("provide google") ||
    lower.includes("provide cloud") ||
    lower.includes("provide tranco") ||
    lower.includes("chromium") ||
    lower.includes("chrome") ||
    lower.includes("puppeteer") ||
    lower.includes("url is required")
  ) {
    return "tool";
  }

  // Informational — normal state, not an error
  if (
    lower.includes("not found") ||
    lower.includes("no match") ||
    lower.includes("not serve") ||
    lower.includes("no mail server") ||
    lower.includes("no data found") ||
    lower.includes("no txt record") ||
    lower.includes("never been archived") ||
    lower.includes("no matches found")
  ) {
    return "info";
  }

  // Everything else is a real site issue
  return "site";
}
