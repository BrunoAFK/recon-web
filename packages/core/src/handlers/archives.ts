import type { AnalysisHandler, HandlerResult } from '../types.js';
import { safeFetch } from '../utils/safe-fetch.js';
import { SsrfBlockedError } from '../utils/network.js';

interface ScanFrequency {
  daysBetweenScans: number;
  daysBetweenChanges: number;
  scansPerDay: number;
  changesPerDay: number;
}

export interface ArchivesResult {
  message?: string;
  firstScan: Date;
  lastScan: Date;
  totalScans: number;
  changeCount: number;
  averagePageSize: number;
  scanFrequency: ScanFrequency;
  scans: string[][];
  scanUrl: string;
}

const convertTimestampToDate = (timestamp: string): Date => {
  const [year, month, day, hour, minute, second] = [
    timestamp.slice(0, 4),
    timestamp.slice(4, 6),
    timestamp.slice(6, 8),
    timestamp.slice(8, 10),
    timestamp.slice(10, 12),
    timestamp.slice(12, 14),
  ].map((num) => parseInt(num, 10));

  return new Date(year, month - 1, day, hour, minute, second);
};

const countPageChanges = (results: string[][]): number => {
  let prevDigest: string | null = null;
  return results.reduce((acc, curr) => {
    if (curr[2] !== prevDigest) {
      prevDigest = curr[2];
      return acc + 1;
    }
    return acc;
  }, -1);
};

const getAveragePageSize = (scans: string[][]): number => {
  const totalSize = scans
    .map((scan) => parseInt(scan[3], 10))
    .reduce((sum, size) => sum + size, 0);
  return Math.round(totalSize / scans.length);
};

const getScanFrequency = (
  firstScan: Date,
  lastScan: Date,
  totalScans: number,
  changeCount: number,
): ScanFrequency => {
  const formatToTwoDecimal = (num: number) => parseFloat(num.toFixed(2));

  const dayFactor = (lastScan.getTime() - firstScan.getTime()) / (1000 * 60 * 60 * 24);
  const daysBetweenScans = formatToTwoDecimal(dayFactor / totalScans);
  const daysBetweenChanges = formatToTwoDecimal(dayFactor / changeCount);
  const scansPerDay = formatToTwoDecimal((totalScans - 1) / dayFactor);
  const changesPerDay = formatToTwoDecimal(changeCount / dayFactor);

  return { daysBetweenScans, daysBetweenChanges, scansPerDay, changesPerDay };
};

export const archivesHandler: AnalysisHandler<ArchivesResult> = async (url, options) => {
  const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${url}&output=json&fl=timestamp,statuscode,digest,length,offset`;

  try {
    const response = await safeFetch(cdxUrl, { timeoutMs: options?.timeout });
    const data = response.data;

    if (!data || !Array.isArray(data) || data.length <= 1) {
      return {
        data: { message: 'This site does not have archived snapshots in the Wayback Machine yet.' } as ArchivesResult,
      };
    }

    // Remove the header row
    data.shift();

    const firstScan = convertTimestampToDate(data[0][0]);
    const lastScan = convertTimestampToDate(data[data.length - 1][0]);
    const totalScans = data.length;
    const changeCount = countPageChanges(data);

    return {
      data: {
        firstScan,
        lastScan,
        totalScans,
        changeCount,
        averagePageSize: getAveragePageSize(data),
        scanFrequency: getScanFrequency(firstScan, lastScan, totalScans, changeCount),
        scans: data,
        scanUrl: url,
      },
    };
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return { error: 'Blocked: target resolves to private address' };
    }
    return { error: `Error fetching Wayback data: ${(error as Error).message}` };
  }
};
