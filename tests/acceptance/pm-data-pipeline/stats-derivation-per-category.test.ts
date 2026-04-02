/**
 * Acceptance tests: Stats Derivation Per Category
 *
 * Validates that stats derivation reads the correct sample values
 * for each metric category. All category values are stored in the
 * tokenRate field of RateSample (multiSessionStore convention), so
 * the stats derivation currently works by accident. These tests
 * verify the values are correct for each category, serving as
 * regression guards and as the contract for a future CategorySample
 * type migration.
 *
 * Uses the single-window aggregate buffer (getAggregateBuffer) which
 * does not throttle by sample interval, ensuring all appended samples
 * are captured in the test.
 *
 * Traces to: performance-monitor-design-spec.md "3. Stats Grid"
 */

import { describe, it, expect } from "vitest";

import {
  createMultiSessionStore,
} from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";

import type { MetricCategoryId } from "../../../src/plugins/norbert-usage/domain/categoryConfig";

// ---------------------------------------------------------------------------
// Helper: derive stats from the single-window aggregate buffer
// ---------------------------------------------------------------------------

/**
 * Mirrors the PMDetailPane.deriveStatsFromBuffer logic but uses the
 * non-windowed aggregate buffer to avoid multi-window throttling.
 * Reads tokenRate (the convention field for all category values).
 */
const deriveStatsFromAggregateBuffer = (
  store: ReturnType<typeof createMultiSessionStore>,
  categoryId: MetricCategoryId,
) => {
  const buffer = store.getAggregateBuffer(categoryId);
  const samples = buffer.samples;
  const sessions = store.getSessions();

  if (samples.length === 0) {
    return { peak: 0, avg: 0, current: 0, sessions: sessions.length };
  }

  const values = samples.map((s) => s.tokenRate);
  const peak = values.reduce((a, b) => Math.max(a, b), 0);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const current = values[values.length - 1];

  return { peak, avg, current, sessions: sessions.length };
};

// ---------------------------------------------------------------------------
// COST CATEGORY: stats should reflect cost rate values
// ---------------------------------------------------------------------------

describe("Cost category stats reflect cost rate values", () => {
  it("peak cost stat shows the highest cost rate from the buffer", () => {
    // Given a session generating cost data at known rates
    const store = createMultiSessionStore();
    store.addSession("opus-session");

    // When cost samples are appended with varying cost rates
    store.appendSessionSample("opus-session", { tokens: 1000, cost: 0.05, agents: 1, context: 30 });
    store.appendSessionSample("opus-session", { tokens: 800, cost: 0.08, agents: 1, context: 35 });
    store.appendSessionSample("opus-session", { tokens: 600, cost: 0.03, agents: 1, context: 40 });

    // Then the cost aggregate buffer should contain all 3 samples
    // and the peak should be 0.08 (the highest cost rate)
    const stats = deriveStatsFromAggregateBuffer(store, "cost");
    expect(stats.peak).toBeCloseTo(0.08);
  });

  it("current cost stat shows the most recent cost rate", () => {
    // Given a session with known cost rate history
    const store = createMultiSessionStore();
    store.addSession("sonnet-session");

    store.appendSessionSample("sonnet-session", { tokens: 500, cost: 0.02, agents: 1, context: 25 });
    store.appendSessionSample("sonnet-session", { tokens: 300, cost: 0.015, agents: 1, context: 28 });

    // Then the current cost stat shows the latest value (0.015)
    const stats = deriveStatsFromAggregateBuffer(store, "cost");
    expect(stats.current).toBeCloseTo(0.015);
  });
});

// ---------------------------------------------------------------------------
// AGENTS CATEGORY: stats should reflect agent count values
// ---------------------------------------------------------------------------

describe("Agents category stats reflect agent count values", () => {
  it("peak agents stat shows the highest concurrent agent count", () => {
    // Given sessions generating agent count data
    const store = createMultiSessionStore();
    store.addSession("multi-agent");

    // When agent counts vary over time
    store.appendSessionSample("multi-agent", { tokens: 100, cost: 0.001, agents: 2, context: 30 });
    store.appendSessionSample("multi-agent", { tokens: 100, cost: 0.001, agents: 5, context: 35 });
    store.appendSessionSample("multi-agent", { tokens: 100, cost: 0.001, agents: 3, context: 40 });

    // Then the agents category peak stat should show 5 (the highest agent count)
    const stats = deriveStatsFromAggregateBuffer(store, "agents");
    expect(stats.peak).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// TOKENS CATEGORY: stats should reflect token rate values (baseline sanity)
// ---------------------------------------------------------------------------

describe("Tokens category stats reflect token rate values", () => {
  it("peak tokens stat shows the highest token rate", () => {
    // Given sessions generating token rate data
    const store = createMultiSessionStore();
    store.addSession("fast-session");

    store.appendSessionSample("fast-session", { tokens: 500, cost: 0.005, agents: 1, context: 30 });
    store.appendSessionSample("fast-session", { tokens: 1200, cost: 0.012, agents: 1, context: 35 });
    store.appendSessionSample("fast-session", { tokens: 800, cost: 0.008, agents: 1, context: 40 });

    // Then the tokens category peak stat should show 1200
    const stats = deriveStatsFromAggregateBuffer(store, "tokens");
    expect(stats.peak).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// MULTI-SESSION AGGREGATE: cost aggregate sums correctly
// ---------------------------------------------------------------------------

describe("Cost aggregate stats sum across sessions", () => {
  it("current cost stat reflects the aggregate sum of per-session cost rates", () => {
    // Given two sessions with different cost rates
    const store = createMultiSessionStore();
    store.addSession("opus");
    store.addSession("sonnet");

    store.appendSessionSample("opus", { tokens: 800, cost: 0.06, agents: 1, context: 40 });
    store.appendSessionSample("sonnet", { tokens: 300, cost: 0.004, agents: 1, context: 25 });

    // Then the aggregate cost current stat = 0.06 + 0.004 = 0.064
    const stats = deriveStatsFromAggregateBuffer(store, "cost");
    expect(stats.current).toBeCloseTo(0.064);
  });
});
