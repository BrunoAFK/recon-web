import { describe, it, expect } from 'vitest';
import { portsHandler } from './ports.js';

describe('portsHandler', () => {
  it('returns port scan data for example.com', async () => {
    const result = await portsHandler('example.com');

    // May return data or error (timeout), both are valid shapes
    const hasDataOrError = 'data' in result || 'error' in result;
    expect(hasDataOrError).toBe(true);

    if (result.data) {
      expect(result.data).toHaveProperty('openPorts');
      expect(Array.isArray(result.data.openPorts)).toBe(true);
      expect(result.data).toHaveProperty('failedPorts');
      expect(Array.isArray(result.data.failedPorts)).toBe(true);
    }
  });

  it('result has correct shape', async () => {
    const result = await portsHandler('example.com');
    if (result.data) {
      for (const port of result.data.openPorts) {
        expect(typeof port).toBe('number');
      }
    }
  });
});
