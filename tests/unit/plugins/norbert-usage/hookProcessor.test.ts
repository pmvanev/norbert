/**
 * Unit tests: Hook Processor (Step 03-02)
 *
 * Factory function: createHookProcessor(deps) => (payload: unknown) => void
 *
 * Behaviors tested:
 * - Events with token data update metrics store with tokens and cost
 * - Events without token data update non-cost counters only (totalEventCount, toolCallCount, etc.)
 * - Pipeline: payload -> extract event_type -> build AggregatorEvent -> aggregateEvent -> update store
 * - Unknown/malformed payloads still increment totalEventCount
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
    expect(metrics.totalEventCount).toBe(1);
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
    expect(metrics.totalEventCount).toBe(1);
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
    expect(metrics.totalEventCount).toBe(1);
  });

  it("unknown event type still increments totalEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeNonTokenPayload("some_unknown_event"));

    const metrics = store.getMetrics();
    expect(metrics.totalEventCount).toBe(1);
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Wrapped payload from get_session_events (production format)
// ---------------------------------------------------------------------------

describe("hookProcessor with DB event wrapper", () => {
  it("extracts tokens from nested payload field (production event format)", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    // This matches the structure returned by Tauri IPC get_session_events:
    // { session_id, event_type, payload: { ...raw claude code fields... }, received_at, provider }
    const wrappedEvent = {
      session_id: "sess-123",
      event_type: "tool_call_end",
      payload: {
        session_id: "sess-123",
        tool: "Read",
        usage: {
          input_tokens: 800,
          output_tokens: 200,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          model: "claude-sonnet-4-20250514",
        },
      },
      received_at: "2026-03-13T22:00:00Z",
      provider: "claude_code",
    };

    processor(wrappedEvent);

    const metrics = store.getMetrics();
    expect(metrics.totalTokens).toBe(1000);
    expect(metrics.inputTokens).toBe(800);
    expect(metrics.outputTokens).toBe(200);
    expect(metrics.sessionCost).toBeGreaterThan(0);
    expect(metrics.totalEventCount).toBe(1);
  });

  it("session_start wrapped event increments activeAgentCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    const wrappedEvent = {
      session_id: "sess-123",
      event_type: "session_start",
      payload: { session_id: "sess-123" },
      received_at: "2026-03-13T22:00:00Z",
      provider: "claude_code",
    };

    processor(wrappedEvent);

    const metrics = store.getMetrics();
    expect(metrics.activeAgentCount).toBe(1);
    expect(metrics.totalEventCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: malformed and missing payloads
// ---------------------------------------------------------------------------

describe("hookProcessor with malformed payloads", () => {
  it("null payload does not throw and increments totalEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    expect(() => processor(null)).not.toThrow();
    expect(store.getMetrics().totalEventCount).toBe(1);
  });

  it("undefined payload does not throw and increments totalEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    expect(() => processor(undefined)).not.toThrow();
    expect(store.getMetrics().totalEventCount).toBe(1);
  });

  it("payload missing event_type field treats as unknown event", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor({ some_field: "value" });

    const metrics = store.getMetrics();
    expect(metrics.totalEventCount).toBe(1);
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
    expect(afterSecond.totalEventCount).toBe(2);
  });

  it("mixed token and non-token events both increment totalEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeTokenPayload("prompt_submit", 100, 50));
    processor(makeNonTokenPayload("tool_call_start"));
    processor(makeNonTokenPayload("session_start"));

    const metrics = store.getMetrics();
    expect(metrics.totalEventCount).toBe(3);
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

// ---------------------------------------------------------------------------
// isOtelActive passthrough via getIsOtelActive dependency (D1)
// ---------------------------------------------------------------------------

describe("hookProcessor passes isOtelActive to aggregateEvent", () => {
  it("when getIsOtelActive returns true, OTel cost path is used (hook cost suppressed)", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
      getIsOtelActive: () => true,
    });

    // prompt_submit with tokens: when OTel is active, cost should NOT increase
    const payload = {
      session_id: "sess-otel",
      event_type: "prompt_submit",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        model: "claude-sonnet-4-20250514",
      },
    };
    processor(payload);

    const metrics = store.getMetrics();
    // OTel-active suppresses hook token/cost contribution for prompt_submit
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.totalEventCount).toBe(1);
  });

  it("when getIsOtelActive is undefined, aggregateEvent receives false (backward compat)", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
      // getIsOtelActive not provided
    });

    const payload = makeTokenPayload("prompt_submit", 1000, 500);
    processor(payload);

    const metrics = store.getMetrics();
    // Hook-only: cost should be computed via pricing model
    expect(metrics.sessionCost).toBeGreaterThan(0);
    expect(metrics.totalTokens).toBe(1500);
  });

  it("when getIsOtelActive returns false, aggregateEvent receives false", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
      getIsOtelActive: () => false,
    });

    const payload = makeTokenPayload("prompt_submit", 1000, 500);
    processor(payload);

    const metrics = store.getMetrics();
    // Hook-only: cost should be computed via pricing model
    expect(metrics.sessionCost).toBeGreaterThan(0);
    expect(metrics.totalTokens).toBe(1500);
  });
});
