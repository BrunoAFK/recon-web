interface HandlerDetailedInfo {
  detail: string;
  examples: string[];
  links?: { label: string; url: string }[];
}

export const HANDLER_INFO: Record<string, HandlerDetailedInfo> = {
  "abuse-ipdb": {
    detail:
      "Resolves the domain to an IP address and checks it against AbuseIPDB, a community-driven database of reported malicious IPs. Returns an abuse confidence score (0-100%), total number of reports, ISP, and usage type. Requires a free API key.",
    examples: [
      "A score above 25% indicates the IP has been repeatedly reported for spam, brute-force, or DDoS attacks.",
      "Shared hosting IPs may have high scores due to other tenants — check the usage type to distinguish.",
      "Recently reported IPs (last 90 days) are more relevant than historical data for active threat assessment.",
    ],
    links: [
      { label: "AbuseIPDB", url: "https://www.abuseipdb.com/" },
      { label: "API Docs", url: "https://docs.abuseipdb.com/" },
    ],
  },
  dns: {
    detail:
      "Resolves all DNS record types for the domain including A (IPv4), AAAA (IPv6), MX (mail), TXT (verification/SPF), NS (nameservers), CNAME (aliases), SOA (authority), SRV (services), and PTR (reverse). This reveals how the domain's infrastructure is configured.",
    examples: [
      "Misconfigured MX records can cause email delivery failures — critical for business communications.",
      "Missing AAAA records mean no IPv6 support, which can affect reachability on modern networks.",
      "TXT records reveal SPF/DKIM/DMARC email auth setup — weak configs allow email spoofing.",
    ],
  },
  "dns-server": {
    detail:
      "Identifies which DNS server is authoritative for the domain and checks if it supports DNS over HTTPS (DoH). DoH encrypts DNS queries, preventing ISPs and attackers from snooping on which sites users visit.",
    examples: [
      "If your DNS server doesn't support DoH, user queries are visible to network observers.",
      "Misconfigured authoritative DNS can cause slow resolution or complete outages worldwide.",
      "Knowing the DNS provider helps assess single points of failure in your infrastructure.",
    ],
  },
  dnssec: {
    detail:
      "Checks DNSSEC (DNS Security Extensions) configuration by verifying DNSKEY, DS, and RRSIG records. DNSSEC cryptographically signs DNS responses, preventing attackers from redirecting users to malicious servers via DNS cache poisoning.",
    examples: [
      "Without DNSSEC, attackers can intercept DNS responses and redirect users to phishing sites.",
      "Banks and government sites are increasingly required to have DNSSEC enabled.",
      "A broken DNSSEC chain (misconfigured DS records) can make your site completely unreachable.",
    ],
  },
  "txt-records": {
    detail:
      "Retrieves and parses all TXT records for the domain. These often contain SPF policies, DKIM selectors, DMARC policies, domain verification tokens (Google, Microsoft), and other metadata.",
    examples: [
      "SPF records without '-all' allow anyone to send email pretending to be your domain.",
      "Verification tokens (google-site-verification, etc.) reveal which services the domain uses.",
      "Overly permissive SPF 'include' chains can expose you to relay attacks.",
    ],
  },
  "mail-config": {
    detail:
      "Analyzes MX records to determine the email provider configuration. Identifies whether the domain uses a hosted email service (Google Workspace, Microsoft 365, etc.) or self-hosted mail servers.",
    examples: [
      "Domains without MX records can't receive email — this may be intentional or a misconfiguration.",
      "Backup MX records ensure email delivery even if the primary mail server goes down.",
      "Knowing the mail provider helps identify phishing — a bank using a free email provider is suspicious.",
    ],
  },
  ssl: {
    detail:
      "Fetches and analyzes the SSL/TLS certificate including issuer, validity dates, subject alternative names (SANs), key algorithm, and chain of trust. An expired or misconfigured certificate causes browser security warnings and blocks users.",
    examples: [
      "Expired certificates immediately trigger browser warnings, causing users to leave your site.",
      "Certificates not covering all subdomains (missing SANs) break HTTPS on those subdomains.",
      "Free Let's Encrypt certs expire every 90 days — monitoring prevents surprise outages.",
    ],
    links: [
      { label: "TLS — Wikipedia", url: "https://en.wikipedia.org/wiki/Transport_Layer_Security" },
      { label: "What is SSL — Cloudflare", url: "https://www.cloudflare.com/learning/ssl/what-is-ssl/" },
      { label: "RFC 8446 — TLS 1.3", url: "https://datatracker.ietf.org/doc/html/rfc8446" },
    ],
  },
  tls: {
    detail:
      "Analyzes TLS protocol configuration via Mozilla Observatory. Checks supported TLS versions, cipher suites, and configuration quality. Weak TLS allows attackers to intercept encrypted traffic.",
    examples: [
      "TLS 1.0/1.1 have known vulnerabilities — PCI DSS compliance requires TLS 1.2+.",
      "Weak cipher suites (RC4, DES) allow attackers to decrypt captured traffic.",
      "Perfect Forward Secrecy (PFS) ensures past sessions can't be decrypted even if the private key leaks.",
    ],
  },
  hsts: {
    detail:
      "Checks the Strict-Transport-Security header and HSTS preload status. HSTS forces browsers to always use HTTPS, preventing SSL stripping attacks where an attacker downgrades connections to plain HTTP.",
    examples: [
      "Without HSTS, users typing 'example.com' briefly connect over HTTP — an attacker on the same Wi-Fi can intercept this.",
      "HSTS preloading hardcodes HTTPS into browsers — even the first visit is protected.",
      "A short max-age (< 1 year) weakens HSTS protection significantly.",
    ],
  },
  "http-security": {
    detail:
      "Scores five critical HTTP security headers: Content-Security-Policy (CSP), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy. These headers defend against XSS, clickjacking, MIME sniffing, and data leaks.",
    examples: [
      "Missing CSP allows injected scripts to run freely — the #1 defense against XSS attacks.",
      "Without X-Frame-Options, your site can be embedded in a malicious iframe for clickjacking attacks.",
      "Referrer-Policy leaking full URLs can expose session tokens and private page paths to third parties.",
    ],
  },
  firewall: {
    detail:
      "Detects Web Application Firewalls (WAFs) by analyzing HTTP response headers, cookies, and server signatures. WAFs filter malicious traffic and protect against common web attacks like SQL injection and XSS.",
    examples: [
      "Knowing the WAF type helps security researchers avoid false positives during pentesting.",
      "No WAF detected means the application relies entirely on code-level security — higher risk.",
      "WAF bypass techniques differ by vendor — identification is the first step in security assessment.",
    ],
  },
  "security-txt": {
    detail:
      "Fetches and parses the /.well-known/security.txt file, which is a standard (RFC 9116) for websites to communicate security vulnerability disclosure policies to researchers.",
    examples: [
      "Without security.txt, researchers who find vulnerabilities have no clear way to report them responsibly.",
      "An expired security.txt suggests the security program is abandoned or unmaintained.",
      "Including a PGP key allows encrypted communication of sensitive vulnerability details.",
    ],
  },
  threats: {
    detail:
      "Cross-references the URL against four threat intelligence databases: Google Safe Browsing, URLHaus (malware URLs), PhishTank (phishing), and Cloudmersive (virus scanning). Identifies whether the site is flagged as malicious.",
    examples: [
      "A site flagged by Google Safe Browsing will show warnings in Chrome, Firefox, and Safari — devastating for traffic.",
      "URLHaus listings indicate the domain was used to distribute malware, even if it's been cleaned.",
      "Regularly checking your own domains catches compromises (e.g., injected malware) before users are affected.",
    ],
  },
  "block-lists": {
    detail:
      "Checks whether the domain appears on 17 major DNS-based block lists (DNSBL) including AdGuard, CleanBrowsing, CloudFlare, OpenDNS, Norton, Quad9, and Yandex. Being on a block list means users on those DNS providers can't access your site.",
    examples: [
      "A domain on Norton or OpenDNS block lists is unreachable for millions of users with those DNS settings.",
      "Corporate networks using DNS filtering (CloudFlare for Families, etc.) will block listed domains.",
      "False positive listings happen — monitoring helps you file removal requests quickly.",
    ],
  },
  headers: {
    detail:
      "Fetches all HTTP response headers from the target URL. Headers reveal server software, caching configuration, content encoding, and custom application headers — valuable for understanding the server setup.",
    examples: [
      "Server headers revealing 'Apache/2.4.41' tell attackers exactly which version to target.",
      "Missing cache headers (Cache-Control, ETag) cause poor performance and unnecessary server load.",
      "X-Powered-By headers leaking 'PHP/7.2' or framework versions aid targeted attacks.",
    ],
  },
  cookies: {
    detail:
      "Extracts all cookies set by the HTTP response. Analyzes cookie attributes (Secure, HttpOnly, SameSite, expiration) that affect security and privacy.",
    examples: [
      "Cookies without 'Secure' flag are sent over plain HTTP, allowing interception on public Wi-Fi.",
      "Missing 'HttpOnly' on session cookies lets XSS attacks steal sessions via JavaScript.",
      "Tracking cookies without SameSite=Strict enable CSRF attacks and cross-site tracking.",
    ],
  },
  redirects: {
    detail:
      "Follows the complete HTTP redirect chain from the initial URL to the final destination. Records each hop, status code (301/302/307/308), and target URL.",
    examples: [
      "Long redirect chains (3+ hops) slow page load and waste crawl budget for SEO.",
      "302 redirects instead of 301 don't pass link equity — hurting SEO rankings.",
      "Redirect loops cause the site to be completely inaccessible — hard to debug without this tool.",
    ],
  },
  status: {
    detail:
      "Checks the HTTP status code and measures response time including DNS lookup, TCP connect, and time to first byte. Shows whether the site is accessible and how fast it responds.",
    examples: [
      "A 503 status means the server is overloaded — useful for monitoring availability.",
      "Response times over 2 seconds correlate with 50%+ bounce rate increase.",
      "Comparing response times across regions reveals CDN coverage gaps.",
    ],
  },
  ports: {
    detail:
      "Scans 33 common TCP ports including FTP (21), SSH (22), HTTP (80/8080), HTTPS (443), databases (3306/5432), and remote desktop (3389). Open ports reveal running services and potential attack surface.",
    examples: [
      "Open database ports (3306 MySQL, 5432 PostgreSQL) on a public server is a critical security risk.",
      "SSH (22) open to the internet should use key-based auth only — password brute-forcing is common.",
      "Unexpected open ports may indicate a compromised server running unauthorized services.",
    ],
  },
  "get-ip": {
    detail:
      "Resolves the domain to its IP address(es). Shows the actual server IP, which may reveal the hosting provider, geographic location, and whether the site uses a CDN or proxy service.",
    examples: [
      "IP addresses in Cloudflare/AWS ranges indicate CDN usage — the real server IP is hidden.",
      "Multiple IPs suggest load balancing or geographic DNS routing.",
      "Knowing the IP helps determine hosting provider and data center location for compliance requirements.",
    ],
  },
  "trace-route": {
    detail:
      "Traces the network path from this server to the target host, showing each router hop along the way. Helps identify network bottlenecks, routing issues, and the geographic path of traffic.",
    examples: [
      "High latency at a specific hop indicates a bottleneck — useful for diagnosing slow connections.",
      "Traffic routing through unexpected countries may violate data sovereignty requirements.",
      "Packet loss at intermediate hops suggests network congestion or hardware issues.",
    ],
  },
  "robots-txt": {
    detail:
      "Fetches and parses the robots.txt file which tells search engine crawlers which pages to index and which to skip. Misconfigurations can hide your entire site from search engines or expose private areas.",
    examples: [
      "'Disallow: /' blocks all search engines from indexing anything — sometimes set accidentally.",
      "Robots.txt revealing admin paths (/admin, /wp-login) helps attackers find login pages.",
      "Missing robots.txt means crawlers index everything, including staging content or API docs.",
    ],
  },
  sitemap: {
    detail:
      "Fetches and parses the XML sitemap to understand the site's page structure and count. Sitemaps help search engines discover all pages and understand site hierarchy.",
    examples: [
      "A sitemap with 10,000 URLs but only 100 indexed suggests crawlability or quality issues.",
      "Missing sitemap means search engines rely solely on link discovery — slower and less complete indexing.",
      "Outdated sitemaps listing removed pages cause crawl waste and 404 errors in search results.",
    ],
  },
  "social-tags": {
    detail:
      "Extracts OpenGraph (Facebook/LinkedIn), Twitter Cards, and standard meta tags. These control how the page appears when shared on social media — title, description, image, and card type.",
    examples: [
      "Missing og:image means shared links show no preview image — dramatically lower click-through rates.",
      "Wrong og:title/description shows incorrect info when shared, damaging brand perception.",
      "Twitter card type 'summary_large_image' gets 2-3x more engagement than 'summary'.",
    ],
  },
  "linked-pages": {
    detail:
      "Analyzes all internal and external links on the page. Counts outbound links, identifies external domains linked to, and measures the internal linking structure.",
    examples: [
      "Too many external links (100+) can dilute page authority and look spammy to search engines.",
      "Broken internal links (404s) waste crawl budget and create dead ends for users.",
      "Links to malicious or hacked sites can get your own domain penalized by Google.",
    ],
  },
  whois: {
    detail:
      "Performs WHOIS lookup to retrieve domain registration details: registrar, creation/expiration dates, nameservers, and (if not privacy-protected) registrant contact information.",
    examples: [
      "Domains expiring soon risk being snatched by domain squatters if renewal is missed.",
      "Recently registered domains (< 6 months) are statistically more likely to be used for phishing.",
      "Checking registrar history reveals if a domain has changed hands — important for due diligence.",
    ],
  },
  archives: {
    detail:
      "Checks the Wayback Machine (Internet Archive) for historical snapshots of the site. Shows how many times the site has been archived and the date range of captures.",
    examples: [
      "A site with no archive history might be brand new — a red flag for potential scam sites.",
      "Archived versions can reveal previous content, owners, or security vulnerabilities that were fixed.",
      "Legal disputes often use Wayback Machine captures as evidence of prior content or claims.",
    ],
  },
  rank: {
    detail:
      "Checks the domain's position in the Tranco top-1M list, a research-grade ranking based on Chrome User Experience data and Cloudflare DNS queries. Lower rank = more popular site.",
    examples: [
      "Sites not in the top 1M are relatively obscure — useful context for risk assessment.",
      "Sudden rank drops can indicate a Google penalty, outage, or loss of traffic.",
      "High-ranking domains are more valuable targets for attackers but also more scrutinized.",
    ],
  },
  "legacy-rank": {
    detail:
      "Checks the domain's position in the Cisco Umbrella (formerly OpenDNS) popularity ranking. Provides an alternative popularity signal based on DNS query volume across enterprise networks.",
    examples: [
      "Enterprise-heavy domains may rank higher on Umbrella than consumer-focused rankings.",
      "Comparing Tranco and Umbrella rankings reveals if a site is more popular with businesses or consumers.",
      "Newly malicious domains rarely appear on Umbrella's list — absence is a weak trust signal.",
    ],
  },
  carbon: {
    detail:
      "Estimates the website's carbon footprint per page view based on data transfer size. Uses the Sustainable Web Design methodology to calculate CO2 emissions from hosting, network transfer, and end-user devices.",
    examples: [
      "The average website produces 0.5g CO2 per page view — heavy sites can be 5-10x worse.",
      "Images are usually the biggest contributor — optimizing them cuts both load time and emissions.",
      "Some companies report web carbon in sustainability reports — this metric helps track progress.",
    ],
  },
  quality: {
    detail:
      "Runs Google PageSpeed Insights (Lighthouse) analysis checking Performance, Accessibility, Best Practices, and SEO scores. Each category is scored 0-100 based on dozens of automated audits.",
    examples: [
      "Performance below 50 directly impacts search rankings — Google uses Core Web Vitals as a ranking signal.",
      "Accessibility issues (missing alt text, poor contrast) exclude users with disabilities and risk ADA lawsuits.",
      "Best Practices failures (mixed content, deprecated APIs) indicate technical debt that degrades over time.",
    ],
  },
  features: {
    detail:
      "Detects site features and technologies using the BuiltWith API. Identifies CMS, frameworks, analytics tools, advertising networks, CDNs, and other technology integrations.",
    examples: [
      "Knowing a site uses WordPress + WooCommerce reveals common vulnerability patterns to check.",
      "Detecting analytics tools (Google Analytics, Hotjar) helps understand tracking and privacy practices.",
      "Identifying the CDN (Cloudflare, Fastly) helps understand the caching and security infrastructure.",
    ],
  },
  "tech-stack": {
    detail:
      "Detects technologies from HTTP headers, meta tags, HTML patterns, and JavaScript libraries. Identifies frameworks (React, Vue, Next.js), server software (nginx, Apache), CMS platforms, and more.",
    examples: [
      "Outdated jQuery versions have known XSS vulnerabilities — this identifies them without source code access.",
      "Detecting server-side framework (Rails, Django, Express) narrows the attack surface for security testing.",
      "CDN and hosting detection reveals infrastructure dependencies and potential failover points.",
    ],
  },
  screenshot: {
    detail:
      "Captures a full-viewport screenshot of the website using a headless Chromium browser. The screenshot shows how the site actually renders, including dynamic JavaScript content.",
    examples: [
      "Visual comparison across scans detects defacements, injected content, or broken layouts.",
      "Screenshots reveal if a site shows different content to bots vs. users (cloaking).",
      "Useful for archival purposes — documenting a site's appearance at a specific point in time.",
    ],
  },
  seo: {
    detail:
      "Performs a comprehensive on-page SEO audit by fetching the HTML and analyzing key ranking factors. Checks title tag length, meta description, heading hierarchy (H1-H6), image alt text coverage, canonical URL, viewport meta, structured data (JSON-LD), hreflang tags, meta robots directives, word count, and text-to-HTML ratio. Returns a 0-100 score based on issues found.",
    examples: [
      "A missing or duplicate H1 is one of the most common on-page SEO issues — every page should have exactly one.",
      "Pages with fewer than 300 words often struggle to rank, as search engines may consider them thin content.",
      "Missing structured data (JSON-LD) means your pages won't get rich snippets in search results — reviews, FAQs, products, etc.",
    ],
    links: [
      { label: "Google SEO Starter Guide", url: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide" },
      { label: "Schema.org", url: "https://schema.org/" },
    ],
  },
  wordpress: {
    detail:
      "Passively scans a website to detect if it runs WordPress, then enumerates plugins, themes, and their exposed versions from the page HTML. Checks for commonly exploited files (xmlrpc.php, debug logs, config backups, user enumeration endpoints) and reports security misconfigurations. No API key required — all detection is done from publicly visible data.",
    examples: [
      "An exposed xmlrpc.php enables brute-force login attacks and can be used for DDoS amplification via pingbacks.",
      "Public version numbers for plugins and themes allow attackers to match known CVEs to exact versions.",
      "An accessible wp-content/debug.log may leak database queries, file paths, and PHP errors to anyone.",
    ],
    links: [
      { label: "WordPress Security", url: "https://developer.wordpress.org/advanced-administration/security/hardening/" },
      { label: "WPScan", url: "https://wpscan.com/" },
    ],
  },
  virustotal: {
    detail:
      "Submits the URL to VirusTotal which scans it against 70+ antivirus engines and security vendors (Google Safe Browsing, Kaspersky, BitDefender, Sophos, etc.). Returns the number of engines that flagged the URL as malicious or suspicious. Requires a free API key.",
    examples: [
      "Even 1-2 detections warrant investigation — false positives exist but multiple flags are a strong signal.",
      "A clean VirusTotal report doesn't guarantee safety — zero-day threats and new phishing sites may not be indexed yet.",
      "The permalink lets you view the full report including individual engine verdicts and community comments.",
    ],
    links: [
      { label: "VirusTotal", url: "https://www.virustotal.com/" },
      { label: "API Docs", url: "https://docs.virustotal.com/reference/overview" },
    ],
  },
  "ssl-labs": {
    detail:
      "Submits the domain to the Qualys SSL Labs API which performs a deep analysis of the server's SSL/TLS configuration. Returns a letter grade (A+, A, B, C, F) based on protocol support, key exchange strength, cipher strength, and certificate validity. Multiple endpoints are tested if the domain resolves to more than one IP.",
    examples: [
      "An A+ grade requires HSTS with a long max-age — without it, the best you can get is A.",
      "Grade B typically means the server still supports older TLS 1.0/1.1 protocols which have known vulnerabilities.",
      "Grade F means a critical issue like an expired certificate, vulnerable to known attacks (POODLE, Heartbleed), or no HTTPS at all.",
    ],
    links: [
      { label: "SSL Labs", url: "https://www.ssllabs.com/ssltest/" },
      { label: "SSL Labs API Docs", url: "https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md" },
    ],
  },
  "server-location": {
    detail:
      "Determines the physical location of the server hosting the website by resolving the domain to an IP address and looking it up in a geolocation database. Returns city, region, country, timezone, latitude/longitude coordinates, ISP, and autonomous system number. The result is displayed on an interactive map for quick visual reference.",
    examples: [
      "A site claiming to host data in the EU but with servers in the US may violate GDPR data residency requirements.",
      "Servers far from your target audience introduce latency — a site serving Asian users from a US data center adds 150-300ms per request.",
      "Identifying the ISP and AS number reveals the hosting provider — useful for assessing infrastructure reliability and DDoS resilience.",
    ],
    links: [
      { label: "IP Geolocation", url: "https://en.wikipedia.org/wiki/Internet_geolocation" },
      { label: "ip-api.com", url: "https://ip-api.com/" },
    ],
  },
};
