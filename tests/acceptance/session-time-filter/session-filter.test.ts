/**
 * Acceptance tests: Session Time Filter
 *
 * Validates the pure domain filter logic for filtering sessions by
 * activity recency. All tests drive the filterSessions function
 * (driving port) — no DOM, no React, no mocks.
 *
 * Traces to:
 *   - US-1: Filter sessions to active now (AC-1)
 *   - US-2: Filter sessions by recent time window (AC-2)
 *   - US-3: Filtered count reflects filter (AC-3)
 *   - US-4: Empty filter state (AC-4)
 *   - AC-5: Default behavior
 *   - AC-6: Pure domain logic
 *
 * Driving ports: sessionFilter module (src/domain/sessionFilter.ts)
 * Reuses: SessionInfo from src/domain/status.ts
 */

import { describe, it, expect } from "vitest";

// Driving port: sessionFilter module
// These imports will resolve once the module is implemented.
import {
  filterSessions,
  SESSION_FILTER_PRESETS,
  type SessionFilterId,
} from "../../../src/domain/sessionFilter";

import type { SessionInfo } from "../../../src/domain/status";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Fixed reference time for deterministic tests. */
const NOW = new Date("2026-03-26T12:00:00Z").getTime();

const minutes = (n: number): number => n * 60 * 1000;
const hours = (n: number): number => n * 60 * 60 * 1000;

/** Create a SessionInfo with last_event_at relative to NOW. */
const makeSession = (
  id: string,
  opts: {
    readonly lastEventAgo?: number;
    readonly startedAgo?: number;
    readonly ended?: boolean;
    readonly eventCount?: number;
  } = {},
): SessionInfo => {
  const startedAgo = opts.startedAgo ?? opts.lastEventAgo ?? minutes(1);
  const lastEventAgo = opts.lastEventAgo;

  return {
    id,
    started_at: new Date(NOW - startedAgo).toISOString(),
    ended_at: opts.ended ? new Date(NOW - (lastEventAgo ?? 0)).toISOString() : null,
    event_count: opts.eventCount ?? 5,
    last_event_at: lastEventAgo !== undefined
      ? new Date(NOW - lastEventAgo).toISOString()
      : null,
  };
};

// Active sessions: ended_at null, last_event_at within 5 minutes
const activeSession1 = makeSession("active-1", { lastEventAgo: minutes(1) });
const activeSession2 = makeSession("active-2", { lastEventAgo: minutes(2) });
const activeSession3 = makeSession("active-3", { lastEventAgo: minutes(3) });

// Completed sessions at various ages
const completed30m = makeSession("done-30m", { lastEventAgo: minutes(30), ended: true });
const completed2h = makeSession("done-2h", { lastEventAgo: hours(2), ended: true });
const completed25h = makeSession("done-25h", { lastEventAgo: hours(25), ended: true });
const completed48h = makeSession("done-48h", { lastEventAgo: hours(48), ended: true });

// Stale session: ended_at null but last_event_at > 5 min ago (not truly active)
const staleSession = makeSession("stale-1", { lastEventAgo: minutes(10) });

// Recent but completed sessions
const completed5m = makeSession("done-5m", { lastEventAgo: minutes(5), ended: true });
const completed10m = makeSession("done-10m", { lastEventAgo: minutes(10), ended: true });

// Session that spans a time boundary: started 2h ago but last event 10m ago
const spanningSession = makeSession("spanning", {
  startedAgo: hours(2),
  lastEventAgo: minutes(10),
});

// ---------------------------------------------------------------------------
// WALKING SKELETON: filterSessions is pure and returns filtered results
// Traces to: AC-6 (pure domain filter logic)
// ---------------------------------------------------------------------------

describe("filterSessions is a pure function testable without DOM", () => {
  it("returns a filtered array given sessions, filterId, and now timestamp", () => {
    // Given a mix of active and completed sessions
    const sessions = [activeSession1, completed30m, completed2h];

    // When filterSessions is called with 'all' and a fixed timestamp
    const result = filterSessions(sessions, "all", NOW);

    // Then it returns the full array (no filtering for 'all')
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Time window filters (US-2)
// ---------------------------------------------------------------------------

describe("Last 15 min filter includes sessions with recent activity", () => {
  it("shows sessions at 5m and 10m, excludes 30m and 2h", () => {
    // Given sessions with last_event_at at 5m, 10m, 30m, and 2h ago
    const sessions = [completed5m, completed10m, completed30m, completed2h];

    // When filtering to 'last-15m'
    const result = filterSessions(sessions, "last-15m", NOW);

    // Then sessions at 5m and 10m are included
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(
      expect.arrayContaining(["done-5m", "done-10m"]),
    );
  });
});

describe("Last 15 min filter includes session that spans the boundary", () => {
  it("session started 2h ago with last event 10m ago is included", () => {
    // Given a session that started 2 hours ago but had activity 10 minutes ago
    const sessions = [spanningSession, completed2h];

    // When filtering to 'last-15m'
    const result = filterSessions(sessions, "last-15m", NOW);

    // Then the spanning session is included (last activity within window)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("spanning");
  });
});

describe("Last 15 min filter always includes active sessions", () => {
  it("active sessions appear even though they are also within the window", () => {
    // Given a mix of active and recently completed sessions
    const sessions = [activeSession1, completed5m, completed30m];

    // When filtering to 'last-15m'
    const result = filterSessions(sessions, "last-15m", NOW);

    // Then active session and recent completed session are both included
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(
      expect.arrayContaining(["active-1", "done-5m"]),
    );
  });
});

describe("Last hour filter includes sessions within 60 minutes", () => {
  it("shows sessions at 5m and 30m, excludes 2h and 25h", () => {
    // Given sessions with last_event_at at 5m, 30m, 2h, and 25h ago
    const sessions = [completed5m, completed30m, completed2h, completed25h];

    // When filtering to 'last-1h'
    const result = filterSessions(sessions, "last-1h", NOW);

    // Then sessions at 5m and 30m are included
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(
      expect.arrayContaining(["done-5m", "done-30m"]),
    );
  });
});

describe("Last 24 hrs filter includes sessions within 24 hours", () => {
  it("shows sessions at 1h, 12h, 23h but excludes 48h", () => {
    // Given sessions at various ages
    const completed1h = makeSession("done-1h", { lastEventAgo: hours(1), ended: true });
    const completed12h = makeSession("done-12h", { lastEventAgo: hours(12), ended: true });
    const completed23h = makeSession("done-23h", { lastEventAgo: hours(23), ended: true });

    const sessions = [completed1h, completed12h, completed23h, completed48h];

    // When filtering to 'last-24h'
    const result = filterSessions(sessions, "last-24h", NOW);

    // Then sessions at 1h, 12h, and 23h are included
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.id)).toEqual(
      expect.arrayContaining(["done-1h", "done-12h", "done-23h"]),
    );
  });
});

// ---------------------------------------------------------------------------
// AC-3: Filtered count reflects filter (US-3)
// ---------------------------------------------------------------------------

describe("Filtered result length provides the count for the header", () => {
  it("20 total sessions with 4 in last hour yields length 4", () => {
    // Given 20 sessions where 4 have activity within the last hour
    const recentSessions = Array.from({ length: 4 }, (_, i) =>
      makeSession(`recent-${i}`, { lastEventAgo: minutes(10 + i * 10), ended: true }),
    );
    const oldSessions = Array.from({ length: 16 }, (_, i) =>
      makeSession(`old-${i}`, { lastEventAgo: hours(2 + i), ended: true }),
    );
    const sessions = [...recentSessions, ...oldSessions];

    // When filtering to 'last-1h'
    const result = filterSessions(sessions, "last-1h", NOW);

    // Then the result length is 4 (the header count)
    expect(result).toHaveLength(4);
  });

  it("'all' filter returns all sessions", () => {
    // Given 15 sessions
    const sessions = Array.from({ length: 15 }, (_, i) =>
      makeSession(`s-${i}`, { lastEventAgo: hours(i + 1), ended: true }),
    );

    // When filtering to 'all'
    const result = filterSessions(sessions, "all", NOW);

    // Then all 15 are returned
    expect(result).toHaveLength(15);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Empty filter state (US-4)
// ---------------------------------------------------------------------------

describe("Empty result when no sessions match the filter", () => {
  it("returns empty array for display of 'No sessions in this time window'", () => {
    // Given only old sessions
    const sessions = [completed25h, completed48h];

    // When filtering to 'last-15m'
    const result = filterSessions(sessions, "last-15m", NOW);

    // Then no sessions match
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Default behavior
// ---------------------------------------------------------------------------

describe("Default 'all' filter returns every session", () => {
  it("no sessions are excluded", () => {
    // Given a mix of active, stale, and completed sessions
    const sessions = [
      activeSession1, staleSession, completed30m, completed2h, completed48h,
    ];

    // When filtering to 'all'
    const result = filterSessions(sessions, "all", NOW);

    // Then all sessions are returned
    expect(result).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("Session with null last_event_at is excluded from time windows", () => {
  it("session with no events is not included in time window filters", () => {
    // Given a session that has never received events
    const noEvents = makeSession("no-events", {});
    // Override: no lastEventAgo means last_event_at is null
    const sessionNoEvents: SessionInfo = {
      ...noEvents,
      last_event_at: null,
    };

    const sessions = [sessionNoEvents, completed5m];

    // When filtering to 'last-15m'
    const result = filterSessions(sessions, "last-15m", NOW);

    // Then only the session with events is included
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("done-5m");
  });
});

describe("Empty sessions array returns empty for any filter", () => {
  it("no sessions in, no sessions out", () => {
    expect(filterSessions([], "all", NOW)).toHaveLength(0);
    expect(filterSessions([], "last-15m", NOW)).toHaveLength(0);
    expect(filterSessions([], "last-1h", NOW)).toHaveLength(0);
    expect(filterSessions([], "last-24h", NOW)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Preset configuration
// ---------------------------------------------------------------------------

describe("SESSION_FILTER_PRESETS has an entry for each filter ID", () => {
  it("four presets with unique IDs, labels, and short labels", () => {
    expect(SESSION_FILTER_PRESETS).toHaveLength(4);

    const ids = SESSION_FILTER_PRESETS.map((p) => p.id);
    expect(ids).toContain("last-15m");
    expect(ids).toContain("last-1h");
    expect(ids).toContain("last-24h");
    expect(ids).toContain("all");

    // Each preset has a non-empty label and shortLabel
    for (const preset of SESSION_FILTER_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.shortLabel.length).toBeGreaterThan(0);
    }
  });
});
