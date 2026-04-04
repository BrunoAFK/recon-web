# Development Guide

Everything you need to know to work on recon-web.

---

## Prerequisites

- **Node.js 22+** (LTS)
- **npm** (comes with Node)
- **Docker** (optional, for container builds)

```bash
nvm use           # reads .nvmrc
npm install       # installs all workspace packages
```

---

## Running locally

```bash
# Terminal 1 — API server on http://localhost:3000
npm run dev

# Terminal 2 — Frontend on http://localhost:5173 (proxies to API)
npm run dev:web
```

The frontend dev server proxies `/api` requests to the API server automatically.

---

## Project structure

```
recon-web/
├── packages/
│   ├── core/           # @recon-web/core — shared handler library
│   │   ├── src/
│   │   │   ├── handlers/       # 33 analysis handlers (dns.ts, ssl.ts, ports.ts, ...)
│   │   │   ├── utils/          # URL parsing, network validation, retry, diff
│   │   │   ├── registry.ts     # Handler registry with metadata
│   │   │   ├── runner.ts       # Concurrent handler execution (p-limit + SSRF guard)
│   │   │   ├── types.ts        # HandlerResult, HandlerOptions, ErrorCode, ErrorCategory
│   │   │   ├── presentation.ts # Display names and short descriptions for UI
│   │   │   └── index.ts        # Public exports
│   │   └── package.json
│   │
│   ├── api/            # @recon-web/api — Fastify REST server
│   │   ├── src/
│   │   │   ├── index.ts        # Server entry point
│   │   │   ├── server.ts       # Fastify setup (CORS, rate-limit, Swagger, auth, scheduler)
│   │   │   ├── config.ts       # Environment config + Chrome path detection
│   │   │   ├── routes.ts       # All API endpoints + URL validation hook
│   │   │   ├── scan.ts         # Scan orchestration, SSE streaming, in-flight dedup
│   │   │   ├── auth/           # Bearer token authentication plugin
│   │   │   ├── db/             # SQLite init, CRUD (scans + scan_results tables)
│   │   │   ├── scheduler/      # Cron-based scheduled scanning + change detection
│   │   │   └── report/         # HTML/PDF report generation with issue extraction
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── cli/            # @recon-web/cli — Commander CLI
│   │   ├── src/
│   │   │   ├── index.ts        # CLI entry + 33 auto-generated sub-commands
│   │   │   ├── runner.ts       # run-all, run-single orchestration
│   │   │   ├── formatter.ts    # Text, JSON, JUnit output + thresholds + diff
│   │   │   └── config.ts       # Env vars, Chrome path
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── web/            # @recon-web/web — React SPA
│   │   ├── src/
│   │   │   ├── App.tsx             # Router + auth/theme providers
│   │   │   ├── pages/              # Home, Results, History, HistoryResults, Compare, Login, Settings
│   │   │   ├── components/
│   │   │   │   ├── results/
│   │   │   │   │   ├── ResultGrid.tsx      # Main grid with category + status filters
│   │   │   │   │   ├── ResultCard.tsx       # Individual handler result card
│   │   │   │   │   ├── classify-error.ts    # Error classification (tool/site/info)
│   │   │   │   │   └── renderers/           # 36 specialised renderer components
│   │   │   │   └── layout/                  # Header, footer, theme toggle
│   │   │   ├── hooks/use-scan.ts    # useLiveScan, useHistoricalScan, useHandlers
│   │   │   ├── lib/api.ts           # API client + SSE stream parser
│   │   │   └── index.css            # Tailwind + custom styles
│   │   ├── Dockerfile               # nginx reverse proxy
│   │   └── package.json
│   │
│   └── static/         # @recon-web/static — Cloudflare Pages edge build
│       └── functions/              # CF Workers for ~16 HTTP-only handlers
│
├── helm/recon-web/     # Kubernetes Helm chart
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│
├── @internal/          # Internal docs, reference projects, assets (not published)
├── docs/               # Documentation
├── .github/workflows/  # CI/CD: test, build, docker, deploy
├── docker-compose.yml
├── docker-compose.remote.yml
├── .env.example
├── package.json        # Root workspace config
└── tsconfig.json
```

### Package dependency graph

```
@recon-web/core          ← shared library (handlers, registry, runner, types)
     ↑         ↑
@recon-web/api    @recon-web/cli
     ↑
@recon-web/web   (dev proxy only, no build dependency)
@recon-web/static (CF Pages edge deployment, uses core)
```

---

## Key concepts

### Handlers

A handler is a function that takes a URL and returns a result:

```typescript
// packages/core/src/types.ts
type AnalysisHandler<T> = (url: string, options?: HandlerOptions) => Promise<HandlerResult<T>>;

interface HandlerResult<T> {
  data?: T;            // success payload
  error?: string;      // error message
  errorCode?: ErrorCode;       // structured error code (MISSING_API_KEY, TIMEOUT, etc.)
  errorCategory?: ErrorCategory; // tool | site | info
  skipped?: string;    // skip reason
}
```

Each handler is registered in `packages/core/src/registry.ts` with metadata (name, category, description, required capabilities).

### Handler categories

| Category | Examples |
|----------|----------|
| `security` | ssl, hsts, http-security, firewall, threats, block-lists |
| `dns` | dns, dns-server, dnssec, mail-config, txt-records |
| `network` | headers, status, cookies, redirects, ports, get-ip, trace-route |
| `content` | robots-txt, sitemap, social-tags, linked-pages |
| `meta` | whois, rank, tech-stack, archives, screenshot, features |
| `performance` | quality, carbon |

### Error codes

Handlers can return structured error codes to help the frontend classify errors without string matching:

| ErrorCode | ErrorCategory | Meaning |
|-----------|--------------|---------|
| `MISSING_API_KEY` | `tool` | Handler requires an API key that isn't configured |
| `INVALID_URL` | `tool` | URL couldn't be parsed or normalised |
| `REQUIRES_CHROMIUM` | `tool` | Handler needs Chromium but it's not available |
| `TIMEOUT` | `site` | Handler timed out waiting for a response |
| `CONNECTION_REFUSED` | `site` | Target refused the connection |
| `DNS_FAILURE` | `site` | DNS resolution failed |
| `SSRF_BLOCKED` | `tool` | Target resolves to a private/internal IP |
| `NOT_FOUND` | `info` | Resource not found (normal for many sites) |
| `NO_DATA` | `info` | No data available (not an error) |

### Runner and SSRF protection

`packages/core/src/runner.ts` executes handlers with concurrency control (p-limit). Before running any handler, it:

1. Validates the URL scheme (only `http://` and `https://` allowed)
2. Resolves the hostname and blocks private/internal IPs (127.x, 10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1)

### Scan flow

```
User enters URL
  → API receives GET /api/stream?url=...
  → preHandler validates URL (returns 400 if invalid)
  → executeScan() starts
    → SSRF guard checks hostname
    → p-limit runs handlers concurrently (default: 8)
    → SSE events stream to frontend (handler_started, handler_finished, ...)
    → Results saved to SQLite
  → Frontend renders cards as they arrive
```

---

## Testing

```bash
npm test                          # all packages
npm test -w @recon-web/core       # core only (~108 tests)
npm test -w @recon-web/api        # api only
npm test -w @recon-web/cli        # cli only (~17 tests)
npm test -w @recon-web/web        # frontend component tests
```

Tests use **Vitest** with mocking (MSW for HTTP, `vi.mock` for Node modules). Frontend uses **Playwright** for E2E.

### TypeScript checking

```bash
npm run typecheck                 # all packages
npx tsc -p packages/core/tsconfig.json --noEmit  # core only
```

---

## Adding a new handler

1. Create `packages/core/src/handlers/my-handler.ts`:

```typescript
import type { AnalysisHandler } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface MyHandlerResult {
  // your result shape
}

export const myHandler: AnalysisHandler<MyHandlerResult> = async (url, options) => {
  const targetUrl = normalizeUrl(url);
  // ... your logic
  return { data: { /* result */ } };
};
```

2. Register it in `packages/core/src/handlers/index.ts` (export) and `packages/core/src/registry.ts` (metadata)

3. Add display info in `packages/core/src/presentation.ts`

4. Optionally add a custom renderer in `packages/web/src/components/results/renderers/`

5. Write tests in `packages/core/src/handlers/my-handler.test.ts`

---

## Building

```bash
npm run build                     # all packages (core → api → cli → web → static)
npm run build -w @recon-web/web   # frontend only
npm run build:static              # CF Pages build (web + static)
```

### Docker

```bash
docker build -f packages/api/Dockerfile -t recon-web-api .
docker build -f packages/web/Dockerfile -t recon-web-web .
docker build -f packages/cli/Dockerfile -t recon-web-cli .
```

Build context is always the repo root.

---

## CI/CD

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `ci.yml` | Push/PR | Lint, typecheck, test all packages |
| `docker.yml` | Push to main | Build + push Docker images to GHCR |
| `deploy-aws.yml` | Manual/tag | Deploy to AWS |
| `credits.yml` | Manual | Update credits |

---

## Database

SQLite with WAL mode. Two tables:

- **scans** — `id, url, created_at, handler_count, status, duration_ms`
- **scan_results** — `id, scan_id, handler, result (JSON), duration_ms`

Indices on `url`, `created_at DESC`, and `scan_id` for performance.

Path configurable via `DB_PATH` env var (default: `./data/recon-web.db`).
