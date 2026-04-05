# recon-web

Scan any website and get a full picture of its security, DNS, performance, and tech stack — in seconds.

Open-source, self-hosted, no account required.

---

## Quick Start

### One-liner (CLI only)

```bash
docker run --rm ghcr.io/brunoafk/recon-web/cli scan example.com
```

No setup, no cloning — just scan.

### Docker (full UI + API)

```bash
git clone https://github.com/BrunoAFK/recon-web.git
cd recon-web
cp .env.example .env
docker compose up
```

Open **http://localhost:8080** and enter any URL. Done.

### No Docker? Run from source

Requires Node.js 24+.

```bash
git clone https://github.com/BrunoAFK/recon-web.git
cd recon-web
npm install

npm run dev        # API on http://localhost:3000
npm run dev:web    # UI on http://localhost:5173 (separate terminal)
```

---

## What You Get

Enter a URL and recon-web runs **39 checks** across 6 categories. Results stream in real-time — no waiting for everything to finish.

### Security (12 checks)

| Check | What it does |
|-------|-------------|
| **SSL Certificate** | Reads the TLS certificate: issuer, expiry date, trust chain |
| **SSL Grade** | Grades the TLS setup A+ to F (protocol, cipher, cert, HSTS) |
| **TLS Configuration** | Protocol version, cipher suite, certificate validity |
| **HSTS** | Checks Strict-Transport-Security header and preload status |
| **HTTP Security Headers** | Scores CSP, X-Frame-Options, X-Content-Type-Options, etc. |
| **Firewall** | Detects WAF providers (Cloudflare, AWS WAF, Akamai...) |
| **security.txt** | Checks for a vulnerability disclosure policy |
| **Threats** | Google Safe Browsing + malware databases |
| **Block Lists** | Checks 17 DNS block lists for reputation issues |
| **VirusTotal** | Scans against 70+ antivirus engines (needs API key) |
| **AbuseIPDB** | IP reputation and abuse history (needs API key) |
| **WordPress** | Detects WP installs, exposed files, plugin/theme versions |

### DNS (5 checks)

| Check | What it does |
|-------|-------------|
| **DNS Records** | A, AAAA, MX, NS, TXT, CNAME, SOA, SRV, PTR records |
| **DNS Provider** | Identifies nameserver provider and DoH support |
| **DNSSEC** | Validates DNSKEY, DS, and RRSIG records |
| **TXT Records** | Parses SPF, DKIM, domain verification entries |
| **Mail Config** | MX records, mail provider, SPF/DMARC analysis |

### Network (8 checks)

| Check | What it does |
|-------|-------------|
| **HTTP Status** | Status code and response time |
| **HTTP Headers** | Full response header dump |
| **Cookies** | Cookie names, flags (Secure, HttpOnly, SameSite) |
| **Redirects** | Follows the full redirect chain |
| **Open Ports** | Scans common ports (SSH, HTTP, HTTPS, MySQL, RDP...) |
| **IP Address** | Resolves the domain's IP |
| **Server Location** | GeoIP lookup — country, city, coordinates |
| **Traceroute** | Network hops from server to target |

### Content (5 checks)

| Check | What it does |
|-------|-------------|
| **robots.txt** | Parses allowed/disallowed paths and crawl directives |
| **Sitemap** | Finds and parses XML sitemaps (checks robots.txt first) |
| **Social Tags** | OpenGraph, Twitter Cards, meta description, preview image |
| **Linked Pages** | Counts and lists internal + external links |
| **SEO Audit** | Title, headings, images, canonical, structured data, score |

### Meta (7 checks)

| Check | What it does |
|-------|-------------|
| **WHOIS** | Domain registrar, creation date, expiry, nameservers |
| **Archive History** | Wayback Machine snapshots count and date range |
| **Domain Ranking** | Tranco top-1M popularity rank |
| **Legacy Ranking** | Cisco Umbrella ranking |
| **Features** | BuiltWith feature detection (needs API key) |
| **Tech Stack** | Detects frameworks, CMS, CDN, analytics from HTML |
| **Screenshot** | Visual capture of the page (needs Chromium) |

### Performance (2 checks)

| Check | What it does |
|-------|-------------|
| **Carbon Footprint** | Page weight, CO2 estimate, green hosting check |
| **PageSpeed** | Google Lighthouse scores (needs API key) |

---

## How to Use

### Web UI

1. Enter a URL and click **Scan**
2. Results appear in real-time as each check completes
3. Filter by **category** (Security, DNS, Network, Content, Meta, Performance)
4. Filter by **status** (OK, Issues, Info, Skipped) to find problems fast
5. Sort A-Z / Z-A to find specific checks
6. Click the **info icon** on any card for an explanation of what it checks
7. Click the **code icon** to see the raw JSON data

### History & Reports

- All scans are saved automatically
- Browse past scans on the **History** page
- **Compare** two scans side-by-side to see what changed
- **Download** a HTML or PDF report to share with your team

### REST API

Interactive docs at **http://localhost:3000/docs** (Swagger UI).

```bash
# Full scan
curl "http://localhost:3000/api?url=example.com"

# Single check
curl "http://localhost:3000/api/dns?url=example.com"
curl "http://localhost:3000/api/ssl?url=github.com"

# Real-time streaming (SSE)
curl "http://localhost:3000/api/stream?url=example.com"

# List all available checks
curl "http://localhost:3000/api/handlers"
```

### CLI

```bash
# Full scan with coloured output
npx recon-web scan example.com

# JSON output
npx recon-web scan --json example.com

# Single check
npx recon-web dns example.com

# JUnit XML for CI/CD
npx recon-web scan --format junit example.com

# Fail build if SSL is expired
npx recon-web scan --fail-on ssl:expired example.com

# Compare with a previous scan
npx recon-web scan --json example.com > baseline.json
npx recon-web scan --diff baseline.json example.com
```

Or via Docker:

```bash
docker run --rm ghcr.io/brunoafk/recon-web/cli scan example.com
```

---

## Configuration

Copy `.env.example` to `.env`. Everything is optional — the app works out of the box without any API keys.

### API Keys (optional)

All checks work without keys. Adding keys enables extra checks or removes rate limits:

| Variable | What it unlocks |
|----------|----------------|
| `GOOGLE_CLOUD_API_KEY` | PageSpeed Insights + Google Safe Browsing |
| `VIRUSTOTAL_API_KEY` | VirusTotal scan (free: 500 req/day) |
| `ABUSEIPDB_API_KEY` | AbuseIPDB reputation (free: 1,000 req/day) |
| `CLOUDMERSIVE_API_KEY` | Malware scanning |
| `BUILT_WITH_API_KEY` | BuiltWith feature detection |
| `TRANCO_API_KEY` | Tranco domain ranking |

### Authentication

```env
AUTH_ENABLED=true
AUTH_TOKEN=your-secret-token
```

All `/api/*` routes will require `Authorization: Bearer <token>`. The web UI shows a login page.

### Scheduled Scans & Alerts

```env
SCHEDULE_ENABLED=true
SCHEDULE_CRON=0 0 * * *
SCHEDULE_URLS=https://example.com,https://mysite.com

# Telegram (optional)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=987654321

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=app-password
NOTIFY_EMAIL=alerts@example.com
```

The scheduler runs scans on a cron schedule, compares with previous results, and sends alerts when things change (SSL expired, headers removed, DNS changed, etc.).

See [`.env.example`](.env.example) for all options with defaults.

---

## Deployment

| Method | Guide |
|--------|-------|
| Docker Compose (build from source) | [docs/deploy-docker-local.md](docs/deploy-docker-local.md) |
| Docker Compose (pre-built images) | [docs/deploy-docker-remote.md](docs/deploy-docker-remote.md) |
| Kubernetes (Helm) | [docs/deploy-kubernetes.md](docs/deploy-kubernetes.md) |
| Standalone (Node.js, no Docker) | [docs/deploy-standalone.md](docs/deploy-standalone.md) |

---

## Development

See the [development guide](docs/DEVELOPMENT.md) for architecture, running tests, and contributing.

---

## License

[GPL-2.0-only](LICENSE) — free to use, modify, and distribute.
