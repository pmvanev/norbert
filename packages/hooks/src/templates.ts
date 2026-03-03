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
// Hook entry shape (matches Claude Code's matcher-based settings.json format)
// ---------------------------------------------------------------------------

export interface HookCommand {
  readonly type: 'command';
  readonly command: string;
}

export interface MatcherEntry {
  readonly matcher: string;
  readonly hooks: readonly HookCommand[];
}

export type HookConfig = Record<string, readonly MatcherEntry[]>;

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
export const generateHookEntries = (port: number): HookConfig => {
  const command = generateCurlCommand(port);
  const entries: Record<string, MatcherEntry[]> = {};

  for (const hookType of HOOK_EVENT_TYPES) {
    entries[hookType] = [{ matcher: '', hooks: [{ type: 'command', command }] }];
  }

  return entries;
};
