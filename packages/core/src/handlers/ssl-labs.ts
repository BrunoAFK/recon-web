import tls from 'node:tls';
import https from 'node:https';
import type { AnalysisHandler } from '../types.js';
import { extractHostname } from '../utils/url.js';

export interface SslLabsEndpoint {
  ipAddress: string;
  grade: string;
  gradeTrustIgnored: string;
  hasWarnings: boolean;
  isExceptional: boolean;
  delegation: number;
}

export interface SslLabsResult {
  host: string;
  port: number;
  protocol: string;
  status: string;
  grade: string | null;
  gradeTrustIgnored: string | null;
  hasWarnings: boolean;
  endpoints: SslLabsEndpoint[];
  testTime: string | null;
  details?: SslGradeDetails;
}

interface SslGradeDetails {
  protocolVersion: string | null;
  cipherSuite: string | null;
  keyExchange: string | null;
  certValid: boolean;
  certExpiresDays: number | null;
  certIssuer: string | null;
  certSubject: string | null;
  hasHsts: boolean;
  hstsMaxAge: number | null;
  checks: GradeCheck[];
}

interface GradeCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  detail?: string;
}

// Strong cipher suites (TLS 1.2+ AEAD ciphers)
const STRONG_CIPHERS = new Set([
  'TLS_AES_128_GCM_SHA256',
  'TLS_AES_256_GCM_SHA384',
  'TLS_CHACHA20_POLY1305_SHA256',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-CHACHA20-POLY1305',
]);

// Weak protocols
const WEAK_PROTOCOLS = new Set(['SSLv3', 'TLSv1', 'TLSv1.1']);

/**
 * Perform a TLS connection and gather all data needed for grading.
 */
async function gatherTlsData(
  host: string,
  timeout: number,
): Promise<{
  protocol: string | null;
  cipher: { name: string; version: string } | null;
  cert: tls.PeerCertificate | null;
  authorized: boolean;
  authError: string | null;
}> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, rejectUnauthorized: false, servername: host },
      () => {
        const protocol = socket.getProtocol();
        const cipher = socket.getCipher();
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        const authError = socket.authorizationError ?? null;
        socket.destroy();
        resolve({
          protocol,
          cipher: cipher ? { name: cipher.name, version: cipher.version } : null,
          cert: cert && Object.keys(cert).length > 0 ? cert : null,
          authorized,
          authError: authError ? String(authError) : null,
        });
      },
    );

    socket.setTimeout(timeout, () => {
      socket.destroy();
      resolve({ protocol: null, cipher: null, cert: null, authorized: false, authError: 'TIMEOUT' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ protocol: null, cipher: null, cert: null, authorized: false, authError: err.message });
    });
  });
}

/**
 * Check HSTS header by making an HTTPS request.
 */
async function checkHsts(host: string, timeout: number): Promise<{ has: boolean; maxAge: number | null }> {
  return new Promise((resolve) => {
    const req = https.get(
      `https://${host}`,
      { timeout, rejectUnauthorized: false, headers: { 'User-Agent': 'recon-web/1.0' } },
      (res) => {
        const hsts = res.headers['strict-transport-security'];
        res.resume();
        if (!hsts) {
          resolve({ has: false, maxAge: null });
          return;
        }
        const match = hsts.match(/max-age=(\d+)/i);
        resolve({ has: true, maxAge: match ? parseInt(match[1], 10) : null });
      },
    );
    req.on('error', () => resolve({ has: false, maxAge: null }));
    req.on('timeout', () => { req.destroy(); resolve({ has: false, maxAge: null }); });
  });
}

/**
 * Compute an SSL grade (A+, A, B, C, D, F) based on collected TLS data.
 *
 * Grading criteria (inspired by SSL Labs methodology):
 * - Protocol version (TLS 1.3 best, TLS 1.2 good, TLS 1.1/1.0 bad, SSL terrible)
 * - Certificate validity and trust chain
 * - Certificate expiration (>30 days good, <30 warning, expired fail)
 * - Cipher strength (AEAD good, CBC ok, RC4/DES/NULL terrible)
 * - HSTS presence and max-age
 * - Key exchange (ECDHE/DHE good, RSA-only less good)
 */
function computeGrade(
  tlsData: Awaited<ReturnType<typeof gatherTlsData>>,
  hsts: { has: boolean; maxAge: number | null },
): { grade: string; hasWarnings: boolean; checks: GradeCheck[] } {
  const checks: GradeCheck[] = [];
  let score = 100;
  let hasWarnings = false;
  let hasCriticalFail = false;

  // 1. TLS connection successful?
  if (!tlsData.protocol) {
    return {
      grade: 'F',
      hasWarnings: true,
      checks: [{ id: 'no-tls', label: 'TLS connection failed', passed: false, severity: 'critical', detail: tlsData.authError ?? 'Connection failed' }],
    };
  }

  // 2. Certificate trusted?
  if (tlsData.authorized) {
    checks.push({ id: 'cert-trust', label: 'Certificate is trusted', passed: true, severity: 'critical' });
  } else {
    checks.push({ id: 'cert-trust', label: 'Certificate is trusted', passed: false, severity: 'critical', detail: tlsData.authError ?? 'Not trusted' });
    score -= 40;
    hasCriticalFail = true;
  }

  // 3. Certificate expiration
  if (tlsData.cert) {
    const validTo = new Date(tlsData.cert.valid_to);
    const now = new Date();
    const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / (86400 * 1000));

    if (daysLeft < 0) {
      checks.push({ id: 'cert-expiry', label: 'Certificate not expired', passed: false, severity: 'critical', detail: `Expired ${Math.abs(daysLeft)} days ago` });
      score -= 40;
      hasCriticalFail = true;
    } else if (daysLeft < 30) {
      checks.push({ id: 'cert-expiry', label: 'Certificate not expiring soon', passed: false, severity: 'warning', detail: `Expires in ${daysLeft} days` });
      score -= 10;
      hasWarnings = true;
    } else {
      checks.push({ id: 'cert-expiry', label: 'Certificate not expiring soon', passed: true, severity: 'info', detail: `Expires in ${daysLeft} days` });
    }
  }

  // 4. Protocol version
  const protocol = tlsData.protocol!;
  if (protocol === 'TLSv1.3') {
    checks.push({ id: 'protocol', label: 'Modern protocol (TLS 1.3)', passed: true, severity: 'info' });
  } else if (protocol === 'TLSv1.2') {
    checks.push({ id: 'protocol', label: 'Acceptable protocol (TLS 1.2)', passed: true, severity: 'info' });
    score -= 5;
  } else if (WEAK_PROTOCOLS.has(protocol)) {
    checks.push({ id: 'protocol', label: 'Protocol is secure', passed: false, severity: 'critical', detail: `Uses deprecated ${protocol}` });
    score -= 30;
    hasCriticalFail = true;
  }

  // 5. Cipher suite
  if (tlsData.cipher) {
    const cipherName = tlsData.cipher.name;
    if (STRONG_CIPHERS.has(cipherName)) {
      checks.push({ id: 'cipher', label: 'Strong cipher suite', passed: true, severity: 'info', detail: cipherName });
    } else if (cipherName.includes('CBC')) {
      checks.push({ id: 'cipher', label: 'Strong cipher suite', passed: false, severity: 'warning', detail: `${cipherName} (CBC mode, prefer AEAD)` });
      score -= 10;
      hasWarnings = true;
    } else if (cipherName.includes('RC4') || cipherName.includes('DES') || cipherName.includes('NULL')) {
      checks.push({ id: 'cipher', label: 'Strong cipher suite', passed: false, severity: 'critical', detail: `${cipherName} (insecure)` });
      score -= 30;
      hasCriticalFail = true;
    } else {
      checks.push({ id: 'cipher', label: 'Cipher suite', passed: true, severity: 'info', detail: cipherName });
    }

    // Key exchange
    if (cipherName.startsWith('TLS_') || cipherName.includes('ECDHE') || cipherName.includes('DHE')) {
      checks.push({ id: 'key-exchange', label: 'Forward secrecy (ECDHE/DHE)', passed: true, severity: 'info' });
    } else {
      checks.push({ id: 'key-exchange', label: 'Forward secrecy (ECDHE/DHE)', passed: false, severity: 'warning', detail: 'No forward secrecy' });
      score -= 10;
      hasWarnings = true;
    }
  }

  // 6. HSTS
  if (hsts.has) {
    if (hsts.maxAge && hsts.maxAge >= 31536000) {
      checks.push({ id: 'hsts', label: 'HSTS enabled (1+ year)', passed: true, severity: 'info' });
    } else {
      checks.push({ id: 'hsts', label: 'HSTS max-age >= 1 year', passed: false, severity: 'warning', detail: `max-age=${hsts.maxAge}` });
      score -= 5;
      hasWarnings = true;
    }
  } else {
    checks.push({ id: 'hsts', label: 'HSTS enabled', passed: false, severity: 'warning', detail: 'No Strict-Transport-Security header' });
    score -= 10;
    hasWarnings = true;
  }

  // Compute letter grade from score
  let grade: string;
  if (hasCriticalFail) {
    grade = score <= 20 ? 'F' : score <= 50 ? 'D' : 'C';
  } else if (score >= 95) {
    grade = hasWarnings ? 'A' : 'A+';
  } else if (score >= 85) {
    grade = 'A';
  } else if (score >= 70) {
    grade = 'B';
  } else if (score >= 55) {
    grade = 'C';
  } else if (score >= 40) {
    grade = 'D';
  } else {
    grade = 'F';
  }

  return { grade, hasWarnings, checks };
}

export const sslLabsHandler: AnalysisHandler<SslLabsResult> = async (url, options) => {
  try {
    const host = extractHostname(url);
    const timeout = options?.timeout ?? 15_000;

    // Gather TLS data and HSTS in parallel
    const [tlsData, hsts] = await Promise.all([
      gatherTlsData(host, timeout),
      checkHsts(host, timeout),
    ]);

    if (!tlsData.protocol && !tlsData.cert) {
      return {
        error: tlsData.authError ?? `Could not establish TLS connection to ${host}`,
        errorCode: 'CONNECTION_REFUSED',
        errorCategory: 'site',
      };
    }

    const { grade, hasWarnings, checks } = computeGrade(tlsData, hsts);

    const cert = tlsData.cert;
    const daysLeft = cert
      ? Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / (86400 * 1000))
      : null;

    return {
      data: {
        host,
        port: 443,
        protocol: 'https',
        status: 'READY',
        grade,
        gradeTrustIgnored: grade,
        hasWarnings,
        endpoints: [
          {
            ipAddress: host,
            grade,
            gradeTrustIgnored: grade,
            hasWarnings,
            isExceptional: grade === 'A+',
            delegation: 0,
          },
        ],
        testTime: new Date().toISOString(),
        details: {
          protocolVersion: tlsData.protocol,
          cipherSuite: tlsData.cipher?.name ?? null,
          keyExchange: tlsData.cipher?.name.includes('ECDHE')
            ? 'ECDHE'
            : tlsData.cipher?.name.includes('DHE')
              ? 'DHE'
              : 'RSA',
          certValid: tlsData.authorized,
          certExpiresDays: daysLeft,
          certIssuer: String(cert?.issuer?.O ?? cert?.issuer?.CN ?? '') || null,
          certSubject: String(cert?.subject?.CN ?? '') || null,
          hasHsts: hsts.has,
          hstsMaxAge: hsts.maxAge,
          checks,
        },
      },
    };
  } catch (error) {
    return { error: (error as Error).message };
  }
};
