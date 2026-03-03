/**
 * norbert init command -- installs hook scripts and optionally starts server.
 *
 * Writes 7 hook entries to .claude/settings.json additively.
 * Atomic: no partial state on failure.
 */

import { join } from 'path';
import { homedir } from 'os';
import { installHooks, type InstallResult } from '@norbert/hooks';
import { DEFAULT_CONFIG } from '@norbert/config';

// ---------------------------------------------------------------------------
// Default settings path
// ---------------------------------------------------------------------------

const defaultSettingsPath = (): string =>
  join(homedir(), '.claude', 'settings.json');

// ---------------------------------------------------------------------------
// Init command handler
// ---------------------------------------------------------------------------

export interface InitOptions {
  readonly settingsPath?: string;
  readonly port?: number;
}

export const runInit = (options: InitOptions = {}): InstallResult => {
  const settingsPath = options.settingsPath ?? defaultSettingsPath();
  const port = options.port ?? DEFAULT_CONFIG.port;

  return installHooks(settingsPath, port);
};
