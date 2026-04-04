# recon-web

> **Early stage project** — under active development. APIs, configuration, and features may change without notice. Contributions and feedback are welcome.

Scan any website and get a detailed analysis of its DNS, security, performance, and tech stack — from the web UI, REST API, or command line.

---

## What does it do?

recon-web runs **33 checks** against a target URL and presents the results in a clean, categorised dashboard. Checks include:

- **Security** — SSL certificates, HSTS, security headers, firewalls, block lists, threats
- **DNS** — A/AAAA/MX/NS/TXT records, DNSSEC, DNS-over-HTTPS
- **Network** — open ports, HTTP headers, cookies, redirects, traceroute
- **Content** — robots.txt, sitemap, social/meta tags, linked pages
- **Meta** — WHOIS, domain ranking, tech stack detection, Wayback archives

Results are saved to history so you can compare scans over time.

---

## Getting started

### Option 1: Docker (recommended)

The fastest way to get running. Requires only Docker.

```bash
# Clone the repo
git clone https://github.com/user/recon-web.git
cd recon-web

# Configure (optional — works without any API keys)
cp .env.example .env

# Start
docker compose up
```

Open **http://localhost:8080** in your browser. That's it.

- Port 8080 — Web UI
- Port 3000 — REST API + Swagger docs at `/docs`

### Option 2: Run from source

Requires **Node.js 22+**.

```bash
npm install

# Terminal 1 — API server (http://localhost:3000)
npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
npm run dev:web
```

### Option 3: CLI only

```bash
npm install
npx tsc --build

# Full scan
node packages/cli/dist/index.js scan example.com

# JSON output
node packages/cli/dist/index.js scan --json example.com

# Single check
node packages/cli/dist/index.js dns example.com
node packages/cli/dist/index.js ssl github.com
```

---

## Using the web UI

1. Enter a URL on the home page and click **Scan**
2. Results stream in real-time as each check completes
3. Use **category filters** (Security, DNS, Network...) to focus on what matters
4. Use **status filters** (OK, Issues, Info, Skipped) to find problems quickly
5. Click any card's info icon for a human-readable explanation of what it checks
6. Visit **History** to browse past scans, compare two scans side-by-side, or download a PDF/HTML report

---

## Using the API

All endpoints are documented at `/docs` (Swagger UI).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/handlers` | List all available checks |
| `GET` | `/api?url=<url>` | Run all checks |
| `GET` | `/api/<handler>?url=<url>` | Run a single check |
| `GET` | `/api/stream?url=<url>` | Run all checks with SSE progress streaming |
| `GET` | `/api/history` | List past scans (`?limit=20&offset=0`) |
| `GET` | `/api/history/:id` | Get full scan results |
| `GET` | `/api/history/:id/report` | Download HTML report (`?format=pdf` for PDF) |
| `DELETE` | `/api/history/:id` | Delete a scan |

Example:
```bash
curl "http://localhost:3000/api?url=example.com"
curl "http://localhost:3000/api/dns?url=example.com"
```

---

## Using the CLI

```bash
# Full scan with coloured output
node packages/cli/dist/index.js scan example.com

# JSON output (pipe to jq, save to file, etc.)
node packages/cli/dist/index.js scan --json example.com

# JUnit XML for CI/CD pipelines
node packages/cli/dist/index.js scan --format junit example.com

# Fail if SSL is expired (CI gate)
node packages/cli/dist/index.js scan --fail-on ssl:expired example.com

# Compare with a previous scan
node packages/cli/dist/index.js scan --json example.com > baseline.json
node packages/cli/dist/index.js scan --diff baseline.json example.com

# Run only specific checks
node packages/cli/dist/index.js scan --only dns,ssl,headers example.com
```

---

## Self-hosting

### Docker Compose (local build)

Builds images from source:

```bash
cp .env.example .env    # edit as needed
docker compose up
```

Services:
- **api** (port 3000) — Fastify + Chromium + SQLite
- **web** (port 8080) — nginx serving React app + reverse proxy to API

### Docker Compose (pre-built images)

Pulls images from GitHub Container Registry — no build needed:

```bash
cp .env.example .env
export REGISTRY=ghcr.io/youruser/recon-web
export TAG=latest
docker compose -f docker-compose.remote.yml up
```

### Kubernetes (Helm)

```bash
helm install recon-web ./helm/recon-web \
  --set ingress.enabled=true \
  --set ingress.host=recon.example.com \
  --set persistence.enabled=true
```

See `helm/recon-web/values.yaml` for full configuration.

### Cloudflare Pages (light scan)

Deploys a static frontend with ~16 HTTP-only checks running on the edge. No server required.

```bash
npm run build:static
cd packages/static
npx wrangler pages deploy dist
```

To connect a full API backend, set `API_ORIGIN` during build:
```bash
API_ORIGIN=https://your-api.example.com npm run build:static
```

---

## Configuration

Copy `.env.example` to `.env`. All settings are optional — the app works out of the box.

### Authentication

Disabled by default. To enable:

```bash
AUTH_ENABLED=true
AUTH_TOKEN=your-secret-token-at-least-32-chars
```

When enabled, all `/api/*` routes require `Authorization: Bearer <token>`. The web UI shows a login page.

### Scheduled scans & notifications

```bash
SCHEDULE_ENABLED=true
SCHEDULE_CRON=0 0 * * *                       # daily at midnight
SCHEDULE_URLS=https://example.com,https://mysite.com

# Telegram alerts (optional)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=987654321

# Email alerts (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=app-password
NOTIFY_EMAIL=alerts@example.com
```

The scheduler compares each scan with the previous one and sends alerts when it detects changes (SSL expired, security headers removed, DNS changed, etc.).

### API keys (optional)

All checks work without API keys. Adding keys enables extra checks or improves accuracy:

| Variable | Used by |
|----------|---------|
| `GOOGLE_CLOUD_API_KEY` | PageSpeed Insights + Google Safe Browsing |
| `CLOUDMERSIVE_API_KEY` | Malware scanning |
| `BUILT_WITH_API_KEY` | Technology/feature detection |
| `TRANCO_API_KEY` | Domain ranking |

### All environment variables

See [`.env.example`](.env.example) for the complete list with defaults and descriptions.

---

## Development

If you want to contribute, fix bugs, or understand the codebase, see the [development guide](docs/DEVELOPMENT.md).

---

## License

GPL-2.0-only — see [LICENSE](LICENSE).
