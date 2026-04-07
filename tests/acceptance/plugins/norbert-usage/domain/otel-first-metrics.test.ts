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
import {
  computeGaugeClusterData,
} from "../../../../../src/plugins/norbert-usage/domain/gaugeCluster";

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
    metrics = aggregateEvent(metrics, event, DEFAULT_PRICING_TABLE, isOtelActive ?? false);
  }
  return metrics;
};

// ===========================================================================
// Walking Skeletons
// ===========================================================================

describe("Walking Skeleton: operator sees accurate session cost when OTel is active", () => {
  it("pre-OTel cost preserved plus OTel cost_usd, hook token data excluded", () => {
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

// Walking Skeleton: per-tool breakdown from OTel tool results
// Out of scope for OTel-first-metrics feature. Tool count is covered by US-OFM-02.

describe("Walking Skeleton: operator sees healthy data pipeline", () => {
  it("data health shows healthy when OTel events are flowing recently", () => {
    // Given: session has received 42 events, most recent 5 seconds ago
    const metrics: SessionMetrics = {
      ...createInitialMetrics("ws-health"),
      totalEventCount: 42,
      lastEventAt: "2026-03-27T10:00:55Z",
    };
    const now = new Date("2026-03-27T10:01:00Z");

    // When: data health indicator is computed
    const gaugeData = computeGaugeClusterData(metrics, undefined, now);

    // Then: data health status is "healthy"
    expect(gaugeData.warningCluster.dataHealth).toBe("healthy");
  });
});

// ===========================================================================
// US-OFM-01: Cost Single Source of Truth
// ===========================================================================

describe("US-OFM-01: Cost single source of truth", () => {

  describe("when OTel is active, only API request cost_usd contributes to cost", () => {

    it("API request cost_usd values are summed as session cost", () => {
      const events = [
        buildApiRequestEvent({ costUsd: 0.42 }),
        buildApiRequestEvent({ costUsd: 1.15 }),
        buildApiRequestEvent({ costUsd: 0.83 }),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.sessionCost).toBeCloseTo(2.40, 2);
    });

    it("prompt submit does not contribute to cost when OTel is active", () => {
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

    it("agent complete updates agent count but not cost when OTel is active", () => {
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

    it("tool call end does not contribute to cost when OTel is active", () => {
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

  describe("under the OTel-authoritative cost policy, hook events never contribute cost", () => {
    // Historical note: earlier versions credited cost from hook
    // prompt_submit/tool_call_end via the pricing model whenever OTel
    // was not detected. That behavior was removed because sessions
    // running with BOTH hooks and OTel enabled would double-count
    // cost for the same API request. Cost is now credited
    // exclusively by OTel api_request events.

    it("hook-only session produces no cost from prompt_submit", () => {
      const events = [
        buildPromptSubmitEvent({
          inputTokens: 1500,
          outputTokens: 800,
          model: "claude-sonnet-4-20250514",
        }),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.sessionCost).toBe(0);
      expect(result.totalTokens).toBe(0);
    });

    it("tool_call_start (hook PreToolUse) is identity -- only tool_result increments tool count", () => {
      const events = [
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.toolCallCount).toBe(0);
    });
  });

  describe("API request without cost_usd falls back to pricing model", () => {

    it("missing cost_usd triggers pricing model fallback", () => {
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

    it("cost_usd of zero is treated as valid zero cost", () => {
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

    it("pre-OTel cost preserved when first API request arrives", () => {
      // Simulate: hook events contributed $1.20 before OTel
      const preOtelMetrics: SessionMetrics = {
        ...createInitialMetrics("mid-session"),
        sessionCost: 1.20,
      };

      // First api_request makes session OTel-active
      const apiRequest = buildApiRequestEvent({ costUsd: 0.55 });
      const afterApi = aggregateEvent(preOtelMetrics, apiRequest, DEFAULT_PRICING_TABLE, true);

      // Subsequent hook events should be suppressed
      const hookEvent = buildPromptSubmitEvent({ inputTokens: 1000, outputTokens: 500 });
      // isOtelActive=true for this call (after api_request arrived)
      const afterHook = aggregateEvent(afterApi, hookEvent, DEFAULT_PRICING_TABLE, true);

      // $1.20 (pre-OTel) + $0.55 (api_request) = $1.75
      expect(afterHook.sessionCost).toBeCloseTo(1.75, 2);
    });
  });

  describe("property: session cost invariants", () => {

    it("session cost is never negative regardless of event sequence", () => {
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

    it("OTel session cost equals sum of API request cost_usd values", () => {
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

    it("tool result events increment tool call count", () => {
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

    it("tool call start events are ignored when OTel is active", () => {
      const events: AggregatorEvent[] = [
        buildToolResultEvent({ toolName: "Read" }),
        buildToolResultEvent({ toolName: "Write" }),
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.toolCallCount).toBe(2);
    });

    it("mixed tool result events increment tool call count correctly", () => {
      const events = [
        buildToolResultEvent({ toolName: "Read", success: true, durationMs: 120 }),
        buildToolResultEvent({ toolName: "Write", success: true, durationMs: 340 }),
        buildToolResultEvent({ toolName: "Bash", success: false, durationMs: 5200 }),
        buildToolResultEvent({ toolName: "Read", success: true, durationMs: 95 }),
        buildToolResultEvent({ toolName: "Grep", success: true, durationMs: 210 }),
      ];

      const result = foldEvents(events, undefined, true);

      expect(result.toolCallCount).toBe(5);
    });
  });

  describe("tool_call_start is an identity signal regardless of session mode", () => {
    // Historical note: hook-only sessions previously drove tool counts
    // from tool_call_start. Under the OTel-authoritative policy that
    // source is identity to avoid double-counting with tool_result,
    // and hook-only sessions without OTel simply do not track tool
    // counts.

    it("tool_call_start events do not increment tool count", () => {
      const events = [
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
        buildToolCallStartEvent(),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.toolCallCount).toBe(0);
    });
  });

  describe("property: tool count invariants", () => {

    it("tool call count matches number of tool result events when OTel active", () => {
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

    it("API errors increment error count", () => {
      // 8 api_request events + 3 api_error events
      const apiRequests = Array.from({ length: 8 }, () =>
        buildApiRequestEvent({ costUsd: 0.10 }),
      );
      const apiErrors = Array.from({ length: 3 }, () => buildApiErrorEvent());

      const result = foldEvents([...apiRequests, ...apiErrors], undefined, true);

      expect(result.apiErrorCount).toBe(3);
      expect(result.apiRequestCount).toBe(8);
      // apiErrorRate = 3 / (3 + 8) = 0.2727...
      expect(result.apiErrorRate).toBeCloseTo(0.2727, 3);
    });

    it("healthy session shows zero errors", () => {
      const apiRequests = Array.from({ length: 12 }, () =>
        buildApiRequestEvent({ costUsd: 0.05 }),
      );

      const result = foldEvents(apiRequests, undefined, true);

      expect(result.apiErrorCount).toBe(0);
      expect(result.apiRequestCount).toBe(12);
      expect(result.apiErrorRate).toBe(0);
    });
  });

  describe("error rate handles edge cases gracefully", () => {

    it("error rate is zero when no API interactions have occurred", () => {
      const result = createInitialMetrics("empty-session");

      expect(result.apiErrorCount).toBe(0);
      expect(result.apiRequestCount).toBe(0);
      expect(result.apiErrorRate).toBe(0);
      // Convention: 0/0 => 0 error rate (not NaN)
    });

    it("API error events update common tracking fields", () => {
      const initial: SessionMetrics = {
        ...createInitialMetrics("common-fields-test"),
        totalEventCount: 5,
      };
      const errorEvent = buildApiErrorEvent("2026-03-27T10:05:00Z");

      const result = aggregateEvent(initial, errorEvent, DEFAULT_PRICING_TABLE);

      // totalEventCount (renamed from hookEventCount) should be 6
      // lastEventAt should be the error event timestamp
      expect(result.totalEventCount).toBe(6);
      expect(result.lastEventAt).toBe("2026-03-27T10:05:00Z");
    });
  });

  describe("property: error rate invariants", () => {

    it("API error rate is always between 0 and 1 for any mix of api_error and api_request events", () => {
      const apiEventArb = fc.oneof(
        fc.constant(buildApiErrorEvent()),
        fc.constant(buildApiRequestEvent({ costUsd: 0.01 })),
      );

      fc.assert(
        fc.property(
          fc.array(apiEventArb, { minLength: 1, maxLength: 30 }),
          (events) => {
            const result = foldEvents(events, undefined, true);
            const totalInteractions = result.apiErrorCount + result.apiRequestCount;

            if (totalInteractions > 0) {
              expect(result.apiErrorRate).toBeGreaterThanOrEqual(0);
              expect(result.apiErrorRate).toBeLessThanOrEqual(1);
            }
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

  describe("data health considers total event count and recency", () => {

    it("healthy when OTel events are flowing recently", () => {
      // Given: 42 events, most recent 5 seconds ago
      const metrics: SessionMetrics = {
        ...createInitialMetrics("otel-health"),
        totalEventCount: 42,
        lastEventAt: "2026-03-27T10:00:55Z",
      };
      const now = new Date("2026-03-27T10:01:00Z");

      const gaugeData = computeGaugeClusterData(metrics, undefined, now);

      expect(gaugeData.warningCluster.dataHealth).toBe("healthy");
    });

    it("healthy when hook events are flowing recently", () => {
      // Given: 28 hook events, most recent 10 seconds ago
      const metrics: SessionMetrics = {
        ...createInitialMetrics("hook-health"),
        totalEventCount: 28,
        lastEventAt: "2026-03-27T10:00:50Z",
      };
      const now = new Date("2026-03-27T10:01:00Z");

      const gaugeData = computeGaugeClusterData(metrics, undefined, now);

      expect(gaugeData.warningCluster.dataHealth).toBe("healthy");
    });

    it("degraded when events are stale", () => {
      // Given: 15 events, most recent 90 seconds ago
      const metrics: SessionMetrics = {
        ...createInitialMetrics("stale"),
        totalEventCount: 15,
        lastEventAt: "2026-03-27T09:59:30Z",
      };
      const now = new Date("2026-03-27T10:01:00Z");

      const gaugeData = computeGaugeClusterData(metrics, undefined, now);

      expect(gaugeData.warningCluster.dataHealth).toBe("degraded");
    });

    it("no-data when no events have been received", () => {
      // Given: 0 events
      const metrics: SessionMetrics = {
        ...createInitialMetrics("no-data"),
        totalEventCount: 0,
      };
      const now = new Date("2026-03-27T10:01:00Z");

      const gaugeData = computeGaugeClusterData(metrics, undefined, now);

      expect(gaugeData.warningCluster.dataHealth).toBe("no-data");
    });
  });

  describe("staleness threshold determines healthy vs degraded boundary", () => {

    it("events arriving just within threshold show healthy", () => {
      // Given: 10 events, most recent 59 seconds ago, threshold 60s
      const metrics: SessionMetrics = {
        ...createInitialMetrics("boundary-ok"),
        totalEventCount: 10,
        lastEventAt: "2026-03-27T10:00:01Z",
      };
      const now = new Date("2026-03-27T10:01:00Z");

      const gaugeData = computeGaugeClusterData(metrics, undefined, now);

      expect(gaugeData.warningCluster.dataHealth).toBe("healthy");
    });

    it("events arriving just beyond threshold show degraded", () => {
      // Given: 10 events, most recent 61 seconds ago, threshold 60s
      const metrics: SessionMetrics = {
        ...createInitialMetrics("boundary-stale"),
        totalEventCount: 10,
        lastEventAt: "2026-03-27T09:59:59Z",
      };
      const now = new Date("2026-03-27T10:01:00Z");

      const gaugeData = computeGaugeClusterData(metrics, undefined, now);

      expect(gaugeData.warningCluster.dataHealth).toBe("degraded");
    });
  });
});

// ===========================================================================
// US-OFM-05: OTel Session Timing Preference
// ===========================================================================

describe("US-OFM-05: OTel session timing preference", () => {

  describe("when OTel is active, first API request sets session start", () => {

    it("first API request sets session start time", () => {
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

    it("API request arriving before session start preserves earlier timestamp", () => {
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

    it("hook-only session uses session start timestamp", () => {
      const events: AggregatorEvent[] = [
        buildSessionStartEvent("2026-03-27T10:00:05Z"),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.sessionStartedAt).toBe("2026-03-27T10:00:05Z");
    });

    it("second session start does not overwrite the first timestamp", () => {
      const events: AggregatorEvent[] = [
        buildSessionStartEvent("2026-03-27T10:00:05Z"),
        buildSessionStartEvent("2026-03-27T10:00:15Z"),
      ];

      const result = foldEvents(events, undefined, false);

      expect(result.sessionStartedAt).toBe("2026-03-27T10:00:05Z");
    });
  });
});
