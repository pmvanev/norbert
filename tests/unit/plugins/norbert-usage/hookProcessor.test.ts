/**
 * Unit tests: Hook Processor (Step 03-02)
 *
 * Factory function: createHookProcessor(deps) => (payload: unknown) => void
 *
 * Behaviors tested:
 * - Events with token data update metrics store with tokens and cost
 * - Events without token data update non-cost counters only (hookEventCount, toolCallCount, etc.)
 * - Pipeline: payload -> extract event_type -> build AggregatorEvent -> aggregateEvent -> update store
 * - Unknown/malformed payloads still increment hookEventCount
 * - No internal Norbert module imports (verified by import structure)
 */

import { describe, it, expect } from "vitest";
import { createHookProcessor } from "../../../../src/plugins/norbert-usage/hookProcessor";
import { createInitialMetrics } from "../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import { DEFAULT_PRICING_TABLE } from "../../../../src/plugins/norbert-usage/domain/pricingModel";
import type { SessionMetrics, PricingTable } from "../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Test helpers — pure function stubs for the metrics store effect boundary
// ---------------------------------------------------------------------------

/**
 * Creates a spy store that captures metrics updates.
 * The updateMetrics function accepts a reducer (prev => next) and applies it
 * to the current metrics state.
 */
const createSpyStore = (
  initialSessionId = "test-session",
): {
  getMetrics: () => SessionMetrics;
  updateMetrics: (reducer: (prev: SessionMetrics) => SessionMetrics) => void;
  updateCount: () => number;
} => {
  let metrics = createInitialMetrics(initialSessionId);
  let count = 0;

  return {
    getMetrics: () => metrics,
    updateMetrics: (reducer: (prev: SessionMetrics) => SessionMetrics) => {
      metrics = reducer(metrics);
      count += 1;
    },
    updateCount: () => count,
  };
};

/** Build a payload that includes token usage data. */
const makeTokenPayload = (
  eventType: string,
  inputTokens: number,
  outputTokens: number,
  model = "claude-sonnet-4-20250514",
): Record<string, unknown> => ({
  event_type: eventType,
  usage: {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    model,
  },
});

/** Build a payload without token usage data. */
const makeNonTokenPayload = (eventType: string): Record<string, unknown> => ({
  event_type: eventType,
});

// ---------------------------------------------------------------------------
// Token-bearing events update metrics store with tokens and cost
// ---------------------------------------------------------------------------

describe("hookProcessor with token-bearing events", () => {
  it("prompt_submit with tokens updates totalTokens and sessionCost", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    const payload = makeTokenPayload("prompt_submit", 1000, 500);
    processor(payload);

    const metrics = store.getMetrics();
    expect(metrics.totalTokens).toBe(1500);
    expect(metrics.inputTokens).toBe(1000);
    expect(metrics.outputTokens).toBe(500);
    expect(metrics.sessionCost).toBeGreaterThan(0);
    expect(metrics.hookEventCount).toBe(1);
  });

  it("tool_call_end with tokens updates totalTokens and sessionCost", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    const payload = makeTokenPayload("tool_call_end", 200, 800);
    processor(payload);

    const metrics = store.getMetrics();
    expect(metrics.totalTokens).toBe(1000);
    expect(metrics.sessionCost).toBeGreaterThan(0);
  });

  it("agent_complete with tokens updates tokens, cost, and decrements activeAgentCount", () => {
    const store = createSpyStore();
    // Pre-seed with a session_start so activeAgentCount > 0
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    // First, start a session
    processor(makeNonTokenPayload("session_start"));

    const metricsAfterStart = store.getMetrics();
    expect(metricsAfterStart.activeAgentCount).toBe(1);

    // Now agent_complete with tokens
    processor(makeTokenPayload("agent_complete", 500, 300));

    const metrics = store.getMetrics();
    expect(metrics.totalTokens).toBe(800);
    expect(metrics.sessionCost).toBeGreaterThan(0);
    expect(metrics.activeAgentCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Events without token data update non-cost counters only
// ---------------------------------------------------------------------------

describe("hookProcessor with non-token events", () => {
  it("tool_call_start increments toolCallCount without affecting tokens or cost", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeNonTokenPayload("tool_call_start"));

    const metrics = store.getMetrics();
    expect(metrics.toolCallCount).toBe(1);
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.hookEventCount).toBe(1);
  });

  it("session_start increments activeAgentCount and sets sessionStartedAt", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeNonTokenPayload("session_start"));

    const metrics = store.getMetrics();
    expect(metrics.activeAgentCount).toBe(1);
    expect(metrics.sessionStartedAt).not.toBe("");
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.hookEventCount).toBe(1);
  });

  it("unknown event type still increments hookEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeNonTokenPayload("some_unknown_event"));

    const metrics = store.getMetrics();
    expect(metrics.hookEventCount).toBe(1);
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: malformed and missing payloads
// ---------------------------------------------------------------------------

describe("hookProcessor with malformed payloads", () => {
  it("null payload does not throw and increments hookEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    expect(() => processor(null)).not.toThrow();
    expect(store.getMetrics().hookEventCount).toBe(1);
  });

  it("undefined payload does not throw and increments hookEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    expect(() => processor(undefined)).not.toThrow();
    expect(store.getMetrics().hookEventCount).toBe(1);
  });

  it("payload missing event_type field treats as unknown event", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor({ some_field: "value" });

    const metrics = store.getMetrics();
    expect(metrics.hookEventCount).toBe(1);
    expect(metrics.totalTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pipeline composition: multiple events accumulate correctly
// ---------------------------------------------------------------------------

describe("hookProcessor pipeline accumulation", () => {
  it("multiple token events accumulate tokens and cost monotonically", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeTokenPayload("prompt_submit", 1000, 500));
    const afterFirst = store.getMetrics();

    processor(makeTokenPayload("tool_call_end", 200, 100));
    const afterSecond = store.getMetrics();

    expect(afterSecond.totalTokens).toBe(1800);
    expect(afterSecond.sessionCost).toBeGreaterThan(afterFirst.sessionCost);
    expect(afterSecond.hookEventCount).toBe(2);
  });

  it("mixed token and non-token events both increment hookEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeTokenPayload("prompt_submit", 100, 50));
    processor(makeNonTokenPayload("tool_call_start"));
    processor(makeNonTokenPayload("session_start"));

    const metrics = store.getMetrics();
    expect(metrics.hookEventCount).toBe(3);
    expect(metrics.totalTokens).toBe(150);
    expect(metrics.toolCallCount).toBe(1);
    expect(metrics.activeAgentCount).toBe(1);
  });

  it("store updateMetrics is called once per processor invocation", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeTokenPayload("prompt_submit", 100, 50));
    processor(makeNonTokenPayload("tool_call_start"));

    expect(store.updateCount()).toBe(2);
  });
});
