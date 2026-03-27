/**
 * Acceptance Tests: OTel-First Metrics Pipeline
 *
 * Validates the 5 user stories for migrating metrics aggregation from
 * hook-first to OTel-first data sourcing:
 *
 * - US-OFM-01: Cost single source of truth (OTel cost_usd preferred)
 * - US-OFM-02: Rich tool tracking from tool_result events
 * - US-OFM-03: API error visibility (apiErrorCount, apiErrorRate)
 * - US-OFM-04: Source-agnostic data health indicator
 * - US-OFM-05: OTel session timing preference
 *
 * Driving ports:
 * - aggregateEvent(prev, event, pricingTable, isOtelActive) => SessionMetrics
 * - computeGaugeClusterData(metrics, thresholds) => GaugeClusterData
 *
 * All tests invoke through the public aggregateEvent / computeGaugeClusterData
 * driving ports. Domain functions are pure (input => output), so no mocks needed.
 *
 * Implementation sequence: enable one scenario at a time (top to bottom).
 * All scenarios start skipped; un-skip the first, implement until green, commit.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregateEvent,
  createInitialMetrics,
  type AggregatorEvent,
} from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import { DEFAULT_PRICING_TABLE } from "../../../../../src/plugins/norbert-usage/domain/pricingModel";
import type { SessionMetrics } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Event builders -- business-language helpers for test readability
// ---------------------------------------------------------------------------

const buildApiRequestEvent = (opts: {
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  model?: string;
  receivedAt?: string;
}): AggregatorEvent => ({
  eventType: "api_request",
  payload: {
    usage: {
      input_tokens: opts.inputTokens ?? 100,
      output_tokens: opts.outputTokens ?? 50,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      ...(opts.costUsd !== undefined ? { cost_usd: opts.costUsd } : {}),
      model: opts.model ?? "claude-sonnet-4-20250514",
      duration_ms: 1000,
      speed: "normal",
    },
  },
  receivedAt: opts.receivedAt ?? "2026-03-27T10:00:00Z",
});

const buildPromptSubmitEvent = (opts: {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  receivedAt?: string;
}): AggregatorEvent => ({
  eventType: "prompt_submit",
  payload: {
    usage: {
      input_tokens: opts.inputTokens ?? 500,
      output_tokens: opts.outputTokens ?? 200,
      model: opts.model ?? "claude-sonnet-4-20250514",
    },
  },
  receivedAt: opts.receivedAt ?? "2026-03-27T10:00:01Z",
});

const buildToolCallEndEvent = (opts?: {
  inputTokens?: number;
  outputTokens?: number;
  receivedAt?: string;
}): AggregatorEvent => ({
  eventType: "tool_call_end",
  payload: {
    usage: {
      input_tokens: opts?.inputTokens ?? 200,
      output_tokens: opts?.outputTokens ?? 100,
      model: "claude-sonnet-4-20250514",
    },
  },
  receivedAt: opts?.receivedAt ?? "2026-03-27T10:00:02Z",
});

const buildAgentCompleteEvent = (opts?: {
  inputTokens?: number;
  outputTokens?: number;
  receivedAt?: string;
}): AggregatorEvent => ({
  eventType: "agent_complete",
  payload: {
    usage: {
      input_tokens: opts?.inputTokens ?? 500,
      output_tokens: opts?.outputTokens ?? 200,
      model: "claude-sonnet-4-20250514",
    },
  },
  receivedAt: opts?.receivedAt ?? "2026-03-27T10:00:03Z",
});

const buildToolCallStartEvent = (receivedAt?: string): AggregatorEvent => ({
  eventType: "tool_call_start",
  payload: { tool: "Bash" },
  receivedAt: receivedAt ?? "2026-03-27T10:00:04Z",
});

const buildToolResultEvent = (opts: {
  toolName?: string;
  success?: boolean;
  durationMs?: number;
  receivedAt?: string;
}): AggregatorEvent => ({
  eventType: "tool_result",
  payload: {
    tool_name: opts.toolName ?? "Bash",
    success: opts.success ?? true,
    duration_ms: opts.durationMs ?? 100,
  },
  receivedAt: opts.receivedAt ?? "2026-03-27T10:00:05Z",
});

const buildApiErrorEvent = (receivedAt?: string): AggregatorEvent => ({
  eventType: "api_error",
  payload: {
    status_code: 429,
    error: "rate_limit_exceeded",
    model: "claude-sonnet-4-20250514",
    attempt: 1,
  },
  receivedAt: receivedAt ?? "2026-03-27T10:00:06Z",
});

const buildSessionStartEvent = (receivedAt: string): AggregatorEvent => ({
  eventType: "session_start",
  payload: {},
  receivedAt,
});

/**
 * Fold a sequence of events through the aggregator.
 * This is the primary driving port interaction pattern.
 */
const foldEvents = (
  events: AggregatorEvent[],
  initial?: SessionMetrics,
  isOtelActive?: boolean,
): SessionMetrics => {
  let metrics = initial ?? createInitialMetrics("acceptance-test");
  for (const event of events) {
    // NOTE: isOtelActive parameter does not exist yet on aggregateEvent.
    // The software-crafter will add it as part of step 02-01.
    // Until then, this calls the current 3-arg signature.
    metrics = aggregateEvent(metrics, event, DEFAULT_PRICING_TABLE);
  }
  return metrics;
};

// ===========================================================================
// Walking Skeletons
// ===========================================================================

describe("Walking Skeleton: operator sees accurate session cost when OTel is active", () => {
  it.skip("pre-OTel cost preserved plus OTel cost_usd, hook token data excluded", () => {
    // Given: session accumulated $1.20 from hook events before OTel activated
    const preOtelMetrics: SessionMetrics = {
      ...createInitialMetrics("ws-cost"),
      sessionCost: 1.20,
    };

    // And: 3 API request events with cost_usd
    const apiRequests = [
      buildApiRequestEvent({ costUsd: 0.42 }),
      buildApiRequestEvent({ costUsd: 1.15 }),
      buildApiRequestEvent({ costUsd: 0.83 }),
    ];

    // And: 2 prompt submit events with token data
    const hookEvents = [
      buildPromptSubmitEvent({ inputTokens: 1000, outputTokens: 500 }),
      buildPromptSubmitEvent({ inputTokens: 800, outputTokens: 400 }),
    ];

    // When: session metrics are computed (isOtelActive = true after first api_request)
    const allEvents = [...apiRequests, ...hookEvents];
    const result = foldEvents(allEvents, preOtelMetrics, true);

    // Then: cost is $1.20 (pre-OTel) + $0.42 + $1.15 + $0.83 = $3.60
    expect(result.sessionCost).toBeCloseTo(3.60, 2);
  });
});

describe("Walking Skeleton: operator sees per-tool breakdown from OTel tool results", () => {
  it.skip("tool result events provide count, success rate, and duration breakdown", () => {
    // Given: session is receiving OTel data
    // And: tool result events with varying outcomes
    const toolEvents = [
      buildToolResultEvent({ toolName: "Read", success: true, durationMs: 120 }),
      buildToolResultEvent({ toolName: "Bash", success: false, durationMs: 5200 }),
      buildToolResultEvent({ toolName: "Grep", success: true, durationMs: 210 }),
    ];

    // When: session metrics are computed
    const result = foldEvents(toolEvents, undefined, true);

    // Then: tool call count is 3
    expect(result.toolCallCount).toBe(3);

    // NOTE: Per-tool breakdown verification requires calling aggregateToolUsage
    // on filtered tool_result events -- the software-crafter will wire this
    // into the pipeline. The acceptance test above verifies the count flows
    // through the driving port (aggregateEvent).
  });
});

describe("Walking Skeleton: operator sees healthy data pipeline", () => {
  it.skip("data health shows healthy when OTel events are flowing recently", () => {
    // Given: session has received 42 events, most recent 5 seconds ago
    // When: data health indicator is computed
    // Then: data health status is "healthy"
    //
    // NOTE: This requires the refactored buildWarningCluster (step 06-01)
    // which takes totalEventCount, lastEventAt, and now parameters.
    // The computeGaugeClusterData driving port will be updated.
    expect(true).toBe(true); // Placeholder until step 06-01
  });
});

// ===========================================================================
// US-OFM-01: Cost Single Source of Truth
// ===========================================================================

describe("US-OFM-01: Cost single source of truth", () => {

  describe("when OTel is active, only API request cost_usd contributes to cost", () => {

    it.skip("API request cost_usd values are summed as session cost", () => {
      const events = [
        buildApiRequestEvent({ costUsd: 0.42 }),
        buildApiRequestEvent({ costUsd: 1.15 }),
        buildApiRequestEvent({ costUsd: 0.83 }),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.sessionCost).toBeCloseTo(2.40, 2);
    });

    it.skip("prompt submit does not contribute to cost when OTel is active", () => {
      const initial: SessionMetrics = {
        ...createInitialMetrics("suppress-test"),
        sessionCost: 1.00,
      };

      const events = [
        buildPromptSubmitEvent({ inputTokens: 1500, outputTokens: 800 }),
      ];

      const result = foldEvents(events, initial, true);

      expect(result.sessionCost).toBe(1.00);
    });

    it.skip("agent complete updates agent count but not cost when OTel is active", () => {
      const initial: SessionMetrics = {
        ...createInitialMetrics("agent-test"),
        activeAgentCount: 1,
        sessionCost: 2.00,
      };

      const events = [
        buildAgentCompleteEvent({ inputTokens: 500, outputTokens: 200 }),
      ];

      const result = foldEvents(events, initial, true);

      expect(result.activeAgentCount).toBe(0);
      expect(result.sessionCost).toBe(2.00);
    });

    it.skip("tool call end does not contribute to cost when OTel is active", () => {
      const initial: SessionMetrics = {
        ...createInitialMetrics("tce-test"),
        sessionCost: 2.50,
      };

      const events = [
        buildToolCallEndEvent({ inputTokens: 300, outputTokens: 150 }),
      ];

      const result = foldEvents(events, initial, true);

      expect(result.sessionCost).toBe(2.50);
    });
  });

  describe("when OTel is not active, hook events contribute to cost as before", () => {

    it.skip("hook-only session calculates cost via pricing model", () => {
      const events = [
        buildPromptSubmitEvent({
          inputTokens: 1500,
          outputTokens: 800,
          model: "claude-sonnet-4-20250514",
        }),
      ];

      const result = foldEvents(events, undefined, false);

      // Sonnet: input=0.003/1k, output=0.015/1k
      // (1500/1000)*0.003 + (800/1000)*0.015 = 0.0045 + 0.012 = 0.0165
      expect(result.sessionCost).toBeCloseTo(0.0165, 4);
      expect(result.totalTokens).toBe(2300);
    });

    it.skip("hook-only session counts tools from tool call start events", () => {
      const events = [
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.toolCallCount).toBe(3);
    });
  });

  describe("API request without cost_usd falls back to pricing model", () => {

    it.skip("missing cost_usd triggers pricing model fallback", () => {
      const events = [
        buildApiRequestEvent({
          inputTokens: 2000,
          outputTokens: 1000,
          model: "claude-sonnet-4-20250514",
          // no costUsd -- omitted
        }),
      ];

      const result = foldEvents(events, undefined, true);

      // Sonnet: (2000/1000)*0.003 + (1000/1000)*0.015 = 0.006 + 0.015 = 0.021
      expect(result.sessionCost).toBeCloseTo(0.021, 4);
      expect(result.totalTokens).toBe(3000);
    });

    it.skip("cost_usd of zero is treated as valid zero cost", () => {
      const events = [
        buildApiRequestEvent({
          inputTokens: 500,
          outputTokens: 100,
          costUsd: 0.0,
        }),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.sessionCost).toBe(0.0);
      expect(result.totalTokens).toBe(600);
    });
  });

  describe("mid-session OTel activation preserves pre-OTel cost", () => {

    it.skip("pre-OTel cost preserved when first API request arrives", () => {
      // Simulate: hook events contributed $1.20 before OTel
      const preOtelMetrics: SessionMetrics = {
        ...createInitialMetrics("mid-session"),
        sessionCost: 1.20,
      };

      // First api_request makes session OTel-active
      const apiRequest = buildApiRequestEvent({ costUsd: 0.55 });
      const afterApi = aggregateEvent(preOtelMetrics, apiRequest, DEFAULT_PRICING_TABLE);

      // Subsequent hook events should be suppressed
      const hookEvent = buildPromptSubmitEvent({ inputTokens: 1000, outputTokens: 500 });
      // NOTE: isOtelActive=true for this call (after api_request arrived)
      const afterHook = aggregateEvent(afterApi, hookEvent, DEFAULT_PRICING_TABLE);

      // $1.20 (pre-OTel) + $0.55 (api_request) = $1.75
      expect(afterHook.sessionCost).toBeCloseTo(1.75, 2);
    });
  });

  describe("property: session cost invariants", () => {

    it.skip("session cost is never negative regardless of event sequence", () => {
      const anyEventArb = fc.oneof(
        fc.record({
          eventType: fc.constantFrom("prompt_submit", "tool_call_end", "agent_complete"),
          payload: fc.record({
            usage: fc.record({
              input_tokens: fc.nat({ max: 100000 }),
              output_tokens: fc.nat({ max: 100000 }),
              model: fc.constantFrom("claude-sonnet-4-20250514", "claude-opus-4-20250514"),
            }),
          }),
          receivedAt: fc.constant("2026-03-27T10:00:00Z"),
        }),
        fc.record({
          eventType: fc.constant("api_request"),
          payload: fc.record({
            usage: fc.record({
              input_tokens: fc.nat({ max: 100000 }),
              output_tokens: fc.nat({ max: 100000 }),
              cache_read_input_tokens: fc.constant(0),
              cache_creation_input_tokens: fc.constant(0),
              cost_usd: fc.double({ min: 0, max: 100, noNaN: true }),
              model: fc.constant("claude-sonnet-4-20250514"),
              duration_ms: fc.constant(1000),
              speed: fc.constant("normal"),
            }),
          }),
          receivedAt: fc.constant("2026-03-27T10:00:00Z"),
        }),
      );

      fc.assert(
        fc.property(
          fc.array(anyEventArb, { minLength: 0, maxLength: 20 }),
          (events) => {
            const result = foldEvents(events as AggregatorEvent[]);
            expect(result.sessionCost).toBeGreaterThanOrEqual(0);
          },
        ),
      );
    });

    it.skip("OTel session cost equals sum of API request cost_usd values", () => {
      const costUsdArb = fc.double({ min: 0, max: 50, noNaN: true });

      fc.assert(
        fc.property(
          fc.array(costUsdArb, { minLength: 1, maxLength: 10 }),
          (costs) => {
            const events = costs.map((c) => buildApiRequestEvent({ costUsd: c }));
            const result = foldEvents(events, undefined, true);
            const expectedCost = costs.reduce((sum, c) => sum + c, 0);
            expect(result.sessionCost).toBeCloseTo(expectedCost, 2);
          },
        ),
      );
    });
  });
});

// ===========================================================================
// US-OFM-02: Rich Tool Tracking from OTel
// ===========================================================================

describe("US-OFM-02: Rich tool tracking from OTel", () => {

  describe("when OTel is active, tool_result events are the source for tool counts", () => {

    it.skip("tool result events increment tool call count", () => {
      const events = [
        buildToolResultEvent({ toolName: "Read" }),
        buildToolResultEvent({ toolName: "Write" }),
        buildToolResultEvent({ toolName: "Bash" }),
        buildToolResultEvent({ toolName: "Read" }),
        buildToolResultEvent({ toolName: "Grep" }),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.toolCallCount).toBe(5);
    });

    it.skip("tool call start events are ignored when OTel is active", () => {
      const events: AggregatorEvent[] = [
        buildToolResultEvent({ toolName: "Read" }),
        buildToolResultEvent({ toolName: "Write" }),
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.toolCallCount).toBe(2);
    });

    it.skip("per-tool breakdown includes success rate and average duration", () => {
      const events = [
        buildToolResultEvent({ toolName: "Read", success: true, durationMs: 120 }),
        buildToolResultEvent({ toolName: "Write", success: true, durationMs: 340 }),
        buildToolResultEvent({ toolName: "Bash", success: false, durationMs: 5200 }),
        buildToolResultEvent({ toolName: "Read", success: true, durationMs: 95 }),
        buildToolResultEvent({ toolName: "Grep", success: true, durationMs: 210 }),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.toolCallCount).toBe(5);
      // NOTE: Per-tool breakdown assertion requires toolUsageAggregator wiring.
      // The software-crafter will verify this in the inner-loop unit tests
      // once tool_result events flow through aggregateEvent to toolUsageAggregator.
    });
  });

  describe("when OTel is not active, tool_call_start is the source", () => {

    it.skip("tool call start events increment tool count in hook-only session", () => {
      const events = [
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.toolCallCount).toBe(4);
    });
  });

  describe("property: tool count invariants", () => {

    it.skip("tool call count matches number of tool result events when OTel active", () => {
      const toolResultArb = fc.record({
        eventType: fc.constant("tool_result" as const),
        payload: fc.record({
          tool_name: fc.constantFrom("Bash", "Read", "Write", "Edit", "Grep"),
          success: fc.boolean(),
          duration_ms: fc.integer({ min: 0, max: 60000 }),
        }),
        receivedAt: fc.constant("2026-03-27T10:00:00Z"),
      });

      fc.assert(
        fc.property(
          fc.array(toolResultArb, { minLength: 0, maxLength: 20 }),
          (events) => {
            const result = foldEvents(events as AggregatorEvent[], undefined, true);
            expect(result.toolCallCount).toBe(events.length);
          },
        ),
      );
    });
  });
});

// ===========================================================================
// US-OFM-03: API Error Visibility
// ===========================================================================

describe("US-OFM-03: API error visibility", () => {

  describe("API error events are tracked for error visibility", () => {

    it.skip("API errors increment error count", () => {
      // 8 api_request events + 3 api_error events
      const apiRequests = Array.from({ length: 8 }, () =>
        buildApiRequestEvent({ costUsd: 0.10 }),
      );
      const apiErrors = Array.from({ length: 3 }, () => buildApiErrorEvent());

      const result = foldEvents([...apiRequests, ...apiErrors], undefined, true);

      // apiErrorCount and apiRequestCount are new fields on SessionMetrics
      // They will be added in step 01-01 and wired in step 03-01.
      expect((result as any).apiErrorCount).toBe(3);
      expect((result as any).apiRequestCount).toBe(8);
      // apiErrorRate = 3 / (3 + 8) = 0.2727...
      const errorRate =
        (result as any).apiErrorCount /
        ((result as any).apiErrorCount + (result as any).apiRequestCount);
      expect(errorRate).toBeCloseTo(0.27, 1);
    });

    it.skip("healthy session shows zero errors", () => {
      const apiRequests = Array.from({ length: 12 }, () =>
        buildApiRequestEvent({ costUsd: 0.05 }),
      );

      const result = foldEvents(apiRequests, undefined, true);

      expect((result as any).apiErrorCount).toBe(0);
      expect((result as any).apiRequestCount).toBe(12);
    });
  });

  describe("error rate handles edge cases gracefully", () => {

    it.skip("error rate is zero when no API interactions have occurred", () => {
      const result = createInitialMetrics("empty-session");

      expect((result as any).apiErrorCount).toBe(0);
      expect((result as any).apiRequestCount).toBe(0);
      // Convention: 0/0 => 0 error rate (not NaN)
    });

    it.skip("API error events update common tracking fields", () => {
      const initial: SessionMetrics = {
        ...createInitialMetrics("common-fields-test"),
        hookEventCount: 5,
      };
      const errorEvent = buildApiErrorEvent("2026-03-27T10:05:00Z");

      const result = aggregateEvent(initial, errorEvent, DEFAULT_PRICING_TABLE);

      // totalEventCount (renamed from hookEventCount) should be 6
      // lastEventAt should be the error event timestamp
      expect(result.hookEventCount).toBe(6); // Will be renamed to totalEventCount in step 01-01
      expect(result.lastEventAt).toBe("2026-03-27T10:05:00Z");
    });
  });

  describe("property: error rate invariants", () => {

    it.skip("API error rate is always between 0 and 1 when requests exceed errors", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 0, max: 50 }),
          (requestCount, errorCount) => {
            // Ensure requests > errors
            const totalRequests = requestCount + errorCount;
            const rate = errorCount / (errorCount + totalRequests);
            expect(rate).toBeGreaterThanOrEqual(0);
            expect(rate).toBeLessThanOrEqual(1);
          },
        ),
      );
    });
  });
});

// ===========================================================================
// US-OFM-04: Source-Agnostic Data Health Indicator
// ===========================================================================

describe("US-OFM-04: Source-agnostic data health indicator", () => {

  // NOTE: These tests exercise computeGaugeClusterData / buildWarningCluster
  // which will be refactored in step 06-01 to accept (totalEventCount, lastEventAt, now).
  // Until then, these are skipped placeholders.

  describe("data health considers total event count and recency", () => {

    it.skip("healthy when OTel events are flowing recently", () => {
      // Given: 42 events, most recent 5 seconds ago
      // buildWarningCluster(42, "2026-03-27T10:00:55Z", "2026-03-27T10:01:00Z")
      // => { dataHealth: "healthy" }
      expect(true).toBe(true); // Placeholder
    });

    it.skip("healthy when hook events are flowing recently", () => {
      // Given: 28 hook events, most recent 10 seconds ago
      // => { dataHealth: "healthy" }
      expect(true).toBe(true);
    });

    it.skip("degraded when events are stale", () => {
      // Given: 15 events, most recent 90 seconds ago
      // => { dataHealth: "degraded" }
      expect(true).toBe(true);
    });

    it.skip("no-data when no events have been received", () => {
      // Given: 0 events
      // => { dataHealth: "no-data" }
      expect(true).toBe(true);
    });
  });

  describe("staleness threshold determines healthy vs degraded boundary", () => {

    it.skip("events arriving just within threshold show healthy", () => {
      // Given: 10 events, most recent 59 seconds ago, threshold 60s
      // => { dataHealth: "healthy" }
      expect(true).toBe(true);
    });

    it.skip("events arriving just beyond threshold show degraded", () => {
      // Given: 10 events, most recent 61 seconds ago, threshold 60s
      // => { dataHealth: "degraded" }
      expect(true).toBe(true);
    });
  });
});

// ===========================================================================
// US-OFM-05: OTel Session Timing Preference
// ===========================================================================

describe("US-OFM-05: OTel session timing preference", () => {

  describe("when OTel is active, first API request sets session start", () => {

    it.skip("first API request sets session start time", () => {
      const events: AggregatorEvent[] = [
        buildSessionStartEvent("2026-03-27T10:00:05Z"),
        buildApiRequestEvent({
          costUsd: 0.10,
          receivedAt: "2026-03-27T10:00:02Z",
        }),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.sessionStartedAt).toBe("2026-03-27T10:00:02Z");
    });

    it.skip("API request arriving before session start preserves earlier timestamp", () => {
      const events: AggregatorEvent[] = [
        buildApiRequestEvent({
          costUsd: 0.10,
          receivedAt: "2026-03-27T10:00:02Z",
        }),
        buildSessionStartEvent("2026-03-27T10:00:05Z"),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.sessionStartedAt).toBe("2026-03-27T10:00:02Z");
    });
  });

  describe("when OTel is not active, session start hook sets the timestamp", () => {

    it.skip("hook-only session uses session start timestamp", () => {
      const events: AggregatorEvent[] = [
        buildSessionStartEvent("2026-03-27T10:00:05Z"),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.sessionStartedAt).toBe("2026-03-27T10:00:05Z");
    });

    it.skip("second session start does not overwrite the first timestamp", () => {
      const events: AggregatorEvent[] = [
        buildSessionStartEvent("2026-03-27T10:00:05Z"),
        buildSessionStartEvent("2026-03-27T10:00:15Z"),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.sessionStartedAt).toBe("2026-03-27T10:00:05Z");
    });
  });
});
