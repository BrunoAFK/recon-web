import { describe, it, expect } from 'vitest';
import {
  formatCategoryBadge,
  formatHandlerResult,
  formatHeader,
  formatSummary,
} from './formatter.js';
import type { HandlerMetadata, HandlerResult } from '@recon-web/core';

const makeMeta = (overrides: Partial<HandlerMetadata> = {}): HandlerMetadata => ({
  name: 'test-handler',
  description: 'A test handler',
  category: 'dns',
  ...overrides,
});

describe('formatCategoryBadge', () => {
  it('returns a string containing the category name', () => {
    const badge = formatCategoryBadge('dns');
    expect(badge).toContain('dns');
  });

  it('returns a string containing the category name for unknown categories', () => {
    const badge = formatCategoryBadge('unknown-category');
    expect(badge).toContain('unknown-category');
  });
});

describe('formatHandlerResult', () => {
  it('with successful result contains checkmark', () => {
    const result: HandlerResult = { data: { foo: 'bar' } };
    const output = formatHandlerResult('test-handler', makeMeta(), result, false);
    expect(output).toContain('✓');
  });

  it('with error result contains the error message', () => {
    const result: HandlerResult = { error: 'Something went wrong' };
    const output = formatHandlerResult('test-handler', makeMeta(), result, false);
    expect(output).toContain('Something went wrong');
    expect(output).toContain('✗');
  });

  it('with skipped result contains skip indicator', () => {
    const result: HandlerResult = { skipped: 'Missing API key' };
    const output = formatHandlerResult('test-handler', makeMeta(), result, false);
    expect(output).toContain('⊘');
    expect(output).toContain('Missing API key');
  });

  describe('handler-specific summaries', () => {
    it('dns summary shows "records" text', () => {
      const result: HandlerResult = {
        data: {
          A: ['1.2.3.4', '5.6.7.8'],
          MX: [{ priority: 10, exchange: 'mail.example.com' }],
        },
      };
      const output = formatHandlerResult('dns', makeMeta({ name: 'dns' }), result, false);
      expect(output).toContain('records');
    });

    it('get-ip summary shows IP address', () => {
      const result: HandlerResult = {
        data: { ip: '93.184.216.34', family: 4 },
      };
      const output = formatHandlerResult('get-ip', makeMeta({ name: 'get-ip', category: 'network' }), result, false);
      expect(output).toContain('93.184.216.34');
    });
  });
});

describe('formatHeader', () => {
  it('contains the URL', () => {
    const header = formatHeader('https://example.com');
    expect(header).toContain('https://example.com');
  });

  it('contains recon-web branding', () => {
    const header = formatHeader('https://example.com');
    expect(header).toContain('recon-web');
  });
});

describe('formatSummary', () => {
  it('contains pass and fail counts', () => {
    const summary = formatSummary(10, 8, 2, 0, 5000);
    expect(summary).toContain('8 passed');
    expect(summary).toContain('2 failed');
  });

  it('contains duration in seconds', () => {
    const summary = formatSummary(10, 8, 2, 0, 5000);
    expect(summary).toContain('5.0s');
  });

  it('contains total count', () => {
    const summary = formatSummary(10, 8, 2, 0, 5000);
    expect(summary).toContain('10 total');
  });

  it('contains skipped count when there are skipped handlers', () => {
    const summary = formatSummary(10, 7, 1, 2, 3000);
    expect(summary).toContain('2 skipped');
  });
});
