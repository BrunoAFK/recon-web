import dns from 'dns/promises';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

export interface ServerLocationResult {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  timezone: string;
  latitude: number;
  longitude: number;
  isp: string;
  org: string;
  as: string;
}

interface IpApiResponse {
  status: 'success' | 'fail';
  message?: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}

export const serverLocationHandler: AnalysisHandler<ServerLocationResult> = async (url, options) => {
  try {
    const hostname = extractHostname(url);
    const { address } = await dns.lookup(hostname);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 10_000);

    try {
      const response = await fetch(
        `http://ip-api.com/json/${address}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as`,
        { signal: controller.signal },
      );

      const data = (await response.json()) as IpApiResponse;

      if (data.status === 'fail') {
        return { error: data.message ?? 'Geolocation lookup failed' };
      }

      return {
        data: {
          ip: address,
          city: data.city,
          region: data.regionName,
          country: data.country,
          countryCode: data.countryCode,
          timezone: data.timezone,
          latitude: data.lat,
          longitude: data.lon,
          isp: data.isp,
          org: data.org,
          as: data.as,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    return { error: (error as Error).message };
  }
};
