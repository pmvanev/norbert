/**
 * Unit tests for hook template generation.
 *
 * Tests that hook scripts are generated correctly for all 7 event types,
 * and that they target the correct server URL and port.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateHookEntries, HOOK_EVENT_TYPES } from './templates.js';

describe('Hook template generation', () => {
  it('generates entries for all 7 hook event types', () => {
    const entries = generateHookEntries(7777);
    expect(Object.keys(entries)).toHaveLength(7);

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
      expect(entries[hookType]).toBeDefined();
      expect(entries[hookType]).toHaveLength(1);
      expect(entries[hookType][0].matcher).toBe('');
      expect(entries[hookType][0].hooks[0].type).toBe('command');
    }
  });

  it('includes correct port in curl command', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1024, max: 65535 }),
        (port) => {
          const entries = generateHookEntries(port);
          for (const hookType of Object.keys(entries)) {
            const command = entries[hookType][0].hooks[0].command;
            expect(command).toContain(`localhost:${port}`);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  it('generates fire-and-forget curl commands (background execution)', () => {
    const entries = generateHookEntries(7777);
    for (const hookType of Object.keys(entries)) {
      const command = entries[hookType][0].hooks[0].command;
      // Should use curl with -s (silent) and run in background (&)
      expect(command).toContain('curl');
      expect(command).toContain('-s');
    }
  });

  it('targets POST /api/events endpoint', () => {
    const entries = generateHookEntries(7777);
    for (const hookType of Object.keys(entries)) {
      const command = entries[hookType][0].hooks[0].command;
      expect(command).toContain('/api/events');
      expect(command).toContain('POST');
    }
  });

  it('exports all 7 hook event type names', () => {
    expect(HOOK_EVENT_TYPES).toHaveLength(7);
  });

  it('produces entries matching Claude Code matcher-based schema', () => {
    const entries = generateHookEntries(7777);

    for (const hookType of Object.keys(entries)) {
      const entryList = entries[hookType];
      expect(entryList).toHaveLength(1);

      const entry = entryList[0];
      // Each entry has exactly {matcher, hooks}
      expect(Object.keys(entry).sort()).toEqual(['hooks', 'matcher']);
      expect(typeof entry.matcher).toBe('string');
      expect(Array.isArray(entry.hooks)).toBe(true);

      // Each hook has exactly {type, command}
      const hook = entry.hooks[0];
      expect(Object.keys(hook).sort()).toEqual(['command', 'type']);
      expect(hook.type).toBe('command');
      expect(typeof hook.command).toBe('string');
    }
  });
});
