/**
 * Shared test fixtures for session metrics table acceptance tests.
 *
 * Provides factory functions for building SessionInfo, SessionMetrics,
 * SessionMetadata, and TableRow test data with sensible defaults.
 */

import type { SessionInfo } from "../../../../src/domain/status";
import type { SessionMetrics } from "../../../../src/plugins/norbert-usage/domain/types";
import type { SessionMetadata } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";
import type { TableRow } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";

export const NOW = new Date("2026-04-10T12:00:00Z").getTime();

export function makeSession(
  id: string,
  startedMinutesAgo: number,
  opts: { ended?: boolean; lastEventMinutesAgo?: number },
): SessionInfo {
  const started = new Date(NOW - startedMinutesAgo * 60_000).toISOString();
  const lastEventAgo = opts.lastEventMinutesAgo ?? startedMinutesAgo;
  return {
    id,
    started_at: started,
    ended_at: opts.ended
      ? new Date(NOW - lastEventAgo * 60_000).toISOString()
      : null,
    event_count: 10,
    last_event_at: new Date(NOW - lastEventAgo * 60_000).toISOString(),
  };
}

export function makeMetadata(
  sessionId: string,
  cwd: string,
  opts?: { service_version?: string | null; os_type?: string | null; host_arch?: string | null },
): SessionMetadata {
  return {
    session_id: sessionId,
    terminal_type: null,
    service_version: opts?.service_version ?? null,
    os_type: opts?.os_type ?? null,
    host_arch: opts?.host_arch ?? null,
    cwd,
  };
}

export function makeMetrics(
  sessionId: string,
  overrides?: Partial<Pick<SessionMetrics,
    | "sessionCost"
    | "totalTokens"
    | "inputTokens"
    | "outputTokens"
    | "cacheReadTokens"
    | "activeAgentCount"
    | "totalEventCount"
  >>,
): SessionMetrics {
  return {
    sessionId,
    sessionLabel: "",
    totalTokens: overrides?.totalTokens ?? 0,
    inputTokens: overrides?.inputTokens ?? 0,
    outputTokens: overrides?.outputTokens ?? 0,
    cacheReadTokens: overrides?.cacheReadTokens ?? 0,
    cacheCreationTokens: 0,
    sessionCost: overrides?.sessionCost ?? 0,
    toolCallCount: 0,
    activeAgentCount: overrides?.activeAgentCount ?? 0,
    contextWindowPct: 0,
    contextWindowTokens: 0,
    contextWindowMaxTokens: 0,
    contextWindowModel: "",
    lastApiLatencyMs: 0,
    totalEventCount: overrides?.totalEventCount ?? 0,
    apiErrorCount: 0,
    apiRequestCount: 0,
    apiErrorRate: 0,
    sessionStartedAt: "",
    lastEventAt: "",
    burnRate: 0,
  };
}

export function makeTableRow(overrides: Partial<TableRow> & { sessionId: string }): TableRow {
  return {
    name: overrides.name ?? overrides.sessionId,
    isActive: false,
    cost: 0,
    totalTokens: 0,
    burnRate: 0,
    contextPercent: 0,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    activeAgents: 0,
    totalEventCount: 0,
    version: null,
    platform: null,
    ...overrides,
  };
}
