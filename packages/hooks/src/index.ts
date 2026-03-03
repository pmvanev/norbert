/**
 * @norbert/hooks -- Hook script templates.
 *
 * Depends on: @norbert/config (for server URL and port)
 * Exports: Hook installer, template generators, and hook event types.
 */

export type { HookCommand, MatcherEntry, HookConfig, HookEventType } from './templates.js';
export { generateHookEntries, HOOK_EVENT_TYPES } from './templates.js';
export type { InstallResult } from './installer.js';
export { installHooks } from './installer.js';
