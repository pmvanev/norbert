/**
 * Unit tests: Session Metrics Table (Step 01-01)
 *
 * Pure functions: buildTableRows, formatCostColumn, formatTokenColumn
 *
 * Properties tested:
 * - buildTableRows produces one row per session
 * - Each row derives name from cwd last path segment
 * - Active status reflects isSessionActive logic
 * - Sessions with no matching metrics get zero defaults
 * - formatCostColumn produces dollar-prefixed string with 2 decimals
 * - formatTokenColumn produces K-suffixed string with 1 decimal
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { SessionInfo } from "../../../../../src/domain/status";
import type { SessionMetrics } from "../../../../../src/plugins/norbert-usage/domain/types";
import type { SessionMetadata } from "../../../../../src/views/SessionListView";
import {
  buildTableRows,
  formatCostColumn,
  formatTokenColumn,
} from "../../../../../src/plugins/norbert-session/domain/sessionMetricsTable";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const NOW = new Date("2026-04-10T12:00:00Z").getTime();

const sessionIdArb = fc.string({ minLength: 1, maxLength: 20 });
const cwdSegmentArb = fc.string({ minLength: 1, maxLength: 30 }).filter(
  (s) => !s.includes("/") && !s.includes("\\"),
);

function makeActiveSession(id: string, cwd: string): {
  session: SessionInfo;
  metadata: SessionMetadata;
} {
  return {
    session: {
      id,
      started_at: new Date(NOW - 30 * 60_000).toISOString(),
      ended_at: null,
      event_count: 10,
      last_event_at: new Date(NOW - 60_000).toISOString(), // 1 min ago
    },
    metadata: {
      session_id: id,
      terminal_type: null,
      service_version: null,
      os_type: null,
      host_arch: null,
      cwd: `/home/user/${cwd}`,
    },
  };
}

function makeEmptyMetrics(sessionId: string): SessionMetrics {
  return {
    sessionId,
    sessionLabel: "",
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    sessionCost: 0,
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
// PROPERTY: buildTableRows produces one row per session
// ---------------------------------------------------------------------------

describe("buildTableRows", () => {
  it("produces one row per session", () => {
    fc.assert(
      fc.property(
        fc.array(cwdSegmentArb, { minLength: 0, maxLength: 5 }),
        (segments) => {
          const sessionsAndMeta = segments.map((seg, i) =>
            makeActiveSession(`s${i}`, seg),
          );
          const sessions = sessionsAndMeta.map((s) => s.session);
          const metadata = sessionsAndMeta.map((s) => s.metadata);
          const metrics = sessions.map((s) => makeEmptyMetrics(s.id));

          const rows = buildTableRows(sessions, metrics, metadata, NOW);
          expect(rows).toHaveLength(sessions.length);
        },
      ),
    );
  });

  it("derives name from last path segment of cwd", () => {
    fc.assert(
      fc.property(cwdSegmentArb, (projectName) => {
        const { session, metadata } = makeActiveSession("s1", projectName);
        const metrics = [makeEmptyMetrics("s1")];

        const rows = buildTableRows([session], metrics, [metadata], NOW);
        expect(rows[0].name).toBe(projectName);
      }),
    );
  });

  it("marks active sessions as active and ended sessions as not active", () => {
    // Active session: no ended_at, recent last_event_at
    const activeSession: SessionInfo = {
      id: "active",
      started_at: new Date(NOW - 30 * 60_000).toISOString(),
      ended_at: null,
      event_count: 5,
      last_event_at: new Date(NOW - 60_000).toISOString(),
    };

    // Ended session
    const endedSession: SessionInfo = {
      id: "ended",
      started_at: new Date(NOW - 60 * 60_000).toISOString(),
      ended_at: new Date(NOW - 10 * 60_000).toISOString(),
      event_count: 5,
      last_event_at: new Date(NOW - 10 * 60_000).toISOString(),
    };

    const metadata: readonly SessionMetadata[] = [
      { session_id: "active", terminal_type: null, service_version: null, os_type: null, host_arch: null, cwd: "/proj/active" },
      { session_id: "ended", terminal_type: null, service_version: null, os_type: null, host_arch: null, cwd: "/proj/ended" },
    ];

    const metrics = [makeEmptyMetrics("active"), makeEmptyMetrics("ended")];
    const rows = buildTableRows([activeSession, endedSession], metrics, metadata, NOW);

    expect(rows[0].isActive).toBe(true);
    expect(rows[1].isActive).toBe(false);
  });

  it("sessions with no matching metrics produce rows with zero defaults", () => {
    const { session, metadata } = makeActiveSession("orphan", "myproject");
    // No metrics provided for this session
    const rows = buildTableRows([session], [], [metadata], NOW);

    expect(rows[0].cost).toBe(0);
    expect(rows[0].totalTokens).toBe(0);
  });

  it("sessions with no matching metadata use session ID as fallback name", () => {
    const session: SessionInfo = {
      id: "no-meta",
      started_at: new Date(NOW - 10 * 60_000).toISOString(),
      ended_at: null,
      event_count: 5,
      last_event_at: new Date(NOW - 60_000).toISOString(),
    };
    const metrics = [makeEmptyMetrics("no-meta")];
    const rows = buildTableRows([session], metrics, [], NOW);

    expect(rows[0].name).toBe("no-meta");
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: formatCostColumn always produces dollar-prefixed string
// ---------------------------------------------------------------------------

describe("formatCostColumn", () => {
  it("formats cost as dollar string with two decimal places", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10000, noNaN: true }),
        (cost) => {
          const result = formatCostColumn(cost);
          expect(result).toMatch(/^\$\d+\.\d{2}$/);
        },
      ),
    );
  });

  it("formats specific values correctly", () => {
    expect(formatCostColumn(1.24)).toBe("$1.24");
    expect(formatCostColumn(0.08)).toBe("$0.08");
    expect(formatCostColumn(0)).toBe("$0.00");
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: formatTokenColumn always produces K-suffixed string
// ---------------------------------------------------------------------------

describe("formatTokenColumn", () => {
  it("formats token counts with K suffix", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        (tokens) => {
          const result = formatTokenColumn(tokens);
          expect(result).toMatch(/^\d+(\.\d)?K$/);
        },
      ),
    );
  });

  it("formats specific values correctly", () => {
    expect(formatTokenColumn(142500)).toBe("142.5K");
    expect(formatTokenColumn(9300)).toBe("9.3K");
    expect(formatTokenColumn(61000)).toBe("61.0K");
    expect(formatTokenColumn(0)).toBe("0.0K");
  });
});
