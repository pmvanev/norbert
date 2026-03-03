/**
 * Hook script templates -- generates Claude Code hook entries for settings.json.
 *
 * Each hook is a shell one-liner using curl to POST event data to the Norbert server.
 * Hooks are fire-and-forget (background execution with &).
 */

// ---------------------------------------------------------------------------
// Hook event types (all 7 Claude Code hook points)
// ---------------------------------------------------------------------------

export const HOOK_EVENT_TYPES = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'SessionStart',
  'Stop',
] as const;

export type HookEventType = (typeof HOOK_EVENT_TYPES)[number];

// ---------------------------------------------------------------------------
// Hook entry shape (matches .claude/settings.json format)
// ---------------------------------------------------------------------------

export interface HookEntry {
  readonly type: 'command';
  readonly command: string;
}

export type HookEntries = Record<string, readonly HookEntry[]>;

// ---------------------------------------------------------------------------
// Template generation
// ---------------------------------------------------------------------------

const generateCurlCommand = (port: number): string =>
  `curl -s -X POST http://localhost:${port}/api/events -H 'Content-Type: application/json' -d '$CLAUDE_EVENT' &`;

/**
 * Generate hook entries for all 7 event types targeting the given port.
 *
 * Each entry is a fire-and-forget curl command posting event data to the server.
 */
export const generateHookEntries = (port: number): HookEntries => {
  const command = generateCurlCommand(port);
  const entries: Record<string, HookEntry[]> = {};

  for (const hookType of HOOK_EVENT_TYPES) {
    entries[hookType] = [{ type: 'command', command }];
  }

  return entries;
};
