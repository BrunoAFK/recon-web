export type {
  HandlerResult,
  HandlerOptions,
  AnalysisHandler,
  HandlerCategory,
  HandlerMetadata,
  HandlerRegistryEntry,
  ErrorCode,
  ErrorCategory,
} from './types.js';

export { normalizeUrl, extractHostname } from './utils/url.js';
export { assertPublicHost, isPrivateIP } from './utils/network.js';

export type { RuntimeCapability } from './types.js';

export {
  registry,
  getHandler,
  getHandlerNames,
  getHandlersByCategory,
  getHttpOnlyHandlers,
} from './registry.js';
export { handlerPresentation, getPresentationMetadata } from './presentation.js';

export { runHandlers, type RunOptions } from './runner.js';

export * from './handlers/index.js';

export { detectChanges, type Change, type Severity } from './utils/diff.js';
