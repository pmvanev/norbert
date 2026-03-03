/**
 * Hook installer -- atomically installs Norbert hook entries into .claude/settings.json.
 *
 * Additive: preserves existing hooks and settings.
 * Atomic: writes to temp file, then renames (no partial state on failure).
 */

import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { generateHookEntries, type MatcherEntry } from './templates.js';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type InstallResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

// ---------------------------------------------------------------------------
// Settings file shape
// ---------------------------------------------------------------------------

interface SettingsFile {
  hooks?: Record<string, MatcherEntry[]>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Read existing settings
// ---------------------------------------------------------------------------

const readExistingSettings = (settingsPath: string): SettingsFile => {
  if (!existsSync(settingsPath)) {
    return {};
  }
  try {
    const content = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as SettingsFile;
  } catch {
    return {};
  }
};

// ---------------------------------------------------------------------------
// Norbert entry detection
// ---------------------------------------------------------------------------

const isNorbertEntry = (entry: MatcherEntry): boolean =>
  entry.hooks.some((h) => h.command.includes('/api/events'));

// ---------------------------------------------------------------------------
// Merge hooks with dedup
// ---------------------------------------------------------------------------

const mergeHooks = (
  existing: Record<string, MatcherEntry[]> | undefined,
  newEntries: Record<string, readonly MatcherEntry[]>
): Record<string, MatcherEntry[]> => {
  const merged: Record<string, MatcherEntry[]> = {};

  // Copy existing hooks, filtering out old Norbert entries
  if (existing) {
    for (const [key, entries] of Object.entries(existing)) {
      merged[key] = entries.filter((e) => !isNorbertEntry(e));
    }
  }

  // Append new hook entries
  for (const [key, entries] of Object.entries(newEntries)) {
    if (!merged[key]) {
      merged[key] = [];
    }
    merged[key].push(...entries);
  }

  return merged;
};

// ---------------------------------------------------------------------------
// Atomic write: temp file + rename
// ---------------------------------------------------------------------------

const writeAtomic = (filePath: string, content: string): void => {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });

  const tempPath = join(dir, `.settings.tmp.${Date.now()}`);
  try {
    writeFileSync(tempPath, content, 'utf-8');
    renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file on failure
    try {
      unlinkSync(tempPath);
    } catch {
      // Temp file may not exist if writeFileSync failed
    }
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Install Norbert hook entries into settings.json.
 *
 * Additive: preserves existing hooks and other settings.
 * Atomic: no partial state on failure.
 */
export const installHooks = (
  settingsPath: string,
  port: number
): InstallResult => {
  try {
    const existingSettings = readExistingSettings(settingsPath);
    const newHookEntries = generateHookEntries(port);
    const mergedHooks = mergeHooks(existingSettings.hooks, newHookEntries);

    const updatedSettings: SettingsFile = {
      ...existingSettings,
      hooks: mergedHooks,
    };

    const content = JSON.stringify(updatedSettings, null, 2);
    writeAtomic(settingsPath, content);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
};
