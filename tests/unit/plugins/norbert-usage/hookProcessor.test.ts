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
  // Policy: cost and token counters are credited EXCLUSIVELY by OTel
  // api_request events. Hook-path events (prompt_submit, tool_call_end,
  // agent_complete) still carry a usage record -- it's used to refresh
  // the context-window snapshot -- but they do not contribute to
  // sessionCost / totalTokens.

  it("hook prompt_submit with tokens does NOT credit totalTokens or sessionCost", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    const payload = makeTokenPayload("prompt_submit", 1000, 500);
    processor(payload);

    const metrics = store.getMetrics();
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.inputTokens).toBe(0);
    expect(metrics.outputTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.totalEventCount).toBe(1);
    // Context window snapshot IS refreshed from hook usage.
    expect(metrics.contextWindowTokens).toBe(1000);
  });

  it("hook tool_call_end with tokens does NOT credit totalTokens or sessionCost", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    const payload = makeTokenPayload("tool_call_end", 200, 800);
    processor(payload);

    const metrics = store.getMetrics();
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.contextWindowTokens).toBe(200);
  });

  it("OTel api_request with tokens is the only path that credits cost", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeTokenPayload("api_request", 1000, 500));

    const metrics = store.getMetrics();
    expect(metrics.totalTokens).toBe(1500);
    expect(metrics.inputTokens).toBe(1000);
    expect(metrics.outputTokens).toBe(500);
    expect(metrics.sessionCost).toBeGreaterThan(0);
    expect(metrics.apiRequestCount).toBe(1);
  });

  it("agent_complete decrements activeAgentCount without crediting tokens/cost", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeNonTokenPayload("session_start"));
    expect(store.getMetrics().activeAgentCount).toBe(1);

    processor(makeTokenPayload("agent_complete", 500, 300));

    const metrics = store.getMetrics();
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.activeAgentCount).toBe(0);
    // Context window is still refreshed from the usage record.
    expect(metrics.contextWindowTokens).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Events without token data update non-cost counters only
// ---------------------------------------------------------------------------

describe("hookProcessor with non-token events", () => {
  it("tool_result increments toolCallCount without affecting tokens or cost", () => {
    // Tool counts are sourced from tool_result (OTel post-tool signal)
    // under the OTel-authoritative policy so that sessions emitting
    // both hook PreToolUse (tool_call_start) and OTel tool_result don't
    // double-count a single tool invocation.
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeNonTokenPayload("tool_result"));

    const metrics = store.getMetrics();
    expect(metrics.toolCallCount).toBe(1);
    expect(metrics.totalTokens).toBe(0);
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.totalEventCount).toBe(1);
  });

  it("tool_call_start (hook PreToolUse) is an identity signal under the OTel-first policy", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeNonTokenPayload("tool_call_start"));

    const metrics = store.getMetrics();
    expect(metrics.toolCallCount).toBe(0);
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
  it("extracts usage from a nested api_request payload (production event format)", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    // This matches the structure returned by Tauri IPC get_session_events:
    // { session_id, event_type, payload: { ...raw claude code fields... }, received_at, provider }
    // api_request is the only path that credits tokens/cost under the
    // OTel-authoritative policy.
    const wrappedEvent = {
      session_id: "sess-123",
      event_type: "api_request",
      payload: {
        session_id: "sess-123",
        usage: {
          input_tokens: 800,
          output_tokens: 200,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          model: "claude-sonnet-4-20250514",
        },
      },
      received_at: "2026-03-13T22:00:00Z",
      provider: "otel",
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
  it("multiple api_request events accumulate tokens and cost monotonically", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeTokenPayload("api_request", 1000, 500));
    const afterFirst = store.getMetrics();

    processor(makeTokenPayload("api_request", 200, 100));
    const afterSecond = store.getMetrics();

    expect(afterSecond.totalTokens).toBe(1800);
    expect(afterSecond.sessionCost).toBeGreaterThan(afterFirst.sessionCost);
    expect(afterSecond.totalEventCount).toBe(2);
    expect(afterSecond.apiRequestCount).toBe(2);
  });

  it("hook and api_request events interleave: only api_request credits cost", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    // A hook prompt_submit with usage should refresh context but not cost.
    processor(makeTokenPayload("prompt_submit", 100, 50));
    const afterHook = store.getMetrics();
    expect(afterHook.sessionCost).toBe(0);
    expect(afterHook.totalTokens).toBe(0);

    // Followed by the real OTel api_request for the same request: this
    // is what should be credited.
    processor(makeTokenPayload("api_request", 100, 50));
    const afterOtel = store.getMetrics();
    expect(afterOtel.totalTokens).toBe(150);
    expect(afterOtel.sessionCost).toBeGreaterThan(0);
  });

  it("mixed api_request, tool_result, and session_start events all increment totalEventCount", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeTokenPayload("api_request", 100, 50));
    processor(makeNonTokenPayload("tool_result"));
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

describe("hookProcessor: hook events never credit cost (OTel-authoritative policy)", () => {
  // Under the OTel-authoritative cost policy, the getIsOtelActive
  // dependency and the provider="otel" auto-detection are no longer
  // load-bearing for cost -- the aggregator itself refuses to credit
  // cost from hook-path event types regardless of mode. These tests
  // pin that invariant so a future regression would fail loudly.

  it("hook prompt_submit never credits cost, even with getIsOtelActive=false", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
      getIsOtelActive: () => false,
    });

    processor(makeTokenPayload("prompt_submit", 1000, 500));

    const metrics = store.getMetrics();
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.totalTokens).toBe(0);
  });

  it("hook prompt_submit never credits cost, even with getIsOtelActive undefined", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    processor(makeTokenPayload("prompt_submit", 1000, 500));

    const metrics = store.getMetrics();
    expect(metrics.sessionCost).toBe(0);
    expect(metrics.totalTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// OTel detection via provider tag (auto-flips a session to OTel mode on
// the first event marked provider="otel", so subsequent hook-provider
// events stop crediting cost and avoid double-counting)
// ---------------------------------------------------------------------------

describe("hookProcessor: mixed hook + OTel stream never double-counts cost", () => {
  // Regression guard for the double-counting bug: previously the
  // aggregator credited cost from hook prompt_submit/tool_call_end AND
  // from the subsequent OTel api_request reporting the same tokens. The
  // new OTel-authoritative policy must keep cost scoped to api_request
  // no matter how the two streams interleave.

  const withProvider = (
    payload: Record<string, unknown>,
    provider: string,
    sessionId = "sess-mixed",
  ): Record<string, unknown> => ({
    ...payload,
    session_id: sessionId,
    provider,
  });

  it("hook + OTel for the same request: only the OTel cost is credited", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    // Hook prompt_submit arrives first -- no cost should be credited.
    processor(withProvider(makeTokenPayload("prompt_submit", 1000, 500), "hook"));
    expect(store.getMetrics().sessionCost).toBe(0);

    // Then the OTel api_request for the same request -- THIS credits cost.
    processor(withProvider(makeTokenPayload("api_request", 1000, 500), "otel"));
    const afterOtel = store.getMetrics();
    expect(afterOtel.sessionCost).toBeGreaterThan(0);
    expect(afterOtel.totalTokens).toBe(1500);

    // A later hook tool_call_end reports the same usage again (Claude
    // Code fires both). Cost must NOT increase -- only context refresh.
    const costSnapshot = afterOtel.sessionCost;
    processor(withProvider(makeTokenPayload("tool_call_end", 1000, 500), "hook"));
    expect(store.getMetrics().sessionCost).toBe(costSnapshot);
  });

  it("cost scaling is per api_request only, regardless of interleaved hooks", () => {
    const store = createSpyStore();
    const processor = createHookProcessor({
      updateMetrics: store.updateMetrics,
      pricingTable: DEFAULT_PRICING_TABLE,
    });

    // Three hook events around one api_request should yield exactly one
    // cost contribution.
    processor(withProvider(makeTokenPayload("prompt_submit", 100, 50), "hook"));
    processor(withProvider(makeTokenPayload("tool_call_end", 100, 50), "hook"));
    processor(withProvider(makeTokenPayload("api_request", 100, 50), "otel"));
    processor(withProvider(makeTokenPayload("tool_call_end", 100, 50), "hook"));
    processor(withProvider(makeTokenPayload("agent_complete", 100, 50), "hook"));

    const metrics = store.getMetrics();
    // totalTokens reflects exactly ONE api_request worth of tokens.
    expect(metrics.totalTokens).toBe(150);
    expect(metrics.apiRequestCount).toBe(1);
  });
});
