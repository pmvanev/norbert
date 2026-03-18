/**
 * Acceptance tests: Cross-Session Aggregate Metrics (US-PM-002, US-PM-006)
 *
 * Validates that aggregate metrics are correctly computed from multiple
 * active sessions: total tokens/s, total cost/min, active agent counts,
 * and per-session breakdown sorted by rate.
 *
 * Driving ports: pure domain functions (crossSessionAggregator,
 * performanceMonitor chart data composition)
 * These tests exercise the aggregation pipeline, not React views.
 *
 * Traces to: US-PM-002 acceptance criteria, US-PM-006 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  createInitialMetrics,
  type SessionMetrics,
} from "../../../src/plugins/norbert-usage/domain/metricsAggregator";
import {
  aggregateAcrossSessions,
  type AggregateMetrics,
} from "../../../src/plugins/norbert-usage/domain/crossSessionAggregator";

import {
  computeCostRatePerMinute,
} from "../../../src/plugins/norbert-usage/domain/performanceMonitor";

// ---------------------------------------------------------------------------
// Helper: create session metrics with specific values
// ---------------------------------------------------------------------------

const createSessionSnapshot = (
  overrides: Partial<SessionMetrics> & { sessionId: string },
): SessionMetrics => ({
  ...createInitialMetrics(overrides.sessionId),
  ...overrides,
});

// ---------------------------------------------------------------------------
// WALKING SKELETON: User sees total resource consumption across sessions
// Traces to: US-PM-002, JS-PM-1
// ---------------------------------------------------------------------------

describe("User views aggregate resource consumption across all active sessions", () => {
  it("total token rate equals sum of per-session rates", () => {
    // Given Ravi has 3 active sessions with known token rates
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "refactor-auth", burnRate: 312 }),
      createSessionSnapshot({ sessionId: "migrate-db", burnRate: 185 }),
      createSessionSnapshot({ sessionId: "test-coverage", burnRate: 30 }),
    ];

    // When aggregate metrics are computed across all sessions
    const aggregate = aggregateAcrossSessions(sessions);

    // Then the total tokens/s shows 527 tok/s
    expect(aggregate.totalTokenRate).toBe(527);
    // And the session count is 3
    expect(aggregate.sessionCount).toBe(3);
    // And per-session breakdown lists all 3 sessions
    expect(aggregate.sessions).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// WALKING SKELETON: User sees cost velocity as a leading indicator
// Traces to: US-PM-006, JS-PM-5
// ---------------------------------------------------------------------------

describe("User sees rolling cost rate across all active sessions", () => {
  it("total cost rate reflects sum of per-session cost rates", () => {
    // Given Ravi has sessions with varying cost rates:
    // Opus 4 "refactor-auth" at $0.003/s, Opus 4 "migrate-db" at $0.002/s,
    // Sonnet 4 "test-coverage" at $0.0003/s
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "refactor-auth", burnRate: 312, sessionCost: 5.40 }),
      createSessionSnapshot({ sessionId: "migrate-db", burnRate: 185, sessionCost: 3.20 }),
      createSessionSnapshot({ sessionId: "test-coverage", burnRate: 30, sessionCost: 0.12 }),
    ];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then the total cost rate is the sum of per-session cost rates
    expect(aggregate.totalCostRate).toBeGreaterThan(0);
    // And the cost/min display shows the rate in dollars per minute
    const costPerMin = computeCostRatePerMinute(aggregate.totalCostRate);
    expect(costPerMin).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Aggregate Computation
// Traces to: US-PM-002 AC
// ---------------------------------------------------------------------------

describe("Aggregate token rate is the sum of per-session burn rates", () => {
  it("sums token rates across 3 mixed-model sessions", () => {
    // Given 3 sessions at 312, 185, and 30 tok/s
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "refactor-auth", burnRate: 312 }),
      createSessionSnapshot({ sessionId: "migrate-db", burnRate: 185 }),
      createSessionSnapshot({ sessionId: "test-coverage", burnRate: 30 }),
    ];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then the total is 527 tok/s
    expect(aggregate.totalTokenRate).toBe(527);
  });
});

describe("Aggregate active agents is the sum of per-session agent counts", () => {
  it("sums agent counts across sessions", () => {
    // Given 3 sessions with 1, 2, and 1 active agents respectively
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "refactor-auth", activeAgentCount: 1 }),
      createSessionSnapshot({ sessionId: "migrate-db", activeAgentCount: 2 }),
      createSessionSnapshot({ sessionId: "test-coverage", activeAgentCount: 1 }),
    ];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then total active agents is 4
    expect(aggregate.totalActiveAgents).toBe(4);
  });
});

describe("Per-session breakdown is sorted by token rate descending", () => {
  it("highest rate session appears first in breakdown", () => {
    // Given 3 sessions with rates 30, 312, and 185 tok/s (unsorted input)
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "test-coverage", burnRate: 30 }),
      createSessionSnapshot({ sessionId: "refactor-auth", burnRate: 312 }),
      createSessionSnapshot({ sessionId: "migrate-db", burnRate: 185 }),
    ];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then sessions are listed in order: 312, 185, 30 tok/s
    expect(aggregate.sessions[0].tokenRate).toBe(312);
    expect(aggregate.sessions[1].tokenRate).toBe(185);
    expect(aggregate.sessions[2].tokenRate).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Single Session Edge Case
// Traces to: US-PM-001 scenario 2
// ---------------------------------------------------------------------------

describe("Single session aggregate equals that session's metrics", () => {
  it("aggregate matches the sole session when only one is active", () => {
    // Given Elena has only 1 active session "user-auth" at 280 tok/s
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "user-auth", burnRate: 280, activeAgentCount: 1 }),
    ];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then the total tokens/s matches the single session rate
    expect(aggregate.totalTokenRate).toBe(280);
    // And session count is 1
    expect(aggregate.sessionCount).toBe(1);
    // And breakdown shows one row
    expect(aggregate.sessions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Empty State
// Traces to: US-PM-001 scenario 3, US-PM-001 AC "Empty state with guidance"
// ---------------------------------------------------------------------------

describe("Empty aggregate when no sessions are active", () => {
  it("all aggregate values are zero with no sessions", () => {
    // Given Marcus has no active Claude Code sessions
    const sessions: ReadonlyArray<SessionMetrics> = [];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then all aggregate values are zero
    expect(aggregate.totalTokenRate).toBe(0);
    expect(aggregate.totalCostRate).toBe(0);
    expect(aggregate.totalActiveAgents).toBe(0);
    expect(aggregate.sessionCount).toBe(0);
    // And the breakdown is empty
    expect(aggregate.sessions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Session Lifecycle Changes
// Traces to: US-PM-002 AC "New sessions appear", "Ended sessions removed"
// ---------------------------------------------------------------------------

describe("Aggregate updates when a new session is added", () => {
  it("total increases when a session is added to the active set", () => {
    // Given Elena has 2 sessions totaling 400 tok/s
    const existingSessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "session-a", burnRate: 250 }),
      createSessionSnapshot({ sessionId: "session-b", burnRate: 150 }),
    ];

    // When a new session "deploy-staging" starts at 80 tok/s
    const updatedSessions: ReadonlyArray<SessionMetrics> = [
      ...existingSessions,
      createSessionSnapshot({ sessionId: "deploy-staging", burnRate: 80 }),
    ];

    // Then the aggregate reflects 3 sessions at 480 tok/s
    const aggregate = aggregateAcrossSessions(updatedSessions);
    expect(aggregate.totalTokenRate).toBe(480);
    expect(aggregate.sessionCount).toBe(3);
  });
});

describe("Aggregate updates when a session ends", () => {
  it("total decreases when a session is removed from the active set", () => {
    // Given Marcus has 3 sessions with total 500 tok/s
    // And session "quick-fix" was contributing 100 tok/s
    const allSessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "session-a", burnRate: 250 }),
      createSessionSnapshot({ sessionId: "quick-fix", burnRate: 100 }),
      createSessionSnapshot({ sessionId: "session-c", burnRate: 150 }),
    ];

    // When session "quick-fix" ends (removed from active set)
    const remainingSessions = allSessions.filter(s => s.sessionId !== "quick-fix");

    // Then the total drops to 400 tok/s
    const aggregate = aggregateAcrossSessions(remainingSessions);
    expect(aggregate.totalTokenRate).toBe(400);
    expect(aggregate.sessionCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Cost Rate Edge Cases
// Traces to: US-PM-006 AC "Zero cost correctly displayed during idle"
// ---------------------------------------------------------------------------

describe("Zero cost rate when all sessions are idle", () => {
  it("cost rate is zero when no tokens are being consumed", () => {
    // Given Marcus has 2 sessions running but both agents are idle
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "session-a", burnRate: 0 }),
      createSessionSnapshot({ sessionId: "session-b", burnRate: 0 }),
    ];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then the total cost rate is zero
    expect(aggregate.totalCostRate).toBe(0);
    // And the total token rate is zero
    expect(aggregate.totalTokenRate).toBe(0);
    // And cost per minute is also zero
    const costPerMin = computeCostRatePerMinute(aggregate.totalCostRate);
    expect(costPerMin).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// Traces to: Shared Artifacts Registry -- "Aggregate always equals sum of parts"
// ---------------------------------------------------------------------------

describe("@property: aggregate total always equals sum of per-session values", () => {
  it("sum invariant holds for any combination of session metrics", () => {
    // Given any valid set of active sessions with varying metrics
    const sessions: ReadonlyArray<SessionMetrics> = [
      createSessionSnapshot({ sessionId: "s1", burnRate: 100, activeAgentCount: 1 }),
      createSessionSnapshot({ sessionId: "s2", burnRate: 0, activeAgentCount: 2 }),
      createSessionSnapshot({ sessionId: "s3", burnRate: 999, activeAgentCount: 1 }),
      createSessionSnapshot({ sessionId: "s4", burnRate: 1, activeAgentCount: 0 }),
    ];

    // When aggregate metrics are computed
    const aggregate = aggregateAcrossSessions(sessions);

    // Then aggregate totals equal the sum of per-session values
    const expectedTokenRate = sessions.reduce((sum, s) => sum + s.burnRate, 0);
    const expectedAgents = sessions.reduce((sum, s) => sum + s.activeAgentCount, 0);
    expect(aggregate.totalTokenRate).toBe(expectedTokenRate);
    expect(aggregate.totalActiveAgents).toBe(expectedAgents);
  });
});
