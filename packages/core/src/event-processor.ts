/**
 * Event processor -- pure function transforming raw JSON to validated HookEvent.
 *
 * Converts snake_case API fields to camelCase domain fields.
 * Returns a Result type: { ok: true, event } or { ok: false, error }.
 *
 * This module has zero side effects and zero dependencies beyond this package.
 */

import type {
  HookEvent,
  EventType,
  SessionStartEvent,
  PreToolUseEvent,
  PostToolUseEvent,
  PostToolUseFailureEvent,
  SubagentStartEvent,
  SubagentStopEvent,
  StopEvent,
} from './hook-events.js';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ProcessResult =
  | { readonly ok: true; readonly event: HookEvent }
  | { readonly ok: false; readonly error: string };

// ---------------------------------------------------------------------------
// Valid event types
// ---------------------------------------------------------------------------

const VALID_EVENT_TYPES: ReadonlySet<string> = new Set([
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'Stop',
]);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const validateRequiredFields = (
  raw: Record<string, unknown>
): string | null => {
  const missing: string[] = [];

  if (typeof raw.event_type !== 'string' || raw.event_type === '') {
    missing.push('event_type');
  }
  if (typeof raw.session_id !== 'string' || raw.session_id === '') {
    missing.push('session_id');
  }
  if (typeof raw.timestamp !== 'string' || raw.timestamp === '') {
    missing.push('timestamp');
  }

  if (missing.length > 0) {
    return `Missing or invalid required fields: ${missing.join(', ')}`;
  }

  if (!VALID_EVENT_TYPES.has(raw.event_type as string)) {
    return `Invalid event_type: ${String(raw.event_type)}. Expected one of: ${[...VALID_EVENT_TYPES].join(', ')}`;
  }

  return null;
};

// ---------------------------------------------------------------------------
// Mapping: raw snake_case -> domain camelCase
// ---------------------------------------------------------------------------

const mapSessionStart = (raw: Record<string, unknown>): SessionStartEvent => ({
  eventType: 'SessionStart',
  sessionId: raw.session_id as string,
  timestamp: raw.timestamp as string,
  model: typeof raw.model === 'string' ? raw.model : '',
});

const mapPreToolUse = (raw: Record<string, unknown>): PreToolUseEvent => ({
  eventType: 'PreToolUse',
  sessionId: raw.session_id as string,
  timestamp: raw.timestamp as string,
  toolName: typeof raw.tool_name === 'string' ? raw.tool_name : '',
  toolInput: (typeof raw.tool_input === 'object' && raw.tool_input !== null
    ? raw.tool_input
    : {}) as Record<string, unknown>,
  ...(typeof raw.mcp_server === 'string' ? { mcpServer: raw.mcp_server } : {}),
  ...(typeof raw.agent_id === 'string' ? { agentId: raw.agent_id } : {}),
});

const mapPostToolUse = (raw: Record<string, unknown>): PostToolUseEvent => ({
  eventType: 'PostToolUse',
  sessionId: raw.session_id as string,
  timestamp: raw.timestamp as string,
  toolName: typeof raw.tool_name === 'string' ? raw.tool_name : '',
  toolOutput: (typeof raw.tool_output === 'object' && raw.tool_output !== null
    ? raw.tool_output
    : {}) as Record<string, unknown>,
  ...(typeof raw.input_tokens === 'number' ? { inputTokens: raw.input_tokens } : {}),
  ...(typeof raw.output_tokens === 'number' ? { outputTokens: raw.output_tokens } : {}),
  ...(typeof raw.mcp_server === 'string' ? { mcpServer: raw.mcp_server } : {}),
});

const mapPostToolUseFailure = (raw: Record<string, unknown>): PostToolUseFailureEvent => ({
  eventType: 'PostToolUseFailure',
  sessionId: raw.session_id as string,
  timestamp: raw.timestamp as string,
  toolName: typeof raw.tool_name === 'string' ? raw.tool_name : '',
  error: (typeof raw.error === 'object' && raw.error !== null
    ? raw.error
    : {}) as Record<string, unknown>,
  ...(typeof raw.mcp_server === 'string' ? { mcpServer: raw.mcp_server } : {}),
});

const mapSubagentStart = (raw: Record<string, unknown>): SubagentStartEvent => ({
  eventType: 'SubagentStart',
  sessionId: raw.session_id as string,
  timestamp: raw.timestamp as string,
  agentId: typeof raw.agent_id === 'string' ? raw.agent_id : '',
  parentAgentId: typeof raw.parent_agent_id === 'string' ? raw.parent_agent_id : '',
});

const mapSubagentStop = (raw: Record<string, unknown>): SubagentStopEvent => ({
  eventType: 'SubagentStop',
  sessionId: raw.session_id as string,
  timestamp: raw.timestamp as string,
  agentId: typeof raw.agent_id === 'string' ? raw.agent_id : '',
});

const mapStop = (raw: Record<string, unknown>): StopEvent => ({
  eventType: 'Stop',
  sessionId: raw.session_id as string,
  timestamp: raw.timestamp as string,
});

const mapRawToEvent = (raw: Record<string, unknown>): HookEvent => {
  const eventType = raw.event_type as EventType;

  switch (eventType) {
    case 'SessionStart': return mapSessionStart(raw);
    case 'PreToolUse': return mapPreToolUse(raw);
    case 'PostToolUse': return mapPostToolUse(raw);
    case 'PostToolUseFailure': return mapPostToolUseFailure(raw);
    case 'SubagentStart': return mapSubagentStart(raw);
    case 'SubagentStop': return mapSubagentStop(raw);
    case 'Stop': return mapStop(raw);
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process a raw JSON payload into a validated HookEvent.
 *
 * Pure function: no side effects.
 * Converts snake_case API fields to camelCase domain fields.
 */
export const processRawEvent = (
  raw: Record<string, unknown>
): ProcessResult => {
  const validationError = validateRequiredFields(raw);
  if (validationError !== null) {
    return { ok: false, error: validationError };
  }

  const event = mapRawToEvent(raw);
  return { ok: true, event };
};
