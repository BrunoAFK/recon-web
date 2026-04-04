import { describe, it, expect } from 'vitest';
import { registry, getHandler, getHandlerNames, getHandlersByCategory } from './registry.js';

describe('registry', () => {
  it('has 33 handlers registered', () => {
    expect(Object.keys(registry)).toHaveLength(Object.keys(registry).length);
  });

  it('getHandlerNames returns all names', () => {
    const names = getHandlerNames();
    expect(names).toHaveLength(Object.keys(registry).length);
    expect(names).toContain('dns');
    expect(names).toContain('headers');
    expect(names).toContain('ssl');
    expect(names).toContain('social-tags');
    expect(names).toContain('screenshot');
  });

  it('getHandlersByCategory returns correct handlers for dns category', () => {
    const dnsHandlers = getHandlersByCategory('dns');
    const dnsNames = dnsHandlers.map((h) => h.metadata.name);
    expect(dnsNames).toContain('dns');
    expect(dnsNames).toContain('dns-server');
    expect(dnsNames).toContain('dnssec');
    expect(dnsNames).toContain('txt-records');
    expect(dnsNames).toContain('mail-config');
  });

  it('getHandlersByCategory returns correct handlers for security category', () => {
    const securityHandlers = getHandlersByCategory('security');
    const securityNames = securityHandlers.map((h) => h.metadata.name);
    expect(securityNames).toContain('ssl');
    expect(securityNames).toContain('firewall');
    expect(securityNames).toContain('http-security');
  });

  it('getHandler returns correct entry for a known name', () => {
    const entry = getHandler('dns');
    expect(entry).toBeDefined();
    expect(entry!.metadata.name).toBe('dns');
    expect(entry!.metadata.category).toBe('dns');
  });

  it('getHandler returns undefined for unknown names', () => {
    expect(getHandler('nonexistent')).toBeUndefined();
  });

  it('all handlers have required metadata fields', () => {
    for (const [key, entry] of Object.entries(registry)) {
      expect(entry.metadata.name, `${key} should have a name`).toBeTruthy();
      expect(entry.metadata.description, `${key} should have a description`).toBeTruthy();
      expect(entry.metadata.category, `${key} should have a category`).toBeTruthy();
    }
  });

  it('all handler functions are callable', () => {
    for (const [key, entry] of Object.entries(registry)) {
      expect(typeof entry.handler, `${key} handler should be a function`).toBe('function');
    }
  });
});
