import axios from 'axios';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { getFinalResponseUrl } from '../utils/http.js';
import { normalizeUrl } from '../utils/url.js';

export interface HttpSecurityResult {
  finalUrl?: string;
  strictTransportPolicy: boolean;
  xFrameOptions: boolean;
  xContentTypeOptions: boolean;
  xXSSProtection: boolean;
  contentSecurityPolicy: boolean;
}

export const httpSecurityHandler: AnalysisHandler<HttpSecurityResult> = async (url, options) => {
  try {
    const fullUrl = normalizeUrl(url);
    const response = await axios.get(fullUrl);
    const headers = response.headers;

    const result: HttpSecurityResult = {
      finalUrl: getFinalResponseUrl(response) ?? fullUrl,
      strictTransportPolicy: !!headers['strict-transport-security'],
      xFrameOptions: !!headers['x-frame-options'],
      xContentTypeOptions: !!headers['x-content-type-options'],
      xXSSProtection: !!headers['x-xss-protection'],
      contentSecurityPolicy: !!headers['content-security-policy'],
    };

    return { data: result };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
