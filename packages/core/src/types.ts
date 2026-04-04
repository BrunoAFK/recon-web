export type ErrorCode =
  | 'MISSING_API_KEY'
  | 'INVALID_URL'
  | 'TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'DNS_FAILURE'
  | 'REQUIRES_CHROMIUM'
  | 'SSRF_BLOCKED'
  | 'NOT_FOUND'
  | 'NO_DATA';

export type ErrorCategory = 'tool' | 'site' | 'info';

export interface HandlerResult<T = unknown> {
  data?: T;
  error?: string;
  errorCode?: ErrorCode;
  errorCategory?: ErrorCategory;
  skipped?: string;
}

export interface HandlerOptions {
  timeout?: number;
  apiKeys?: Record<string, string>;
  chromePath?: string;
}

export type AnalysisHandler<T = unknown> = (
  url: string,
  options?: HandlerOptions,
) => Promise<HandlerResult<T>>;

export type HandlerCategory =
  | 'network'
  | 'security'
  | 'content'
  | 'performance'
  | 'dns'
  | 'meta';

export type RuntimeCapability = 'http' | 'dns' | 'tcp' | 'tls' | 'subprocess';

export interface HandlerMetadata {
  name: string;
  description: string;
  category: HandlerCategory;
  displayName?: string;
  shortDescription?: string;
  requiresApiKey?: string[];
  requiresChromium?: boolean;
  requires?: RuntimeCapability[];
}

export interface HandlerRegistryEntry<T = unknown> {
  handler: AnalysisHandler<T>;
  metadata: HandlerMetadata;
}
