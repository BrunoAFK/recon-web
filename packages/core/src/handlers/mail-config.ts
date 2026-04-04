import dns from 'dns/promises';
import type { AnalysisHandler, HandlerResult } from '../types.js';
import { extractHostname } from '../utils/url.js';

interface MxRecord {
  exchange: string;
  priority: number;
}

interface MailService {
  provider: string;
  value: string;
}

export interface MailConfigResult {
  mxRecords: MxRecord[];
  txtRecords: string[][];
  mailServices: MailService[];
  message?: string;
}

export const mailConfigHandler: AnalysisHandler<MailConfigResult> = async (url, options) => {
  try {
    const domain = extractHostname(url);

    // Get MX records
    const mxRecords = await dns.resolveMx(domain);

    // Get TXT records
    const txtRecords = await dns.resolveTxt(domain);

    // Filter for only email related TXT records (SPF, DKIM, DMARC, and certain provider verifications)
    const emailTxtRecords = txtRecords.filter((record) => {
      const recordString = record.join('');
      return (
        recordString.startsWith('v=spf1') ||
        recordString.startsWith('v=DKIM1') ||
        recordString.startsWith('v=DMARC1') ||
        recordString.startsWith('protonmail-verification=') ||
        recordString.startsWith('google-site-verification=') ||
        recordString.startsWith('MS=') ||
        recordString.startsWith('zoho-verification=') ||
        recordString.startsWith('titan-verification=') ||
        recordString.includes('bluehost.com')
      );
    });

    // Identify specific mail services
    const mailServices: MailService[] = emailTxtRecords
      .map((record): MailService | null => {
        const recordString = record.join('');
        if (recordString.startsWith('protonmail-verification=')) {
          return { provider: 'ProtonMail', value: recordString.split('=')[1] };
        } else if (recordString.startsWith('google-site-verification=')) {
          return { provider: 'Google Workspace', value: recordString.split('=')[1] };
        } else if (recordString.startsWith('MS=')) {
          return { provider: 'Microsoft 365', value: recordString.split('=')[1] };
        } else if (recordString.startsWith('zoho-verification=')) {
          return { provider: 'Zoho', value: recordString.split('=')[1] };
        } else if (recordString.startsWith('titan-verification=')) {
          return { provider: 'Titan', value: recordString.split('=')[1] };
        } else if (recordString.includes('bluehost.com')) {
          return { provider: 'BlueHost', value: recordString };
        }
        return null;
      })
      .filter((record): record is MailService => record !== null);

    // Check MX records for Yahoo
    const yahooMx = mxRecords.filter((record) => record.exchange.includes('yahoodns.net'));
    if (yahooMx.length > 0) {
      mailServices.push({ provider: 'Yahoo', value: yahooMx[0].exchange });
    }

    // Check MX records for Mimecast
    const mimecastMx = mxRecords.filter((record) => record.exchange.includes('mimecast.com'));
    if (mimecastMx.length > 0) {
      mailServices.push({ provider: 'Mimecast', value: mimecastMx[0].exchange });
    }

    if (mxRecords.length === 0 && emailTxtRecords.length === 0 && mailServices.length === 0) {
      return {
        data: {
          mxRecords,
          txtRecords: emailTxtRecords,
          mailServices,
          message: 'No mail server or email authentication records were detected for this domain.',
        },
      };
    }

    return {
      data: {
        mxRecords,
        txtRecords: emailTxtRecords,
        mailServices,
      },
    };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return {
        data: {
          mxRecords: [],
          txtRecords: [],
          mailServices: [],
          message: 'No mail server is configured for this domain.',
        },
      };
    }
    return { error: err.message };
  }
};
