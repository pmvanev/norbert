/**
 * Acceptance tests: Session Metrics Table -- Walking Skeletons
 *
 * End-to-end walking skeletons that validate the core user experience:
 * sessions displayed as a sortable metrics table with status, name,
 * cost, and token columns visible by default.
 *
 * Driving ports:
 *   - buildTableRows (pure domain function)
 *   - formatCostColumn, formatTokenColumn (pure formatters)
 *
 * Traces to: WS-1 (table renders), WS-2 (cost/token comparison), WS-3 (row selection)
 */

import { describe, it, expect } from "vitest";
import type { SessionInfo } from "../../../../src/domain/status";
import type { SessionMetrics } from "../../../../src/plugins/norbert-usage/domain/types";
import type { SessionMetadata } from "../../../../src/views/SessionListView";
import {
  buildTableRows,
  formatCostColumn,
  formatTokenColumn,
  selectFocusedRow,
} from "../../../../src/plugins/norbert-session/domain/sessionMetricsTable";

// ---------------------------------------------------------------------------
// Test helpers: session fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-04-10T12:00:00Z").getTime();

function makeSession(
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

function makeMetadata(sessionId: string, cwd: string): SessionMetadata {
  return {
    session_id: sessionId,
    terminal_type: null,
    service_version: null,
    os_type: null,
    host_arch: null,
    cwd,
  };
}

function makeMetrics(
  sessionId: string,
  cost: number,
  tokens: number,
): SessionMetrics {
  return {
    sessionId,
    sessionLabel: "",
    totalTokens: tokens,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    sessionCost: cost,
    toolCallCount: 0,
    activeAgentCount: 0,
    contextWindowPct: 0,
    contextWindowTokens: 0,
    contextWindowMaxTokens: 0,
    contextWindowModel: "",
    lastApiLatencyMs: 0,
    totalEventCount: 0,
    apiErrorCount: 0,
    apiRequestCount: 0,
    apiErrorRate: 0,
    sessionStartedAt: "",
    lastEventAt: "",
    burnRate: 0,
  };
}

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-1: Table renders with Status and Name columns
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User views sessions as a metrics table with status and name", () => {
  it("table rows show status indicator and project name for each session", () => {
    // Given three sessions: "norbert" (active), "api-server" (active), "docs-site" (completed)
    const sessions: readonly SessionInfo[] = [
      makeSession("s1", 30, { lastEventMinutesAgo: 1 }), // active - recent event
      makeSession("s2", 20, { lastEventMinutesAgo: 2 }), // active - recent event
      makeSession("s3", 60, { ended: true, lastEventMinutesAgo: 10 }), // completed
    ];

    const metadata: readonly SessionMetadata[] = [
      makeMetadata("s1", "/home/phil/Git/norbert"),
      makeMetadata("s2", "/home/phil/Git/api-server"),
      makeMetadata("s3", "/home/phil/Git/docs-site"),
    ];

    const metrics: readonly SessionMetrics[] = [
      makeMetrics("s1", 1.24, 142500),
      makeMetrics("s2", 0.08, 9300),
      makeMetrics("s3", 0.52, 61000),
    ];

    // When the table row data is built
    const rows = buildTableRows(sessions, metrics, metadata, NOW);

    // Then each row has a name derived from the working directory last segment
    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe("norbert");
    expect(rows[1].name).toBe("api-server");
    expect(rows[2].name).toBe("docs-site");

    // And active sessions are marked active, completed is not
    expect(rows[0].isActive).toBe(true);
    expect(rows[1].isActive).toBe(true);
    expect(rows[2].isActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-2: Cost and token comparison
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User compares session costs and token usage across sessions", () => {
  it("cost and token columns display formatted values for each session", () => {
    // Given sessions with known cost and token values
    const sessions: readonly SessionInfo[] = [
      makeSession("s1", 30, { lastEventMinutesAgo: 1 }),
      makeSession("s2", 20, { lastEventMinutesAgo: 2 }),
      makeSession("s3", 60, { ended: true, lastEventMinutesAgo: 10 }),
    ];

    const metadata: readonly SessionMetadata[] = [
      makeMetadata("s1", "/home/phil/Git/norbert"),
      makeMetadata("s2", "/home/phil/Git/api-server"),
      makeMetadata("s3", "/home/phil/Git/docs-site"),
    ];

    const metrics: readonly SessionMetrics[] = [
      makeMetrics("s1", 1.24, 142500),
      makeMetrics("s2", 0.08, 9300),
      makeMetrics("s3", 0.52, 61000),
    ];

    // When the table row data is built
    const rows = buildTableRows(sessions, metrics, metadata, NOW);

    // Then cost and token columns show formatted values
    expect(formatCostColumn(rows[0].cost)).toBe("$1.24");
    expect(formatCostColumn(rows[1].cost)).toBe("$0.08");
    expect(formatCostColumn(rows[2].cost)).toBe("$0.52");

    expect(formatTokenColumn(rows[0].totalTokens)).toBe("142.5K");
    expect(formatTokenColumn(rows[1].totalTokens)).toBe("9.3K");
    expect(formatTokenColumn(rows[2].totalTokens)).toBe("61.0K");
  });
});

// ---------------------------------------------------------------------------
// WALKING SKELETON WS-3: Row selection opens detail panel
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User selects a session row to view detailed metrics", () => {
  it("clicking a row returns the session ID for detail panel navigation", () => {
    // Given session "norbert" with ID "abc-123" appears in the metrics table
    const sessions: readonly SessionInfo[] = [
      makeSession("abc-123", 30, { lastEventMinutesAgo: 1 }),
      makeSession("def-456", 20, { lastEventMinutesAgo: 2 }),
    ];
    const metadata: readonly SessionMetadata[] = [
      makeMetadata("abc-123", "/home/phil/Git/norbert"),
      makeMetadata("def-456", "/home/phil/Git/api-server"),
    ];
    const metrics: readonly SessionMetrics[] = [
      makeMetrics("abc-123", 1.24, 142500),
      makeMetrics("def-456", 0.08, 9300),
    ];
    const rows = buildTableRows(sessions, metrics, metadata, NOW);

    // When the user selects the "norbert" row (focus index 0)
    const selectedId = selectFocusedRow(0, rows);

    // Then the onSessionSelect callback receives "abc-123"
    expect(selectedId).toBe("abc-123");
  });
});
