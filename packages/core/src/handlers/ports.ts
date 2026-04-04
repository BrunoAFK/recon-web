import net from 'net';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

const DEFAULT_PORTS_TO_CHECK: number[] = [
  20, 21, 22, 23, 25, 53, 80, 67, 68, 69,
  110, 119, 123, 143, 156, 161, 162, 179, 194,
  389, 443, 587, 993, 995,
  3000, 3306, 3389, 5060, 5900, 8000, 8080, 8888,
];

const PORTS: number[] = process.env.PORTS_TO_CHECK
  ? process.env.PORTS_TO_CHECK.split(',').map(Number)
  : DEFAULT_PORTS_TO_CHECK;

export interface PortsResult {
  openPorts: number[];
  failedPorts: number[];
}

function checkPort(port: number, domain: string, sockets: net.Socket[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    sockets.push(socket);

    socket.setTimeout(1500);

    socket.once('connect', () => {
      socket.destroy();
      resolve(port);
    });

    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error(`Timeout at port: ${port}`));
    });

    socket.once('error', (e: Error) => {
      socket.destroy();
      reject(e);
    });

    socket.connect(port, domain);
  });
}

export const portsHandler: AnalysisHandler<PortsResult> = async (url, options) => {
  const sockets: net.Socket[] = [];

  try {
    const domain = extractHostname(url);
    const timeoutMs = options?.timeout ?? 9000;

    const openPorts: number[] = [];
    const failedPorts: number[] = [];

    let timeoutId: ReturnType<typeof setTimeout>;
    const results = await Promise.race([
      Promise.allSettled(
        PORTS.map((port) => checkPort(port, domain, sockets))
      ),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    clearTimeout(timeoutId!);

    if (results === null) {
      // Outer timeout reached — clean up all lingering sockets and their listeners
      for (const socket of sockets) {
        socket.removeAllListeners();
        socket.destroy();
      }
      return { error: 'The function timed out before completing.', errorCode: 'TIMEOUT', errorCategory: 'site' };
    }

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        openPorts.push(PORTS[i]);
      } else {
        failedPorts.push(PORTS[i]);
      }
    }

    openPorts.sort((a, b) => a - b);
    failedPorts.sort((a, b) => a - b);

    return { data: { openPorts, failedPorts } };
  } catch (error) {
    for (const socket of sockets) {
      socket.removeAllListeners();
      socket.destroy();
    }
    return { error: (error as Error).message };
  }
};
