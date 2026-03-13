/**
 * Unit tests: Metrics Aggregator (Step 02-01)
 *
 * Pure fold: (prev: SessionMetrics, event, pricingTable) => SessionMetrics
 *
 * Properties tested:
 * - Token-bearing events accumulate tokens and cost monotonically
 * - tool_call_start increments tool count without affecting cost or tokens
 * - session_start increments active agent count
 * - agent_complete decrements active agent count (floor at 0)
 * - Every event increments hookEventCount and updates lastEventAt
 * - Session cost is never negative regardless of event sequence
 * - Aggregator never mutates previous metrics
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregateEvent,
  createInitialMetrics,
} from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import { DEFAULT_PRICING_TABLE } from "../../../../../src/plugins/norbert-usage/domain/pricingModel";
import type { SessionMetrics } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const tokenCountArb = fc.nat({ max: 1_000_000 });
const modelArb = fc.constantFrom(
  "claude-opus-4-20250514",
  "claude-sonnet-4-20250514",
  "claude-haiku-20250514",
);
const timestampArb = fc.integer({ min: 1735689600000, max: 1798761600000 })
  .map((ms) => new Date(ms).toISOString());

const tokenBearingEventTypeArb = fc.constantFrom(
  "prompt_submit" as const,
  "tool_call_end" as const,
  "agent_complete" as const,
);

const tokenBearingEventArb = fc.record({
  eventType: tokenBearingEventTypeArb,
  payload: fc.record({
    usage: fc.record({
      input_tokens: tokenCountArb,
      output_tokens: tokenCountArb,
      model: modelArb,
    }),
  }),
  receivedAt: timestampArb,
});

const toolCallStartEventArb = fc.record({
  eventType: fc.constant("tool_call_start" as const),
  payload: fc.record({ tool: fc.string({ minLength: 1 }) }),
  receivedAt: timestampArb,
});

const sessionStartEventArb = fc.record({
  eventType: fc.constant("session_start" as const),
  payload: fc.constant({}),
  receivedAt: timestampArb,
});

const agentCompleteEventArb = fc.record({
  eventType: fc.constant("agent_complete" as const),
  payload: fc.constant({}),
  receivedAt: timestampArb,
});

const anyEventArb = fc.oneof(
  tokenBearingEventArb,
  toolCallStartEventArb,
  sessionStartEventArb,
  agentCompleteEventArb,
);

// ---------------------------------------------------------------------------
// createInitialMetrics
// ---------------------------------------------------------------------------

describe("createInitialMetrics", () => {
  it("produces zeroed metrics with the given session id", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (sessionId) => {
        const metrics = createInitialMetrics(sessionId);
        expect(metrics.sessionId).toBe(sessionId);
        expect(metrics.totalTokens).toBe(0);
        expect(metrics.inputTokens).toBe(0);
        expect(metrics.outputTokens).toBe(0);
        expect(metrics.sessionCost).toBe(0);
        expect(metrics.toolCallCount).toBe(0);
        expect(metrics.activeAgentCount).toBe(0);
        expect(metrics.hookEventCount).toBe(0);
        expect(metrics.burnRate).toBe(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Token-bearing events accumulate tokens and cost
// ---------------------------------------------------------------------------

describe("token-bearing events update tokens and cost", () => {
  it("prompt_submit with tokens increases totalTokens, inputTokens, outputTokens, and sessionCost", () => {
    fc.assert(
      fc.property(tokenBearingEventArb, (event) => {
        const initial = createInitialMetrics("test");
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
        const usage = event.payload.usage;
        const expectedTotalTokens = usage.input_tokens + usage.output_tokens;

        expect(updated.totalTokens).toBe(expectedTotalTokens);
        expect(updated.inputTokens).toBe(usage.input_tokens);
        expect(updated.outputTokens).toBe(usage.output_tokens);
        expect(updated.sessionCost).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("token accumulation is monotonically non-decreasing over sequence of token events", () => {
    fc.assert(
      fc.property(fc.array(tokenBearingEventArb, { minLength: 1, maxLength: 10 }), (events) => {
        let metrics = createInitialMetrics("test");
        for (const event of events) {
          const previous = metrics;
          metrics = aggregateEvent(metrics, event, DEFAULT_PRICING_TABLE);
          expect(metrics.totalTokens).toBeGreaterThanOrEqual(previous.totalTokens);
          expect(metrics.sessionCost).toBeGreaterThanOrEqual(previous.sessionCost);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// tool_call_start increments tool count only
// ---------------------------------------------------------------------------

describe("tool_call_start increments tool count without affecting cost", () => {
  it("tool count increments while cost and tokens remain unchanged", () => {
    fc.assert(
      fc.property(toolCallStartEventArb, (event) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("test"),
          sessionCost: 5.5,
          totalTokens: 10000,
          toolCallCount: 3,
        };
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

        expect(updated.toolCallCount).toBe(4);
        expect(updated.sessionCost).toBe(5.5);
        expect(updated.totalTokens).toBe(10000);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// session_start / agent_complete manage active agent count
// ---------------------------------------------------------------------------

describe("session_start increments active agent count", () => {
  it("each session_start adds one to activeAgentCount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        sessionStartEventArb,
        (startingCount, event) => {
          const initial: SessionMetrics = {
            ...createInitialMetrics("test"),
            activeAgentCount: startingCount,
          };
          const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
          expect(updated.activeAgentCount).toBe(startingCount + 1);
        },
      ),
    );
  });

  it("sets sessionStartedAt on first session_start event", () => {
    const initial = createInitialMetrics("test");
    const event = {
      eventType: "session_start" as const,
      payload: {},
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
    expect(updated.sessionStartedAt).not.toBe("");
  });
});

describe("agent_complete decrements active agent count", () => {
  it("agent_complete reduces activeAgentCount by one", () => {
    const initial: SessionMetrics = {
      ...createInitialMetrics("test"),
      activeAgentCount: 3,
    };
    const event = {
      eventType: "agent_complete" as const,
      payload: {},
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
    expect(updated.activeAgentCount).toBe(2);
  });

  it("activeAgentCount floors at 0 when already zero", () => {
    fc.assert(
      fc.property(agentCompleteEventArb, (event) => {
        const initial = createInitialMetrics("test"); // activeAgentCount = 0
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
        expect(updated.activeAgentCount).toBe(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Every event increments hookEventCount and updates lastEventAt
// ---------------------------------------------------------------------------

describe("every event increments hookEventCount and updates lastEventAt", () => {
  it("hookEventCount increments by one for any event type", () => {
    fc.assert(
      fc.property(anyEventArb, (event) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("test"),
          hookEventCount: 7,
        };
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
        expect(updated.hookEventCount).toBe(8);
      }),
    );
  });

  it("lastEventAt is set to event receivedAt", () => {
    fc.assert(
      fc.property(anyEventArb, (event) => {
        const initial = createInitialMetrics("test");
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
        expect(updated.lastEventAt).toBe(event.receivedAt);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Session cost never negative
// ---------------------------------------------------------------------------

describe("session cost is never negative regardless of event sequence", () => {
  it("any sequence of events produces non-negative session cost", () => {
    fc.assert(
      fc.property(fc.array(anyEventArb, { minLength: 0, maxLength: 20 }), (events) => {
        let metrics = createInitialMetrics("property-test");
        for (const event of events) {
          metrics = aggregateEvent(metrics, event, DEFAULT_PRICING_TABLE);
        }
        expect(metrics.sessionCost).toBeGreaterThanOrEqual(0);
        expect(metrics.totalTokens).toBeGreaterThanOrEqual(0);
        expect(metrics.activeAgentCount).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Immutability: aggregator never mutates previous metrics
// ---------------------------------------------------------------------------

describe("aggregator produces new object without mutating previous", () => {
  it("previous metrics object is unchanged after aggregation", () => {
    fc.assert(
      fc.property(anyEventArb, (event) => {
        const initial = createInitialMetrics("immutability-test");
        const snapshot = JSON.stringify(initial);
        aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
        expect(JSON.stringify(initial)).toBe(snapshot);
      }),
    );
  });
});
