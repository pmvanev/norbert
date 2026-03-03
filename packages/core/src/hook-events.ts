/**
 * Hook event types -- discriminated union for all 7 Claude Code hook event variants.
 *
 * These represent the raw events received from Claude Code's hook system.
 * The discriminant field is `eventType` which determines which fields are present.
 *
 * All types are readonly to enforce immutability throughout the domain.
 */

// ---------------------------------------------------------------------------
// Event Type Literals
// ---------------------------------------------------------------------------

export type EventType =
  | 'SessionStart'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'Stop';

// ---------------------------------------------------------------------------
// Base fields shared by all events
// ---------------------------------------------------------------------------

interface BaseEvent {
  readonly eventType: EventType;
  readonly sessionId: string;
  readonly timestamp: string;
}

// ---------------------------------------------------------------------------
// 7 Event Variants (Discriminated Union)
// ---------------------------------------------------------------------------

export interface SessionStartEvent extends BaseEvent {
  readonly eventType: 'SessionStart';
  readonly model: string;
}

export interface PreToolUseEvent extends BaseEvent {
  readonly eventType: 'PreToolUse';
  readonly toolName: string;
  readonly toolInput: Readonly<Record<string, unknown>>;
  readonly mcpServer?: string;
  readonly agentId?: string;
}

export interface PostToolUseEvent extends BaseEvent {
  readonly eventType: 'PostToolUse';
  readonly toolName: string;
  readonly toolOutput: Readonly<Record<string, unknown>>;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly mcpServer?: string;
}

export interface PostToolUseFailureEvent extends BaseEvent {
  readonly eventType: 'PostToolUseFailure';
  readonly toolName: string;
  readonly error: Readonly<Record<string, unknown>>;
  readonly mcpServer?: string;
}

export interface SubagentStartEvent extends BaseEvent {
  readonly eventType: 'SubagentStart';
  readonly agentId: string;
  readonly parentAgentId: string;
}

export interface SubagentStopEvent extends BaseEvent {
  readonly eventType: 'SubagentStop';
  readonly agentId: string;
}

export interface StopEvent extends BaseEvent {
  readonly eventType: 'Stop';
}

// ---------------------------------------------------------------------------
// Discriminated Union
// ---------------------------------------------------------------------------

export type HookEvent =
  | SessionStartEvent
  | PreToolUseEvent
  | PostToolUseEvent
  | PostToolUseFailureEvent
  | SubagentStartEvent
  | SubagentStopEvent
  | StopEvent;

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

export const isSessionStart = (event: HookEvent): event is SessionStartEvent =>
  event.eventType === 'SessionStart';

export const isPreToolUse = (event: HookEvent): event is PreToolUseEvent =>
  event.eventType === 'PreToolUse';

export const isPostToolUse = (event: HookEvent): event is PostToolUseEvent =>
  event.eventType === 'PostToolUse';

export const isPostToolUseFailure = (event: HookEvent): event is PostToolUseFailureEvent =>
  event.eventType === 'PostToolUseFailure';

export const isSubagentStart = (event: HookEvent): event is SubagentStartEvent =>
  event.eventType === 'SubagentStart';

export const isSubagentStop = (event: HookEvent): event is SubagentStopEvent =>
  event.eventType === 'SubagentStop';

export const isStop = (event: HookEvent): event is StopEvent =>
  event.eventType === 'Stop';

// ---------------------------------------------------------------------------
// Composite Guards
// ---------------------------------------------------------------------------

/** Tool-related events: PreToolUse, PostToolUse, PostToolUseFailure */
export type ToolEvent = PreToolUseEvent | PostToolUseEvent | PostToolUseFailureEvent;

export const isToolEvent = (event: HookEvent): event is ToolEvent =>
  event.eventType === 'PreToolUse' ||
  event.eventType === 'PostToolUse' ||
  event.eventType === 'PostToolUseFailure';

/** MCP events: tool events that have a defined mcpServer field */
export const isMcpEvent = (event: HookEvent): boolean =>
  isToolEvent(event) && event.mcpServer !== undefined && event.mcpServer !== null;
