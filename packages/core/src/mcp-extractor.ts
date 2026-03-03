/**
 * MCP event extractor -- pure function: tool events -> MCP event record.
 *
 * Extracts MCP attribution data (server name, tool name, status) from
 * PostToolUse and PostToolUseFailure events that have an mcpServer field.
 * Returns null for built-in tool events (no MCP attribution).
 *
 * This module has zero side effects and zero dependencies beyond this package.
 */

import type { PostToolUseEvent, PostToolUseFailureEvent } from './hook-events.js';

// ---------------------------------------------------------------------------
// MCP Event Record (output type)
// ---------------------------------------------------------------------------

export interface McpEventRecord {
  readonly serverName: string;
  readonly toolName: string;
  readonly eventType: 'PostToolUse' | 'PostToolUseFailure';
  readonly timestamp: string;
  readonly sessionId: string;
  readonly status: 'success' | 'error';
  readonly errorDetail: string | undefined;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

// ---------------------------------------------------------------------------
// Extraction functions
// ---------------------------------------------------------------------------

const extractFromPostToolUse = (event: PostToolUseEvent): McpEventRecord => ({
  serverName: event.mcpServer!,
  toolName: event.toolName,
  eventType: 'PostToolUse',
  timestamp: event.timestamp,
  sessionId: event.sessionId,
  status: 'success',
  errorDetail: undefined,
  inputTokens: event.inputTokens ?? 0,
  outputTokens: event.outputTokens ?? 0,
});

const extractFromPostToolUseFailure = (event: PostToolUseFailureEvent): McpEventRecord => ({
  serverName: event.mcpServer!,
  toolName: event.toolName,
  eventType: 'PostToolUseFailure',
  timestamp: event.timestamp,
  sessionId: event.sessionId,
  status: 'error',
  errorDetail: typeof event.error.message === 'string' ? event.error.message : undefined,
  inputTokens: 0,
  outputTokens: 0,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract an MCP event record from a PostToolUse or PostToolUseFailure event.
 *
 * Pure function: no side effects.
 * Returns null if the event is for a built-in tool (no mcpServer field).
 */
export const extractMcpEvent = (
  event: PostToolUseEvent | PostToolUseFailureEvent
): McpEventRecord | null => {
  if (event.mcpServer == null) {
    return null;
  }

  switch (event.eventType) {
    case 'PostToolUse':
      return extractFromPostToolUse(event);
    case 'PostToolUseFailure':
      return extractFromPostToolUseFailure(event);
  }
};
