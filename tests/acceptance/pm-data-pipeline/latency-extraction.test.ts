/**
 * Acceptance tests: Latency Extraction from OTel api_request Events
 *
 * Validates the full pipeline from duration_ms in an api_request payload
 * through metricsAggregator to hookProcessor to the PM latency category.
 *
 * Traces to: performance-monitor-design-spec.md "Metric Categories: Latency"
 */

import { describe, it, expect } from "vitest";

import { aggregateEvent, createInitialMetrics, type AggregatorEvent } from "../../../src/plugins/norbert-usage/domain/metricsAggregator";
import { DEFAULT_PRICING_TABLE } from "../../../src/plugins/norbert-usage/domain/pricingModel";
import { getCategoryById } from "../../../src/plugins/norbert-usage/domain/categoryConfig";
import { createHookProcessor, type HookProcessorDeps } from "../../../src/plugins/norbert-usage/hookProcessor";
import type { SessionMetrics } from "../../../src/plugins/norbert-usage/domain/types";
import type { CategorySampleInput } from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";

// ---------------------------------------------------------------------------
// UNIT: aggregateEvent extracts duration_ms into lastApiLatencyMs
// ---------------------------------------------------------------------------

describe("aggregateEvent extracts duration_ms from api_request", () => {
  it("lastApiLatencyMs is set from payload.usage.duration_ms", () => {
    // Given initial session metrics with zero latency
    const prev = createInitialMetrics("s1");
    expect(prev.lastApiLatencyMs).toBe(0);

    // When an api_request event with duration_ms arrives
    const event: AggregatorEvent = {
      eventType: "api_request",
      payload: {
        usage: {
          input_tokens: 500,
          output_tokens: 100,
          model: "claude-sonnet-4-20250514",
          duration_ms: 2504,
          cost_usd: 0.005,
        },
      },
      receivedAt: new Date().toISOString(),
    };
    const next = aggregateEvent(prev, event, DEFAULT_PRICING_TABLE, true);

    // Then lastApiLatencyMs captures the duration
    expect(next.lastApiLatencyMs).toBe(2504);
  });

  it("lastApiLatencyMs preserved when duration_ms is absent", () => {
    // Given metrics with a known latency from a previous request
    const prev = { ...createInitialMetrics("s1"), lastApiLatencyMs: 1500 };

    // When an api_request arrives WITHOUT duration_ms
    const event: AggregatorEvent = {
      eventType: "api_request",
      payload: {
        usage: {
          input_tokens: 200,
          output_tokens: 50,
          model: "claude-sonnet-4-20250514",
          cost_usd: 0.002,
        },
      },
      receivedAt: new Date().toISOString(),
    };
    const next = aggregateEvent(prev, event, DEFAULT_PRICING_TABLE, true);

    // Then the previous latency is preserved (not reset to 0)
    expect(next.lastApiLatencyMs).toBe(1500);
  });

  it("non-api_request events do not affect lastApiLatencyMs", () => {
    // Given metrics with known latency
    const prev = { ...createInitialMetrics("s1"), lastApiLatencyMs: 3000 };

    // When a tool_call_start event arrives
    const event: AggregatorEvent = {
      eventType: "tool_call_start",
      payload: {},
      receivedAt: new Date().toISOString(),
    };
    const next = aggregateEvent(prev, event, DEFAULT_PRICING_TABLE, true);

    // Then latency is unchanged
    expect(next.lastApiLatencyMs).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// INTEGRATION: hookProcessor feeds latency into category samples
// ---------------------------------------------------------------------------

describe("hookProcessor feeds lastApiLatencyMs into latency category sample", () => {
  it("api_request with duration_ms produces a latency category sample", () => {
    // Given a hook processor
    const sessionMetrics = new Map<string, SessionMetrics>();
    const appendedSamples: Array<{ sessionId: string; samples: CategorySampleInput }> = [];

    const deps: HookProcessorDeps = {
      updateMetrics: () => {},
      updateMultiSessionMetrics: (sessionId, _label, reducer) => {
        const prev = sessionMetrics.get(sessionId) ?? createInitialMetrics(sessionId);
        sessionMetrics.set(sessionId, reducer(prev));
      },
      appendSessionSample: (sessionId, samples) => {
        appendedSamples.push({ sessionId, samples });
      },
      pricingTable: DEFAULT_PRICING_TABLE,
    };

    const processor = createHookProcessor(deps);

    // When an api_request with duration_ms arrives
    processor({
      session_id: "s1",
      event_type: "api_request",
      payload: {
        usage: {
          input_tokens: 337,
          output_tokens: 12,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 22996,
          cost_usd: 0.144065,
          model: "claude-opus-4-6",
          duration_ms: 2504,
        },
      },
    });

    // Then the appended sample includes a latency value
    expect(appendedSamples.length).toBeGreaterThanOrEqual(1);
    const lastSample = appendedSamples[appendedSamples.length - 1];
    expect(lastSample.samples.latency).toBe(2504);
  });
});

// ---------------------------------------------------------------------------
// FORMAT: latency display values
// ---------------------------------------------------------------------------

describe("Latency formatting covers edge cases", () => {
  const latency = getCategoryById("latency")!;

  it("zero latency shows 0ms", () => {
    expect(latency.formatValue(0)).toBe("0ms");
  });

  it("sub-second latency shows milliseconds", () => {
    expect(latency.formatValue(423)).toBe("423ms");
  });

  it("exactly 1000ms shows 1.0s", () => {
    expect(latency.formatValue(1000)).toBe("1.0s");
  });

  it("multi-second latency shows seconds", () => {
    expect(latency.formatValue(2504)).toBe("2.5s");
  });

  it("long latency shows seconds", () => {
    expect(latency.formatValue(15200)).toBe("15.2s");
  });
});
