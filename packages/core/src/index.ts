/**
 * @norbert/core -- Pure domain types and functions.
 *
 * This package has zero runtime dependencies.
 * All types are readonly (immutable domain).
 * No imports from other @norbert/* packages.
 * No imports from Node.js built-ins or npm packages.
 */

// Hook Events (discriminated union)
export type {
  EventType,
  HookEvent,
  SessionStartEvent,
  PreToolUseEvent,
  PostToolUseEvent,
  PostToolUseFailureEvent,
  SubagentStartEvent,
  SubagentStopEvent,
  StopEvent,
  ToolEvent,
} from './hook-events.js';

export {
  isSessionStart,
  isPreToolUse,
  isPostToolUse,
  isPostToolUseFailure,
  isSubagentStart,
  isSubagentStop,
  isStop,
  isToolEvent,
  isMcpEvent,
} from './hook-events.js';

// Session
export type {
  Session,
  SessionStatus,
  SessionFilter,
  SortField,
  SortOrder,
  DateRange,
  NumberRange,
  OverviewSummary,
} from './session.js';

// Trace Graph
export type {
  AgentNode,
  AgentStatus,
  TraceGraph,
  TraceEdge,
} from './trace.js';

// MCP Health
export type {
  McpServerHealth,
  McpServerStatus,
  McpErrorEntry,
} from './mcp-health.js';

// Cost
export type {
  CostRate,
  CostBreakdown,
  AgentCostEntry,
  McpCostEntry,
  ComparisonResult,
  SessionDelta,
} from './cost.js';

export { COST_RATES, getCostRate } from './cost.js';

// Event Processor (pure transformation: raw JSON -> HookEvent)
export type { ProcessResult } from './event-processor.js';
export { processRawEvent } from './event-processor.js';

// Cost Calculator (pure function: tokens + model -> cost estimate)
export { estimateCost } from './cost-calculator.js';

// MCP Extractor (pure function: tool event -> MCP event record)
export type { McpEventRecord } from './mcp-extractor.js';
export { extractMcpEvent } from './mcp-extractor.js';

// Session Aggregator (pure function: event + session -> session update)
export type { SessionUpdate, SessionDelta } from './session-aggregator.js';
export { computeSessionUpdate } from './session-aggregator.js';

// Agent Tree (pure function: event -> agent span update)
export type { AgentSpanUpdate, AgentSpan } from './agent-tree.js';
export { computeAgentSpanUpdate } from './agent-tree.js';
