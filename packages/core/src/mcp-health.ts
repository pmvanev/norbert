/**
 * MCP server health domain types -- health metrics per MCP server.
 *
 * Tracks call counts, error rates, latency, and token overhead
 * for each MCP server used in Claude Code sessions.
 *
 * All types are readonly to enforce immutability.
 */

// ---------------------------------------------------------------------------
// MCP Server Status
// ---------------------------------------------------------------------------

export type McpServerStatus = 'healthy' | 'degraded' | 'unhealthy';

// ---------------------------------------------------------------------------
// Error Timeline Entry
// ---------------------------------------------------------------------------

export interface McpErrorEntry {
  readonly timestamp: string;
  readonly toolName: string;
  readonly errorMessage: string;
}

// ---------------------------------------------------------------------------
// MCP Server Health
// ---------------------------------------------------------------------------

export interface McpServerHealth {
  readonly serverName: string;
  readonly status: McpServerStatus;
  readonly callCount: number;
  readonly errorCount: number;
  readonly avgLatencyMs: number;
  readonly tokenOverhead: number;
  readonly errorTimeline: readonly McpErrorEntry[];
}
