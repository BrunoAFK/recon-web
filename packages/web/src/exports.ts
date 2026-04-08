// Layout
export { default as Nav } from './components/layout/Nav';
export { default as Footer } from './components/layout/Footer';

// Pages
export { default as Home } from './pages/Home';
export { default as Results } from './pages/Results';
export { default as History } from './pages/History';
export { default as HistoryResults } from './pages/HistoryResults';
export { default as Compare } from './pages/Compare';
export { default as Demo } from './pages/Demo';
export { default as Settings } from './pages/Settings';
export { default as NotFound } from './pages/NotFound';

// Results components
export { default as ResultCard } from './components/results/ResultCard';
export { default as ResultGrid } from './components/results/ResultGrid';
export { rendererRegistry } from './components/results/renderers';

// Hooks
export { useScanAll, useScanHandler, useHandlers, useHistoricalScan, useLiveScan } from './hooks/use-scan';
export { ThemeProvider, useTheme } from './hooks/use-theme';
export { usePreferences } from './hooks/use-preferences';
export type { GroupBy, SortBy, StatusOrder } from './hooks/use-preferences';

// API client (scan/history functions only)
export * from './lib/api';

// UI primitives
export { default as InfoModal } from './components/results/InfoModal';
export { default as RawDataModal } from './components/results/RawDataModal';
