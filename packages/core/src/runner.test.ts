import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runHandlers } from './runner.js';
import { registry, getHandlerNames } from './registry.js';

// We mock the registry so tests don't run real handlers
vi.mock('./registry.js', () => {
  const handlers: Record<string, { handler: Function; metadata: { name: string; description: string; category: string } }> = {};
  return {
    registry: handlers,
    getHandlerNames: () => Object.keys(handlers),
  };
});

function addMockHandler(name: string, fn: Function) {
  (registry as any)[name] = {
    handler: fn,
    metadata: { name, description: `mock ${name}`, category: 'test' },
  };
}

function clearMockHandlers() {
  for (const key of Object.keys(registry)) {
    delete (registry as any)[key];
  }
}

describe('runHandlers', () => {
  beforeEach(() => clearMockHandlers());
  afterEach(() => clearMockHandlers());

  it('returns results for all handlers', async () => {
    addMockHandler('a', async () => ({ data: 'result-a' }));
    addMockHandler('b', async () => ({ data: 'result-b' }));

    const results = await runHandlers('https://example.com', {});

    expect(results).toEqual({
      a: { data: 'result-a' },
      b: { data: 'result-b' },
    });
  });

  it('catches handler errors without crashing', async () => {
    addMockHandler('ok', async () => ({ data: 'fine' }));
    addMockHandler('broken', async () => { throw new Error('boom'); });

    const results = await runHandlers('https://example.com', {});

    expect(results['ok']).toEqual({ data: 'fine' });
    expect(results['broken']).toEqual({ error: 'Error: boom' });
  });

  it('runs only specified subset of handlers', async () => {
    addMockHandler('a', async () => ({ data: 'a' }));
    addMockHandler('b', async () => ({ data: 'b' }));
    addMockHandler('c', async () => ({ data: 'c' }));

    const results = await runHandlers('https://example.com', {}, { handlers: ['a', 'c'] });

    expect(Object.keys(results)).toEqual(['a', 'c']);
  });

  it('respects concurrency limit', async () => {
    let running = 0;
    let maxRunning = 0;

    const slowHandler = async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 50));
      running--;
      return { data: 'done' };
    };

    for (let i = 0; i < 10; i++) {
      addMockHandler(`h${i}`, slowHandler);
    }

    await runHandlers('https://example.com', {}, { concurrency: 3 });

    expect(maxRunning).toBeLessThanOrEqual(3);
    expect(maxRunning).toBeGreaterThan(1); // verify parallelism happened
  });

  it('passes handlerOpts to each handler', async () => {
    const spy = vi.fn(async () => ({ data: 'ok' }));
    addMockHandler('test', spy);

    const opts = { timeout: 5000, apiKeys: { MY_KEY: 'abc' } };
    await runHandlers('https://example.com', opts);

    expect(spy).toHaveBeenCalledWith('https://example.com', opts);
  });

  it('returns empty object when no handlers exist', async () => {
    const results = await runHandlers('https://example.com', {});
    expect(results).toEqual({});
  });
});
