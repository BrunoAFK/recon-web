import type { AnalysisHandler, HandlerResult } from '../types.js';
import { normalizeUrl } from '../utils/url.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

interface RobotsRule {
  lbl: string;
  val: string;
}

export interface RobotsTxtResult {
  robots: RobotsRule[];
  message?: string;
}

const parseRobotsTxt = (content: string): RobotsTxtResult => {
  const lines = content.split('\n');
  const rules: RobotsRule[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    let match = line.match(/^(Allow|Disallow):\s*(\S*)$/i);
    if (match) {
      rules.push({ lbl: match[1], val: match[2] });
    } else {
      match = line.match(/^(User-agent):\s*(\S*)$/i);
      if (match) {
        rules.push({ lbl: match[1], val: match[2] });
      }
    }
  }

  return { robots: rules };
};

export const robotsTxtHandler: AnalysisHandler<RobotsTxtResult> = async (url, options) => {
  const targetUrl = normalizeUrl(url);
  let parsedURL: URL;
  try {
    parsedURL = new URL(targetUrl);
  } catch {
    return { error: 'Invalid URL', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  const robotsURL = `${parsedURL.protocol}//${parsedURL.hostname}/robots.txt`;

  try {
    const response = await safeFetch(robotsURL, { timeoutMs: options?.timeout });

    if (response.status === 200) {
      const parsedData = parseRobotsTxt(response.data);
      if (!parsedData.robots || parsedData.robots.length === 0) {
        return { data: { robots: [], message: 'No robots.txt rules were found.' } };
      }
      return { data: parsedData };
    } else if (response.status === 404) {
      return { data: { robots: [], message: 'No robots.txt file is present on this site.' } };
    } else {
      return { error: `Failed to fetch robots.txt (status ${response.status})`, errorCode: 'NOT_FOUND', errorCategory: 'info' };
    }
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return { error: 'Blocked: target resolves to private address' };
    }
    return { error: `Error fetching robots.txt: ${(error as Error).message}` };
  }
};
