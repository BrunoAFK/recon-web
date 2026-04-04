import dns from 'dns/promises';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

export interface GetIpResult {
  ip: string;
  family: number;
}

export const getIpHandler: AnalysisHandler<GetIpResult> = async (url, options) => {
  try {
    const hostname = extractHostname(url);
    const { address, family } = await dns.lookup(hostname);
    return { data: { ip: address, family } };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
