/**
 * @norbert/config -- Configuration loading and validation.
 *
 * Independent module. No dependencies on other @norbert/* packages.
 * Provides default configuration values and a factory function.
 */

import { join } from 'path';
import { homedir } from 'os';

// ---------------------------------------------------------------------------
// Config type
// ---------------------------------------------------------------------------

export interface NorbertConfig {
  readonly port: number;
  readonly dbPath: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: NorbertConfig = {
  port: 7777,
  dbPath: join(homedir(), '.norbert', 'norbert.db'),
};

// ---------------------------------------------------------------------------
// Config factory
// ---------------------------------------------------------------------------

export const createConfig = (
  overrides: Partial<NorbertConfig>
): NorbertConfig => ({
  port: overrides.port ?? DEFAULT_CONFIG.port,
  dbPath: overrides.dbPath ?? DEFAULT_CONFIG.dbPath,
});
