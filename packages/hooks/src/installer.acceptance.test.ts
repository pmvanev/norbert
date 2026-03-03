/**
 * Acceptance tests for hook installer.
 *
 * Tests:
 *   1. Writes 7 hook entries to a settings.json additively
 *   2. Preserves existing hooks (no data loss)
 *   3. Atomic: no partial state on failure
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { installHooks } from './installer.js';

describe('Hook installer acceptance', () => {
  let tempDir: string;
  let settingsPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'norbert-test-'));
    settingsPath = join(tempDir, 'settings.json');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes 7 hook entries to settings.json additively', () => {
    // Start with empty settings
    writeFileSync(settingsPath, JSON.stringify({}));

    const result = installHooks(settingsPath, 7777);

    expect(result.ok).toBe(true);

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks).toBeDefined();

    // All 7 hook event types must be present
    const expectedTypes = [
      'PreToolUse',
      'PostToolUse',
      'PostToolUseFailure',
      'SubagentStart',
      'SubagentStop',
      'SessionStart',
      'Stop',
    ];

    for (const hookType of expectedTypes) {
      expect(settings.hooks[hookType]).toBeDefined();
      expect(settings.hooks[hookType].length).toBeGreaterThanOrEqual(1);
    }
  });

  it('preserves existing hooks when installing', () => {
    const existingSettings = {
      hooks: {
        PreToolUse: [
          {
            type: 'command',
            command: 'echo "existing hook"',
          },
        ],
      },
      someOtherSetting: true,
    };
    writeFileSync(settingsPath, JSON.stringify(existingSettings));

    installHooks(settingsPath, 7777);

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    // Existing hook preserved
    expect(settings.hooks.PreToolUse.length).toBeGreaterThanOrEqual(2);
    expect(settings.hooks.PreToolUse[0].command).toBe('echo "existing hook"');

    // Other settings preserved
    expect(settings.someOtherSetting).toBe(true);
  });

  it('creates settings.json if it does not exist', () => {
    expect(existsSync(settingsPath)).toBe(false);

    const result = installHooks(settingsPath, 7777);

    expect(result.ok).toBe(true);
    expect(existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    expect(settings.hooks).toBeDefined();
  });

  it('is atomic: no partial state on failure', () => {
    // Create a file where the "directory" would be -- making mkdirSync fail
    // because it cannot create a directory over an existing file.
    const blocker = join(tempDir, 'blocker');
    writeFileSync(blocker, 'I am a file, not a directory');
    const badPath = join(blocker, 'nested', 'settings.json');

    const result = installHooks(badPath, 7777);

    expect(result.ok).toBe(false);

    // The blocker file is unchanged (no partial writes)
    const content = readFileSync(blocker, 'utf-8');
    expect(content).toBe('I am a file, not a directory');
  });
});
