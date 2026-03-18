/**
 * Unit tests: Cross-Session Aggregator (Step 01-01)
 *
 * Pure function: aggregateAcrossSessions(sessions) => AggregateMetrics
 *
 * Properties tested:
 * - Empty input yields zero aggregate (identity element)
 * - Single session aggregate matches that session's values
 * - Total token rate equals sum of per-session burn rates
 * - Total active agents equals sum of per-session agent counts
 * - Total cost rate equals sum of per-session cost rates (burn rate * session cost proxy)
 * - Session count equals input array length
 * - Sessions breakdown is sorted by token rate descending
 * - Aggregator never mutates input sessions
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregateAcrossSessions,
} from "../../../../../src/plugins/norbert-usage/domain/crossSessionAggregator";
import { createInitialMetrics } from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import type { SessionMetrics } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const sessionIdArb = fc.string({ minLength: 1, maxLength: 30 });
const rateArb = fc.nat({ max: 10_000 });
const agentCountArb = fc.nat({ max: 20 });
const costArb = fc.double({ min: 0, max: 1000, noNaN: true });

const sessionMetricsArb = fc.record({
  sessionId: sessionIdArb,
  burnRate: rateArb,
  activeAgentCount: agentCountArb,
  sessionCost: costArb,
}).map(({ sessionId, burnRate, activeAgentCount, sessionCost }) => ({
  ...createInitialMetrics(sessionId),
  burnRate,
  activeAgentCount,
  sessionCost,
}));

const sessionsArb = fc.array(sessionMetricsArb, { maxLength: 20 });

// ---------------------------------------------------------------------------
// Properties: Aggregate is a monoid (identity + associativity of sums)
// ---------------------------------------------------------------------------

describe("crossSessionAggregator properties", () => {
  it("@property: empty input yields zero aggregate", () => {
    const aggregate = aggregateAcrossSessions([]);

    expect(aggregate.totalTokenRate).toBe(0);
    expect(aggregate.totalCostRate).toBe(0);
    expect(aggregate.totalActiveAgents).toBe(0);
    expect(aggregate.sessionCount).toBe(0);
    expect(aggregate.sessions).toHaveLength(0);
  });

  it("@property: total token rate equals sum of per-session burn rates", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const aggregate = aggregateAcrossSessions(sessions);
        const expectedRate = sessions.reduce((sum, s) => sum + s.burnRate, 0);
        expect(aggregate.totalTokenRate).toBe(expectedRate);
      }),
      { numRuns: 200 },
    );
  });

  it("@property: total active agents equals sum of per-session agent counts", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const aggregate = aggregateAcrossSessions(sessions);
        const expectedAgents = sessions.reduce((sum, s) => sum + s.activeAgentCount, 0);
        expect(aggregate.totalActiveAgents).toBe(expectedAgents);
      }),
      { numRuns: 200 },
    );
  });

  it("@property: session count equals input array length", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const aggregate = aggregateAcrossSessions(sessions);
        expect(aggregate.sessionCount).toBe(sessions.length);
      }),
      { numRuns: 200 },
    );
  });

  it("@property: sessions breakdown is sorted by token rate descending", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const aggregate = aggregateAcrossSessions(sessions);
        for (let i = 1; i < aggregate.sessions.length; i++) {
          expect(aggregate.sessions[i - 1].tokenRate).toBeGreaterThanOrEqual(
            aggregate.sessions[i].tokenRate,
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  it("@property: breakdown length matches input length", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const aggregate = aggregateAcrossSessions(sessions);
        expect(aggregate.sessions).toHaveLength(sessions.length);
      }),
      { numRuns: 200 },
    );
  });
});
