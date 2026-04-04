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
  reachedTarget: boolean;
  totalHops: number;
  respondingHops: number;
}

function parseTraceroute(stdout: string): TracerouteHop[] {
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

  return hops;
}

function runCommand(command: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout }, (error, stdout) => {
      if (error && !stdout) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

/** Strip trailing consecutive `*` hops (no useful data). */
function trimTrailingStars(hops: TracerouteHop[]): TracerouteHop[] {
  let lastResponding = -1;
  for (let i = hops.length - 1; i >= 0; i--) {
    if (hops[i].ip !== null) {
      lastResponding = i;
      break;
    }
  }
  // Keep up to 2 trailing `*` hops after the last responding one for context
  return hops.slice(0, Math.min(lastResponding + 3, hops.length));
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

    const isWin = process.platform === 'win32';
    let hops: TracerouteHop[] = [];

    // Try ICMP traceroute first
    try {
      const command = isWin ? 'tracert' : 'traceroute';
      const args = isWin ? ['-d', '-w', '1000', host] : ['-m', '20', '-w', '1', '-q', '1', host];
      const stdout = await runCommand(command, args, 25000);
      hops = parseTraceroute(stdout);
    } catch {
      // ICMP traceroute failed or not available
    }

    // If ICMP gave mostly `*` hops, try TCP traceroute (port 443) as fallback on Linux
    const respondingCount = hops.filter((h) => h.ip !== null).length;
    if (!isWin && respondingCount <= 1) {
      try {
        const stdout = await runCommand('traceroute', ['-T', '-p', '443', '-m', '20', '-w', '1', '-q', '1', host], 25000);
        const tcpHops = parseTraceroute(stdout);
        const tcpResponding = tcpHops.filter((h) => h.ip !== null).length;
        if (tcpResponding > respondingCount) {
          hops = tcpHops;
        }
      } catch {
        // TCP traceroute not available or failed — use ICMP results
      }
    }

    // Trim useless trailing `*` hops
    const trimmedHops = trimTrailingStars(hops);
    const totalRespondingHops = trimmedHops.filter((h) => h.ip !== null).length;

    // Check if last responding hop is the target
    const lastHop = trimmedHops.filter((h) => h.ip !== null).pop();
    const reachedTarget = totalRespondingHops > 1; // More than just gateway

    let message: string;
    if (totalRespondingHops === 0) {
      message = 'Traceroute could not reach any hops. ICMP may be blocked in this environment.';
    } else if (totalRespondingHops === 1) {
      message = 'Only the local gateway responded. Intermediate hops and the target are blocking ICMP probes.';
    } else {
      message = `Traceroute completed with ${totalRespondingHops} responding hop${totalRespondingHops > 1 ? 's' : ''}.`;
    }

    return {
      data: {
        message,
        result: trimmedHops,
        reachedTarget,
        totalHops: trimmedHops.length,
        respondingHops: totalRespondingHops,
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
