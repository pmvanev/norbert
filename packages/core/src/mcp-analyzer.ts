/**
 * MCP analyzer -- pure functions for MCP health analysis and diagnostics.
 *
 * Analyzes MCP server health from event data:
 *   - Error categorization (connection/timeout/registration/silent_drop/unknown)
 *   - Diagnostic recommendations per error category
 *   - Latency degradation detection using linear regression slope
 *   - Connection status inference from recent event patterns
 *   - Full per-server analysis composition
 *
 * This module has zero side effects and zero dependencies beyond this package.
 */

import type { McpServerHealth, McpErrorEntry } from './mcp-health.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type McpErrorCategory =
  | 'connection'
  | 'timeout'
  | 'registration'
  | 'silent_drop'
  | 'unknown';

export interface McpDiagnostic {
  readonly category: McpErrorCategory;
  readonly recommendation: string;
}

export interface McpToolCallEntry {
  readonly serverName: string;
  readonly toolName: string;
  readonly timestamp: string;
  readonly latencyMs: number | null;
  readonly status: 'success' | 'error';
  readonly errorDetail?: string;
}

export interface McpErrorCategoryCount {
  readonly category: McpErrorCategory;
  readonly count: number;
}

export interface McpServerDetail {
  readonly serverName: string;
  readonly connectionStatus: 'connected' | 'disconnected' | 'error';
  readonly health: McpServerHealth;
  readonly errorsByCategory: readonly McpErrorCategoryCount[];
  readonly diagnostics: readonly McpDiagnostic[];
  readonly latencyTrend: 'stable' | 'degrading' | 'improving';
  readonly recentCalls: readonly McpToolCallEntry[];
}

export interface McpAnalysis {
  readonly servers: readonly McpServerDetail[];
  readonly hasServers: boolean;
}

// ---------------------------------------------------------------------------
// Error categorization
// ---------------------------------------------------------------------------

const CONNECTION_PATTERNS = [
  /econnrefused/i,
  /econnreset/i,
  /ehostunreach/i,
  /connection refused/i,
  /connection reset/i,
  /socket hang up/i,
  /connect\s+e/i,
];

const TIMEOUT_PATTERNS = [
  /timed?\s*out/i,
  /etimedout/i,
  /deadline exceeded/i,
  /timeout/i,
];

const REGISTRATION_PATTERNS = [
  /tool not found/i,
  /method not found/i,
  /not support/i,
  /unknown tool/i,
  /unregistered/i,
];

const SILENT_DROP_PATTERNS = [
  /no response/i,
  /empty response/i,
  /closed connection without/i,
  /without response/i,
];

/**
 * Classify an error message into one of 5 error categories.
 *
 * Pure function: no side effects.
 */
export const categorizeMcpError = (errorMessage: string): McpErrorCategory => {
  if (CONNECTION_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'connection';
  }
  if (TIMEOUT_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'timeout';
  }
  if (REGISTRATION_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'registration';
  }
  if (SILENT_DROP_PATTERNS.some((pattern) => pattern.test(errorMessage))) {
    return 'silent_drop';
  }
  return 'unknown';
};

// ---------------------------------------------------------------------------
// Diagnostic recommendations
// ---------------------------------------------------------------------------

const DIAGNOSTIC_RECOMMENDATIONS: Readonly<Record<McpErrorCategory, string>> = {
  connection: 'Check that the MCP server process is running and accessible on the expected host and port.',
  timeout: 'The MCP server is reachable but responding too slowly. Consider increasing timeout limits or investigating server load.',
  registration: 'The requested tool is not registered on the MCP server. Verify the tool name and ensure the server supports it.',
  silent_drop: 'The MCP server accepted the connection but did not send a response. Check server logs for crashes or resource exhaustion.',
  unknown: 'An unexpected error occurred. Check the MCP server logs for details.',
};

/**
 * Get a human-readable diagnostic recommendation for an error category.
 *
 * Pure function: no side effects.
 */
export const getDiagnosticRecommendation = (category: McpErrorCategory): string =>
  DIAGNOSTIC_RECOMMENDATIONS[category];

// ---------------------------------------------------------------------------
// Latency degradation detection
// ---------------------------------------------------------------------------

/**
 * Detect latency trend using linear regression slope on the latency series.
 *
 * Uses the slope of a least-squares linear fit relative to the mean latency
 * to determine whether latency is stable, degrading (increasing), or improving
 * (decreasing).
 *
 * A slope magnitude less than 20% of the mean latency per step is considered stable.
 *
 * Pure function: no side effects.
 */
export const detectLatencyDegradation = (
  latencies: readonly number[]
): 'stable' | 'degrading' | 'improving' => {
  if (latencies.length <= 1) {
    return 'stable';
  }

  const n = latencies.length;

  // Compute means
  const meanX = (n - 1) / 2;
  const meanY = latencies.reduce((sum, v) => sum + v, 0) / n;

  if (meanY === 0) {
    return 'stable';
  }

  // Compute slope via least squares: slope = sum((xi - meanX)(yi - meanY)) / sum((xi - meanX)^2)
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    const dy = latencies[i] - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  if (denominator === 0) {
    return 'stable';
  }

  const slope = numerator / denominator;

  // Normalize slope relative to mean: what fraction of mean does latency change per step?
  const normalizedSlope = slope / meanY;

  // Threshold: 20% of mean per step
  const threshold = 0.20;

  if (normalizedSlope > threshold) {
    return 'degrading';
  }
  if (normalizedSlope < -threshold) {
    return 'improving';
  }
  return 'stable';
};

// ---------------------------------------------------------------------------
// Connection status inference
// ---------------------------------------------------------------------------

/**
 * Infer connection status from the most recent events for a server.
 *
 * - No events = disconnected
 * - All recent events error = error
 * - Most recent events succeed = connected
 *
 * Looks at the last 3 events (or all if fewer) and checks if majority are errors.
 *
 * Pure function: no side effects.
 */
export const inferConnectionStatus = (
  events: readonly McpToolCallEntry[]
): 'connected' | 'disconnected' | 'error' => {
  if (events.length === 0) {
    return 'disconnected';
  }

  // Sort by timestamp descending to get most recent first
  const sorted = [...events].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp)
  );

  // Consider the last 3 events (or fewer)
  const recentWindow = sorted.slice(0, Math.min(3, sorted.length));
  const errorCount = recentWindow.filter((e) => e.status === 'error').length;
  const errorRatio = errorCount / recentWindow.length;

  if (errorRatio > 0.5) {
    return 'error';
  }
  return 'connected';
};

// ---------------------------------------------------------------------------
// Error aggregation helpers (pure)
// ---------------------------------------------------------------------------

const aggregateErrorsByCategory = (
  errorTimeline: readonly McpErrorEntry[]
): readonly McpErrorCategoryCount[] => {
  const counts = new Map<McpErrorCategory, number>();

  for (const entry of errorTimeline) {
    const category = categorizeMcpError(entry.errorMessage);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([category, count]) => ({
    category,
    count,
  }));
};

const buildDiagnostics = (
  errorsByCategory: readonly McpErrorCategoryCount[]
): readonly McpDiagnostic[] =>
  errorsByCategory.map(({ category }) => ({
    category,
    recommendation: getDiagnosticRecommendation(category),
  }));

// ---------------------------------------------------------------------------
// Full MCP analysis composition
// ---------------------------------------------------------------------------

/**
 * Compose a complete MCP analysis from health data and tool call history.
 *
 * Groups tool calls by server, runs error categorization, latency trend
 * detection, and connection status inference for each server.
 *
 * Pure function: no side effects.
 */
export const analyzeMcpServers = (
  mcpHealth: readonly McpServerHealth[],
  toolCalls: readonly McpToolCallEntry[]
): McpAnalysis => {
  if (mcpHealth.length === 0) {
    return { servers: [], hasServers: false };
  }

  // Index tool calls by server name
  const callsByServer = new Map<string, McpToolCallEntry[]>();
  for (const call of toolCalls) {
    const existing = callsByServer.get(call.serverName) ?? [];
    existing.push(call);
    callsByServer.set(call.serverName, existing);
  }

  const servers = mcpHealth.map((health): McpServerDetail => {
    const serverCalls = callsByServer.get(health.serverName) ?? [];
    const latencies = serverCalls
      .filter((c) => c.latencyMs !== null)
      .map((c) => c.latencyMs!);

    const errorsByCategory = aggregateErrorsByCategory(health.errorTimeline);
    const diagnostics = buildDiagnostics(errorsByCategory);
    const latencyTrend = detectLatencyDegradation(latencies);
    const connectionStatus = inferConnectionStatus(serverCalls);

    return {
      serverName: health.serverName,
      connectionStatus,
      health,
      errorsByCategory,
      diagnostics,
      latencyTrend,
      recentCalls: serverCalls,
    };
  });

  return { servers, hasServers: true };
};
