import axios from 'axios';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { getFinalResponseUrl } from '../utils/http.js';
import { normalizeUrl } from '../utils/url.js';

export interface FirewallResult {
  hasWaf: boolean;
  waf?: string;
  finalUrl?: string;
}

const detectWaf = (headers: Record<string, string>): FirewallResult => {
  const server = headers['server'] ?? '';
  const setCookie = headers['set-cookie'] ?? '';

  if (server.includes('cloudflare')) return { hasWaf: true, waf: 'Cloudflare' };
  if (headers['x-powered-by']?.includes('AWS Lambda')) return { hasWaf: true, waf: 'AWS WAF' };
  if (server.includes('AkamaiGHost')) return { hasWaf: true, waf: 'Akamai' };
  if (server.includes('Sucuri')) return { hasWaf: true, waf: 'Sucuri' };
  if (server.includes('BarracudaWAF')) return { hasWaf: true, waf: 'Barracuda WAF' };
  if (server.includes('F5 BIG-IP') || server.includes('BIG-IP')) return { hasWaf: true, waf: 'F5 BIG-IP' };
  if (headers['x-sucuri-id'] || headers['x-sucuri-cache']) return { hasWaf: true, waf: 'Sucuri CloudProxy WAF' };
  if (server.includes('FortiWeb')) return { hasWaf: true, waf: 'Fortinet FortiWeb WAF' };
  if (server.includes('Imperva')) return { hasWaf: true, waf: 'Imperva SecureSphere WAF' };
  if (headers['x-protected-by']?.includes('Sqreen')) return { hasWaf: true, waf: 'Sqreen' };
  if (headers['x-waf-event-info']) return { hasWaf: true, waf: 'Reblaze WAF' };
  if (setCookie.includes('_citrix_ns_id')) return { hasWaf: true, waf: 'Citrix NetScaler' };
  if (headers['x-denied-reason'] || headers['x-wzws-requested-method']) return { hasWaf: true, waf: 'WangZhanBao WAF' };
  if (headers['x-webcoment']) return { hasWaf: true, waf: 'Webcoment Firewall' };
  if (server.includes('Yundun')) return { hasWaf: true, waf: 'Yundun WAF' };
  if (headers['x-yd-waf-info'] || headers['x-yd-info']) return { hasWaf: true, waf: 'Yundun WAF' };
  if (server.includes('Safe3WAF')) return { hasWaf: true, waf: 'Safe3 Web Application Firewall' };
  if (server.includes('NAXSI')) return { hasWaf: true, waf: 'NAXSI WAF' };
  if (headers['x-datapower-transactionid']) return { hasWaf: true, waf: 'IBM WebSphere DataPower' };
  if (server.includes('QRATOR')) return { hasWaf: true, waf: 'QRATOR WAF' };
  if (server.includes('ddos-guard')) return { hasWaf: true, waf: 'DDoS-Guard WAF' };

  return { hasWaf: false };
};

export const firewallHandler: AnalysisHandler<FirewallResult> = async (url, options) => {
  try {
    const fullUrl = normalizeUrl(url);
    const response = await axios.get(fullUrl);
    const result = detectWaf(response.headers as Record<string, string>);
    return { data: { ...result, finalUrl: getFinalResponseUrl(response) ?? fullUrl } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
