import os from 'os';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { AnalysisHandler, HandlerResult } from '../types.js';

export interface ScreenshotResult {
  image: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Screenshot timeout')), ms),
    ),
  ]);
}

const directChromiumScreenshot = async (url: string, chromePath: string): Promise<string> => {
  const tmpDir = os.tmpdir();
  const uuid = randomUUID();
  const screenshotPath = path.join(tmpDir, `screenshot-${uuid}.png`);

  return new Promise((resolve, reject) => {
    const args = [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--window-size=1440,2200',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=5000',
      `--screenshot=${screenshotPath}`,
      url,
    ];

    execFile(chromePath, args, { timeout: 30_000 }, async (error) => {
      if (error) {
        return reject(error);
      }

      try {
        const screenshotData = await fs.readFile(screenshotPath);
        const base64Data = screenshotData.toString('base64');
        await fs.unlink(screenshotPath).catch(() => {});
        resolve(base64Data);
      } catch (readError) {
        reject(readError);
      }
    });
  });
};

export const screenshotHandler: AnalysisHandler<ScreenshotResult> = async (url, options) => {
  let targetUrl = url;

  if (!targetUrl) {
    return { error: 'URL is required', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'http://' + targetUrl;
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { error: 'URL provided is invalid', errorCode: 'INVALID_URL', errorCategory: 'tool' };
    }
  } catch {
    return { error: 'URL provided is invalid', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  if (targetUrl.includes('--')) {
    return { error: 'URL provided is invalid', errorCode: 'INVALID_URL', errorCategory: 'tool' };
  }

  const chromePath = options?.chromePath ?? '/usr/bin/chromium';

  let browser = null;
  try {
    // @ts-ignore puppeteer-core is an optional peer dependency
    const puppeteer = await import('puppeteer-core');
    browser = await puppeteer.default.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
      defaultViewport: { width: 1440, height: 900 },
      executablePath: chromePath,
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(15000);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 }).catch(() => {});
    await page.waitForNetworkIdle({ idleTime: 1000, timeout: 10000 }).catch(() => {});
    await page.addStyleTag({ content: '::-webkit-scrollbar { display: none !important; } html { scrollbar-width: none; -ms-overflow-style: none; }' });
    await page.evaluate(async () => {
      await document.fonts?.ready?.catch?.(() => {});
      const images = Array.from(document.images);
      await Promise.all(
        images.map(async (img) => {
          if (img.complete) return;
          await new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, 3000);
          });
        }),
      );
      window.scrollTo(0, 0);
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));

    await page.evaluate(() => {
      const element = document.querySelector('body');
      if (!element) {
        throw new Error('No body element found');
      }
    });

    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const base64Screenshot = Buffer.from(screenshotBuffer).toString('base64');

    return { data: { image: base64Screenshot } };
  } catch (error) {
    try {
      const base64Screenshot = await withTimeout(
        directChromiumScreenshot(targetUrl, chromePath),
        30_000,
      );
      return { data: { image: base64Screenshot } };
    } catch {
      return { error: `Screenshot unavailable: ${(error as Error).message}`, errorCategory: 'tool' };
    }
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
};
