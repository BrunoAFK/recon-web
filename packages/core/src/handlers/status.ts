import https from 'https';
import http from 'http';
import { performance, PerformanceObserver } from 'perf_hooks';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';

export interface StatusResult {
  isUp: boolean;
  dnsLookupTime: number;
  responseTime: number;
  responseCode: number;
}

export const statusHandler: AnalysisHandler<StatusResult> = async (url, options) => {
  if (!url) {
    return { error: 'You must provide a URL', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  const targetUrl = normalizeUrl(url);
  let dnsLookupTime = 0;
  let responseCode = 0;

  const obs = new PerformanceObserver((items) => {
    dnsLookupTime = items.getEntries()[0].duration;
    performance.clearMarks();
  });

  obs.observe({ entryTypes: ['measure'] });
  performance.mark('A');

  try {
    const startTime = performance.now();
    const getter = targetUrl.startsWith('https') ? https : http;

    await new Promise<void>((resolve, reject) => {
      const req = getter.get(targetUrl, (res) => {
        responseCode = res.statusCode ?? 0;
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve();
        });
      });

      req.on('error', reject);
      req.end();
    });

    if (responseCode < 200 || responseCode >= 400) {
      obs.disconnect();
      return { error: `Received non-success response code: ${responseCode}` };
    }

    performance.mark('B');
    performance.measure('A to B', 'A', 'B');
    const responseTime = performance.now() - startTime;
    obs.disconnect();

    return { data: { isUp: true, dnsLookupTime, responseTime, responseCode } };
  } catch (error) {
    obs.disconnect();
    return { error: (error as Error).message };
  }
};
