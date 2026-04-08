// Public API for external consumers (e.g. recon-web-pro)

export { buildServer } from './server.js';
export type { BuildServerOptions } from './server.js';

export { registerRoutes } from './routes.js';

export { config, getPopulatedApiKeys, envBool, envInt } from './config.js';

export { initDb } from './db/index.js';
export type { DbMigration, Scan, ScanWithResults, ScanResult } from './db/index.js';
export {
  createScan,
  saveScanResult,
  updateScanStatus,
  getScans,
  getScan,
  deleteScan,
  getScanCount,
  getScanResultSummary,
} from './db/index.js';

export { executeScan, executeScanDeduped, getScanQueueStatus } from './scan.js';
export type {
  ScanEvent,
  ScanProgressSnapshot,
  ScanStartedEvent,
  HandlerStartedEvent,
  HandlerFinishedEvent,
  ScanCompletedEvent,
  ScanFailedEvent,
} from './scan.js';

export { schedulerPlugin } from './scheduler/index.js';
