/**
 * Acceptance tests: Token and Cost Data Extraction (US-002)
 *
 * Validates that the norbert-usage domain functions correctly extract
 * token counts from hook event payloads, calculate dollar costs using
 * the pricing model, and maintain running aggregates.
 *
 * Driving ports: pure domain functions (tokenExtractor, pricingModel,
 * metricsAggregator, burnRate calculator)
 *
 * Traces to: US-002 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  extractTokenUsage,
  type TokenExtractionResult,
} from "../../../src/plugins/norbert-usage/domain/tokenExtractor";
import {
  calculateCost,
  DEFAULT_PRICING_TABLE,
  type PricingTable,
} from "../../../src/plugins/norbert-usage/domain/pricingModel";
import {
  aggregateEvent,
  createInitialMetrics,
  type SessionMetrics,
} from "../../../src/plugins/norbert-usage/domain/metricsAggregator";
import {
  calculateBurnRate,
} from "../../../src/plugins/norbert-usage/domain/burnRate";

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User sees accurate cost computed from hook events", () => {
  it("token event flows through extraction, pricing, and aggregation to produce session cost", () => {
    // Given a prompt_submit event payload from an Opus 4 session
    // with 1,200 input tokens and 3,400 output tokens
    const payload = {
      usage: {
        input_tokens: 1200,
        output_tokens: 3400,
        model: "claude-opus-4-20250514",
      },
    };

    // When the plugin extracts token data from the payload
    const extraction = extractTokenUsage(payload);
    expect(extraction.tag).toBe("found");
    if (extraction.tag !== "found") return;

    // And applies Opus 4 pricing
    const cost = calculateCost(extraction.usage, DEFAULT_PRICING_TABLE);

    // Then the cost is correctly calculated:
    // input: 1200 * $0.015/1k = $0.018
    // output: 3400 * $0.075/1k = $0.255
    // total: $0.273
    expect(cost.totalCost).toBeCloseTo(0.273, 3);
    expect(cost.inputCost).toBeCloseTo(0.018, 3);
    expect(cost.outputCost).toBeCloseTo(0.255, 3);

    // And when aggregated into session metrics starting at $1.20
    const previousMetrics = {
      ...createInitialMetrics("refactor-auth"),
      sessionCost: 1.2,
      totalTokens: 50000,
      inputTokens: 25000,
      outputTokens: 25000,
    };

    const event = {
      eventType: "prompt_submit" as const,
      payload,
      receivedAt: new Date().toISOString(),
    };
    const updated = aggregateEvent(previousMetrics, event, DEFAULT_PRICING_TABLE);

    // Then the session cost updates to approximately $1.47
    expect(updated.sessionCost).toBeCloseTo(1.473, 2);
    // And the total token count increases by 4,600
    expect(updated.totalTokens).toBe(54600);
    expect(updated.inputTokens).toBe(26200);
    expect(updated.outputTokens).toBe(28400);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Token Extraction
// ---------------------------------------------------------------------------

describe("Token counts extracted from event payloads", () => {
  it("extracts input and output tokens with model from usage fields", () => {
    // Given a tool_call_end event payload with usage data
    const payload = {
      usage: {
        input_tokens: 500,
        output_tokens: 1200,
        model: "claude-sonnet-4-20250514",
      },
    };

    // When token data is extracted
    const result = extractTokenUsage(payload);

    // Then extraction succeeds with correct token counts
    expect(result.tag).toBe("found");
    if (result.tag === "found") {
      expect(result.usage.inputTokens).toBe(500);
      expect(result.usage.outputTokens).toBe(1200);
      expect(result.usage.model).toBe("claude-sonnet-4-20250514");
    }
  });

  it("extracts cache token counts when present", () => {
    // Given an event payload with cache token data
    const payload = {
      usage: {
        input_tokens: 800,
        output_tokens: 2000,
        model: "claude-opus-4-20250514",
        cache_read_input_tokens: 5000,
        cache_creation_input_tokens: 1000,
      },
    };

    // When token data is extracted
    const result = extractTokenUsage(payload);

    // Then cache tokens are included
    expect(result.tag).toBe("found");
    if (result.tag === "found") {
      expect(result.usage.cacheReadTokens).toBe(5000);
      expect(result.usage.cacheCreationTokens).toBe(1000);
    }
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Pricing Model
// ---------------------------------------------------------------------------

describe("Correct pricing applied for mixed-model sessions", () => {
  it("Sonnet 4 events priced at Sonnet rates, not Opus rates", () => {
    // Given a specialist event using Sonnet 4 with 800 input and 2,000 output tokens
    const sonnetUsage = {
      inputTokens: 800,
      outputTokens: 2000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      model: "claude-sonnet-4-20250514",
    };

    // When pricing is applied
    const cost = calculateCost(sonnetUsage, DEFAULT_PRICING_TABLE);

    // Then the cost uses Sonnet 4 rates:
    // input: 800 * $0.003/1k = $0.0024
    // output: 2000 * $0.015/1k = $0.030
    expect(cost.inputCost).toBeCloseTo(0.0024, 4);
    expect(cost.outputCost).toBeCloseTo(0.03, 4);
    expect(cost.totalCost).toBeCloseTo(0.0324, 4);
    expect(cost.model).toBe("claude-sonnet-4-20250514");
  });
});

describe("Pricing includes cache token costs", () => {
  it("cache read and creation tokens priced at model-specific cache rates", () => {
    // Given an Opus 4 event with cache tokens
    const usage = {
      inputTokens: 1000,
      outputTokens: 2000,
      cacheReadTokens: 5000,
      cacheCreationTokens: 1000,
      model: "claude-opus-4-20250514",
    };

    // When pricing is applied
    const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

    // Then cache costs are included:
    // cache read: 5000 * $0.0015/1k = $0.0075
    // cache creation: 1000 * $0.01875/1k = $0.01875
    expect(cost.cacheCost).toBeCloseTo(0.02625, 4);
    // And total includes all components
    const expectedTotal = 0.015 + 0.15 + 0.0075 + 0.01875;
    expect(cost.totalCost).toBeCloseTo(expectedTotal, 4);
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Events without token data handled gracefully", () => {
  it("tool_call_start event increments tool count without affecting cost", () => {
    // Given an active session with $1.20 cost and 5 tool calls
    const metrics: SessionMetrics = {
      ...createInitialMetrics("test-session"),
      sessionCost: 1.2,
      toolCallCount: 5,
      totalTokens: 50000,
    };

    // When a tool_call_start event arrives without token fields
    const event = {
      eventType: "tool_call_start" as const,
      payload: { tool: "bash" },
      receivedAt: new Date().toISOString(),
    };
    const updated = aggregateEvent(metrics, event, DEFAULT_PRICING_TABLE);

    // Then the tool call count increments to 6
    expect(updated.toolCallCount).toBe(6);
    // And the session cost remains $1.20
    expect(updated.sessionCost).toBe(1.2);
    // And the total token count remains unchanged
    expect(updated.totalTokens).toBe(50000);
  });

  it("event with missing usage object returns absent extraction", () => {
    // Given a session_start event payload with no usage field
    const payload = { session_id: "s1" };

    // When token extraction is attempted
    const result = extractTokenUsage(payload);

    // Then extraction returns absent (no false zeros)
    expect(result.tag).toBe("absent");
  });
});

describe("Unknown model falls back to conservative pricing", () => {
  it("unrecognized model uses most expensive (Opus) rates as safety margin", () => {
    // Given an event with a model string not matching any known pattern
    const usage = {
      inputTokens: 1000,
      outputTokens: 1000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      model: "claude-unknown-model-v99",
    };

    // When pricing is applied
    const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

    // Then fallback (Opus) pricing is used
    // input: 1000 * $0.015/1k = $0.015
    // output: 1000 * $0.075/1k = $0.075
    expect(cost.totalCost).toBeCloseTo(0.09, 3);
  });
});

describe("Active agent count derived from session events", () => {
  it("session_start increments and agent_complete decrements agent count", () => {
    // Given an empty session
    let metrics = createInitialMetrics("multi-agent");

    // When 2 session_start events arrive
    metrics = aggregateEvent(
      metrics,
      { eventType: "session_start", payload: {}, receivedAt: new Date().toISOString() },
      DEFAULT_PRICING_TABLE
    );
    metrics = aggregateEvent(
      metrics,
      { eventType: "session_start", payload: {}, receivedAt: new Date().toISOString() },
      DEFAULT_PRICING_TABLE
    );

    // Then active agent count is 2
    expect(metrics.activeAgentCount).toBe(2);

    // When 1 agent_complete event arrives
    metrics = aggregateEvent(
      metrics,
      { eventType: "agent_complete", payload: {}, receivedAt: new Date().toISOString() },
      DEFAULT_PRICING_TABLE
    );

    // Then active agent count drops to 1
    expect(metrics.activeAgentCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// ---------------------------------------------------------------------------

// @property
describe("Session cost is never negative regardless of events", () => {
  it("cost accumulation never produces a negative total", () => {
    // Given any sequence of events processed through the aggregator
    let metrics = createInitialMetrics("property-test");

    // When multiple events are aggregated (including events with zero tokens)
    const events = [
      { eventType: "prompt_submit" as const, payload: { usage: { input_tokens: 100, output_tokens: 50, model: "claude-opus-4" } }, receivedAt: "2025-01-01T00:00:01Z" },
      { eventType: "tool_call_start" as const, payload: { tool: "bash" }, receivedAt: "2025-01-01T00:00:02Z" },
      { eventType: "tool_call_end" as const, payload: { usage: { input_tokens: 0, output_tokens: 0, model: "claude-opus-4" } }, receivedAt: "2025-01-01T00:00:03Z" },
      { eventType: "session_start" as const, payload: {}, receivedAt: "2025-01-01T00:00:04Z" },
      { eventType: "agent_complete" as const, payload: {}, receivedAt: "2025-01-01T00:00:05Z" },
    ];

    for (const event of events) {
      metrics = aggregateEvent(metrics, event, DEFAULT_PRICING_TABLE);
    }

    // Then the session cost is greater than or equal to zero
    expect(metrics.sessionCost).toBeGreaterThanOrEqual(0);
    expect(metrics.totalTokens).toBeGreaterThanOrEqual(0);
  });
});
