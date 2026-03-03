/**
 * Acceptance tests for hook installer.
 *
 * Tests:
 *   1. Writes 7 hook entries to a settings.json additively
 *   2. Preserves existing hooks (no data loss)
 *   3. Atomic: no partial state on failure
 *   4. Replaces existing Norbert hooks on re-install (no duplicates)
 *   5. Preserves unrecognized hook entries (forward compatibility)
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

  it('writes 7 hook entries to settings.json in matcher-based format', () => {
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
      expect(settings.hooks[hookType]).toHaveLength(1);

      const entry = settings.hooks[hookType][0];
      expect(entry.matcher).toBe('');
      expect(entry.hooks).toHaveLength(1);
      expect(entry.hooks[0].type).toBe('command');
      expect(entry.hooks[0].command).toContain('/api/events');
    }
  });

  it('preserves existing hooks when installing', () => {
    const existingSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'echo "existing hook"' }],
          },
        ],
      },
      someOtherSetting: true,
    };
    writeFileSync(settingsPath, JSON.stringify(existingSettings));

    installHooks(settingsPath, 7777);

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    // Existing hook preserved + Norbert hook added
    expect(settings.hooks.PreToolUse.length).toBe(2);
    expect(settings.hooks.PreToolUse[0].matcher).toBe('Bash');
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toBe('echo "existing hook"');

    // Norbert hook appended
    expect(settings.hooks.PreToolUse[1].hooks[0].command).toContain('/api/events');

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

  it('replaces existing Norbert hook on re-install (no duplicates)', () => {
    writeFileSync(settingsPath, JSON.stringify({}));

    // Install twice
    installHooks(settingsPath, 7777);
    installHooks(settingsPath, 8888);

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    // Should have exactly 1 entry per hook type, not 2
    for (const hookType of Object.keys(settings.hooks)) {
      expect(settings.hooks[hookType]).toHaveLength(1);
      // Should be the second install's port
      expect(settings.hooks[hookType][0].hooks[0].command).toContain('localhost:8888');
    }
  });

  it('preserves unrecognized hook entries (forward compatibility)', () => {
    const existingSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: 'some-other-tool --check' }],
          },
        ],
        SomeNewHookType: [
          {
            matcher: '',
            hooks: [{ type: 'command', command: 'future-hook-handler' }],
          },
        ],
      },
    };
    writeFileSync(settingsPath, JSON.stringify(existingSettings));

    installHooks(settingsPath, 7777);

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    // Unrecognized hook type preserved
    expect(settings.hooks.SomeNewHookType).toBeDefined();
    expect(settings.hooks.SomeNewHookType[0].hooks[0].command).toBe('future-hook-handler');

    // Non-Norbert entry in PreToolUse preserved
    const preToolEntries = settings.hooks.PreToolUse;
    const otherToolEntry = preToolEntries.find(
      (e: { hooks: { command: string }[] }) => e.hooks[0].command === 'some-other-tool --check'
    );
    expect(otherToolEntry).toBeDefined();
  });
});
