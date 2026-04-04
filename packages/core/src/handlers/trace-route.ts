import { execFile } from 'child_process';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

interface TracerouteHop {
  hop: number;
  ip: string | null;
  rtt1: string | null;
  rtt2: string | null;
  rtt3: string | null;
}

export interface TraceRouteResult {
  message: string;
  result: TracerouteHop[];
}

function runTraceroute(host: string): Promise<TracerouteHop[]> {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32';
    const command = isWin ? 'tracert' : 'traceroute';
    const args = isWin ? ['-d', '-w', '1000', host] : ['-m', '30', '-w', '1', host];

    execFile(command, args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject(error);
        return;
      }

      const lines = stdout.split('\n').filter((line) => line.trim().length > 0);
      const hops: TracerouteHop[] = [];

      for (const line of lines) {
        const match = line.match(/^\s*(\d+)\s+(.+)$/);
        if (match) {
          const hopNumber = parseInt(match[1], 10);
          const rest = match[2].trim();

          const ipMatch = rest.match(/(\d+\.\d+\.\d+\.\d+)/);
          const rttMatches = rest.match(/([\d.]+)\s*ms/g);

          hops.push({
            hop: hopNumber,
            ip: ipMatch ? ipMatch[1] : null,
            rtt1: rttMatches?.[0]?.replace(' ms', '') ?? null,
            rtt2: rttMatches?.[1]?.replace(' ms', '') ?? null,
            rtt3: rttMatches?.[2]?.replace(' ms', '') ?? null,
          });
        }
      }

      resolve(hops);
    });
  });
}

// Defence-in-depth: validate hostname format before passing to execFile
const SAFE_HOSTNAME = /^[a-zA-Z0-9][a-zA-Z0-9.\-]*[a-zA-Z0-9]$/;

export const traceRouteHandler: AnalysisHandler<TraceRouteResult> = async (url, options) => {
  try {
    const host = extractHostname(url);

    if (!host) {
      return { error: 'Invalid URL provided', errorCode: 'INVALID_URL', errorCategory: 'tool' };
    }

    if (!SAFE_HOSTNAME.test(host)) {
      return { error: 'Invalid hostname for traceroute', errorCode: 'INVALID_URL', errorCategory: 'tool' };
    }

    const result = await runTraceroute(host);

    return {
      data: {
        message: 'Traceroute completed!',
        result,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
