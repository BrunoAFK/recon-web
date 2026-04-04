export function getFinalResponseUrl(response: {
  request?: { res?: { responseUrl?: string } };
  config?: { url?: string };
}): string | undefined {
  return response.request?.res?.responseUrl ?? response.config?.url;
}
