import type { ComponentType } from "react";
import type { RendererProps } from "./types";

import { StatusRenderer } from "./StatusRenderer";
import { GetIpRenderer } from "./GetIpRenderer";
import { SslRenderer } from "./SslRenderer";
import { FirewallRenderer } from "./FirewallRenderer";
import { HstsRenderer } from "./HstsRenderer";
import { HttpSecurityRenderer } from "./HttpSecurityRenderer";
import { CarbonRenderer } from "./CarbonRenderer";
import { WhoisRenderer } from "./WhoisRenderer";
import { RankRenderer } from "./RankRenderer";
import { DnssecRenderer } from "./DnssecRenderer";
import { SecurityTxtRenderer } from "./SecurityTxtRenderer";
import { DnsServerRenderer } from "./DnsServerRenderer";
import { DnsRenderer } from "./DnsRenderer";
import { HeadersRenderer } from "./HeadersRenderer";
import { CookiesRenderer } from "./CookiesRenderer";
import { PortsRenderer } from "./PortsRenderer";
import { BlockListsRenderer } from "./BlockListsRenderer";
import { LinkedPagesRenderer } from "./LinkedPagesRenderer";
import { TxtRecordsRenderer } from "./TxtRecordsRenderer";
import { RedirectsRenderer } from "./RedirectsRenderer";
import { TechStackRenderer } from "./TechStackRenderer";
import { SocialTagsRenderer } from "./SocialTagsRenderer";
import { ThreatsRenderer } from "./ThreatsRenderer";
import { ScreenshotRenderer } from "./ScreenshotRenderer";
import { MailConfigRenderer } from "./MailConfigRenderer";
import { RobotsTxtRenderer } from "./RobotsTxtRenderer";
import { SitemapRenderer } from "./SitemapRenderer";
import { ArchivesRenderer } from "./ArchivesRenderer";
import { TraceRouteRenderer } from "./TraceRouteRenderer";
import { QualityRenderer } from "./QualityRenderer";
import { TlsRenderer } from "./TlsRenderer";
import { FeaturesRenderer } from "./FeaturesRenderer";
import { LegacyRankRenderer } from "./LegacyRankRenderer";

export const rendererRegistry: Record<string, ComponentType<RendererProps>> = {
  status: StatusRenderer,
  "get-ip": GetIpRenderer,
  ssl: SslRenderer,
  firewall: FirewallRenderer,
  hsts: HstsRenderer,
  "http-security": HttpSecurityRenderer,
  carbon: CarbonRenderer,
  whois: WhoisRenderer,
  rank: RankRenderer,
  dnssec: DnssecRenderer,
  "security-txt": SecurityTxtRenderer,
  "dns-server": DnsServerRenderer,
  dns: DnsRenderer,
  headers: HeadersRenderer,
  cookies: CookiesRenderer,
  ports: PortsRenderer,
  "block-lists": BlockListsRenderer,
  "linked-pages": LinkedPagesRenderer,
  "txt-records": TxtRecordsRenderer,
  redirects: RedirectsRenderer,
  "tech-stack": TechStackRenderer,
  "social-tags": SocialTagsRenderer,
  threats: ThreatsRenderer,
  screenshot: ScreenshotRenderer,
  "mail-config": MailConfigRenderer,
  "robots-txt": RobotsTxtRenderer,
  sitemap: SitemapRenderer,
  archives: ArchivesRenderer,
  "trace-route": TraceRouteRenderer,
  quality: QualityRenderer,
  tls: TlsRenderer,
  features: FeaturesRenderer,
  "legacy-rank": LegacyRankRenderer,
};
