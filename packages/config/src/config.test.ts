/**
 * Unit tests for config package.
 *
 * Tests default config values and config loading.
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, createConfig } from './index.js';
import type { NorbertConfig } from './index.js';

describe('Config', () => {
  it('provides sensible defaults', () => {
    expect(DEFAULT_CONFIG.port).toBe(7777);
    expect(DEFAULT_CONFIG.dbPath).toContain('norbert');
  });

  it('createConfig uses defaults when no overrides provided', () => {
    const config = createConfig({});
    expect(config.port).toBe(7777);
  });

  it('createConfig allows port override', () => {
    const config = createConfig({ port: 8888 });
    expect(config.port).toBe(8888);
  });

  it('createConfig allows dbPath override', () => {
    const config = createConfig({ dbPath: '/custom/path.db' });
    expect(config.dbPath).toBe('/custom/path.db');
  });
});
