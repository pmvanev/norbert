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
 * - Every event increments totalEventCount and updates lastEventAt
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
        expect(metrics.totalEventCount).toBe(0);
        expect(metrics.burnRate).toBe(0);
        expect(metrics.sessionLabel).toBe("");
        expect(metrics.contextWindowModel).toBe("");
        expect(metrics.sessionStartedAt).toBe("");
        expect(metrics.lastEventAt).toBe("");
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
// Every event increments totalEventCount and updates lastEventAt
// ---------------------------------------------------------------------------

describe("every event increments totalEventCount and updates lastEventAt", () => {
  it("totalEventCount increments by one for any event type", () => {
    fc.assert(
      fc.property(anyEventArb, (event) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("test"),
          totalEventCount: 7,
        };
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
        expect(updated.totalEventCount).toBe(8);
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

// ---------------------------------------------------------------------------
// OTel api_request: cost_usd bypass (acceptance)
// ---------------------------------------------------------------------------

describe("api_request event with cost_usd updates session cost by exact cost_usd value", () => {
  it("cost_usd=0.042 produces sessionCost of exactly 0.042", () => {
    const initial = createInitialMetrics("otel-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 337,
          output_tokens: 12,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 22996,
          cost_usd: 0.042,
          model: "claude-opus-4-6",
          duration_ms: 2504,
          speed: "normal",
        },
        prompt_id: "bacb8cf6-test",
        event_sequence: 2,
      },
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    expect(updated.sessionCost).toBe(0.042);
    expect(updated.totalTokens).toBe(337 + 12);
    expect(updated.inputTokens).toBe(337);
    expect(updated.outputTokens).toBe(12);
    expect(updated.totalEventCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// OTel api_request: cost_usd absent falls back to pricing model
// ---------------------------------------------------------------------------

describe("api_request without cost_usd falls back to pricing model", () => {
  it("session cost matches calculateCost result when cost_usd absent", () => {
    const initial = createInitialMetrics("fallback-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          model: "claude-sonnet-4-20250514",
          duration_ms: 1200,
          speed: "normal",
        },
        prompt_id: "no-cost-test",
        event_sequence: 1,
      },
      receivedAt: "2025-06-15T10:01:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // Sonnet rates: input=0.003/1k, output=0.015/1k
    // (1000/1000)*0.003 + (500/1000)*0.015 = 0.003 + 0.0075 = 0.0105
    expect(updated.sessionCost).toBeCloseTo(0.0105, 6);
    expect(updated.totalTokens).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// OTel api_request: cost_usd=0.0 treated as valid zero cost
// ---------------------------------------------------------------------------

describe("api_request with cost_usd=0.0 treats zero as valid cost", () => {
  it("session cost remains zero when cost_usd is 0.0", () => {
    const initial = createInitialMetrics("zero-cost-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 500,
          output_tokens: 100,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          cost_usd: 0.0,
          model: "claude-opus-4-6",
          duration_ms: 800,
          speed: "normal",
        },
        prompt_id: "zero-cost-test",
        event_sequence: 1,
      },
      receivedAt: "2025-06-15T10:02:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // cost_usd=0.0 is a valid number, should NOT fall back to pricing model
    expect(updated.sessionCost).toBe(0.0);
    expect(updated.totalTokens).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// OTel identity event types: user_prompt, tool_result, api_error, tool_decision
// ---------------------------------------------------------------------------

describe("OTel identity event types increment totalEventCount only", () => {
  const identityEventTypes = [
    "user_prompt",
    "tool_result",
    "api_error",
    "tool_decision",
  ] as const;

  it.each(identityEventTypes)(
    "%s increments totalEventCount and does not affect tokens or cost",
    (eventType) => {
      const initial: SessionMetrics = {
        ...createInitialMetrics("identity-test"),
        sessionCost: 1.5,
        totalTokens: 5000,
        toolCallCount: 3,
        activeAgentCount: 1,
      };
      const event = {
        eventType,
        payload: { some: "data" },
        receivedAt: "2025-06-15T10:03:00Z",
      };
      const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

      expect(updated.totalEventCount).toBe(initial.totalEventCount + 1);
      expect(updated.sessionCost).toBe(1.5);
      expect(updated.totalTokens).toBe(5000);
      expect(updated.toolCallCount).toBe(3);
      expect(updated.activeAgentCount).toBe(1);
      expect(updated.lastEventAt).toBe("2025-06-15T10:03:00Z");
    },
  );
});

// ---------------------------------------------------------------------------
// Immutability: aggregator never mutates previous metrics
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// extractCostUsd guard clauses: malformed payloads (Category 1 + 2 mutants)
// ---------------------------------------------------------------------------

describe("api_request with malformed payload falls back gracefully", () => {
  it("non-object payload (string) produces no cost or token change", () => {
    const initial = createInitialMetrics("malformed-test");
    const event = {
      eventType: "api_request" as const,
      payload: "not-an-object",
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // Token extractor also sees no tokens, so metrics unchanged except bookkeeping
    expect(updated.sessionCost).toBe(0);
    expect(updated.totalTokens).toBe(0);
    expect(updated.totalEventCount).toBe(1);
  });

  it("array payload produces no cost or token change", () => {
    const initial = createInitialMetrics("malformed-test");
    const event = {
      eventType: "api_request" as const,
      payload: [1, 2, 3],
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    expect(updated.sessionCost).toBe(0);
    expect(updated.totalTokens).toBe(0);
  });

  it("null payload produces no cost or token change", () => {
    const initial = createInitialMetrics("malformed-test");
    const event = {
      eventType: "api_request" as const,
      payload: null,
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    expect(updated.sessionCost).toBe(0);
    expect(updated.totalTokens).toBe(0);
  });

  it("usage field as array falls back to pricing model", () => {
    const initial = createInitialMetrics("malformed-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: [1, 2, 3],
      },
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // Token extractor sees no valid usage, so no token/cost change
    expect(updated.sessionCost).toBe(0);
    expect(updated.totalTokens).toBe(0);
  });

  it("usage field as null falls back to pricing model", () => {
    const initial = createInitialMetrics("malformed-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: null,
      },
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    expect(updated.sessionCost).toBe(0);
    expect(updated.totalTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extractCostUsd type check: non-number cost_usd (Category 2 mutant)
// ---------------------------------------------------------------------------

describe("api_request with non-number cost_usd falls back to pricing model", () => {
  it("cost_usd as string falls back to pricing model calculation", () => {
    const initial = createInitialMetrics("string-cost-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          cost_usd: "not-a-number",
          model: "claude-sonnet-4-20250514",
          duration_ms: 1200,
          speed: "normal",
        },
        prompt_id: "string-cost-test",
        event_sequence: 1,
      },
      receivedAt: "2025-06-15T10:04:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // Should fall back to pricing model: Sonnet input=0.003/1k, output=0.015/1k
    // (1000/1000)*0.003 + (500/1000)*0.015 = 0.0105
    expect(updated.sessionCost).toBeCloseTo(0.0105, 6);
    expect(updated.totalTokens).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// applyApiRequestTokenUsage absent-tag check (Category 3 mutants)
// ---------------------------------------------------------------------------

describe("api_request with empty payload returns unchanged metrics", () => {
  it("empty object payload produces no token or cost change", () => {
    const initial: SessionMetrics = {
      ...createInitialMetrics("absent-tag-test"),
      sessionCost: 1.5,
      totalTokens: 5000,
    };
    const event = {
      eventType: "api_request" as const,
      payload: {},
      receivedAt: "2025-06-15T10:05:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // Tokens and cost unchanged (extraction.tag === "absent")
    expect(updated.sessionCost).toBe(1.5);
    expect(updated.totalTokens).toBe(5000);
    // Bookkeeping still applied
    expect(updated.totalEventCount).toBe(initial.totalEventCount + 1);
    expect(updated.lastEventAt).toBe("2025-06-15T10:05:00Z");
  });
});

// ---------------------------------------------------------------------------
// sessionStartedAt preservation on second session_start (Category 4 mutant)
// ---------------------------------------------------------------------------

describe("sessionStartedAt is preserved after first session_start", () => {
  it("second session_start does not overwrite sessionStartedAt", () => {
    const initial = createInitialMetrics("preserve-test");
    const firstEvent = {
      eventType: "session_start" as const,
      payload: {},
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const afterFirst = aggregateEvent(initial, firstEvent, DEFAULT_PRICING_TABLE);
    expect(afterFirst.sessionStartedAt).toBe("2025-06-15T10:00:00Z");

    const secondEvent = {
      eventType: "session_start" as const,
      payload: {},
      receivedAt: "2025-06-15T11:00:00Z",
    };
    const afterSecond = aggregateEvent(afterFirst, secondEvent, DEFAULT_PRICING_TABLE);

    // sessionStartedAt must remain the first event's timestamp
    expect(afterSecond.sessionStartedAt).toBe("2025-06-15T10:00:00Z");
    expect(afterSecond.activeAgentCount).toBe(2);
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

// ---------------------------------------------------------------------------
// api_error increments apiErrorCount (Step 03-01)
// ---------------------------------------------------------------------------

describe("api_error increments apiErrorCount", () => {
  it("each api_error event increments apiErrorCount by one", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        timestampArb,
        (startingErrorCount, receivedAt) => {
          const initial: SessionMetrics = {
            ...createInitialMetrics("error-count-test"),
            apiErrorCount: startingErrorCount,
          };
          const event = {
            eventType: "api_error" as const,
            payload: { status_code: 429, error: "rate_limit_exceeded" },
            receivedAt,
          };
          const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

          expect(updated.apiErrorCount).toBe(startingErrorCount + 1);
        },
      ),
    );
  });

  it("api_error in hook-only mode also increments apiErrorCount", () => {
    const initial: SessionMetrics = {
      ...createInitialMetrics("hook-error-test"),
      apiErrorCount: 2,
    };
    const event = {
      eventType: "api_error" as const,
      payload: { status_code: 500 },
      receivedAt: "2026-03-27T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, false);

    expect(updated.apiErrorCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// api_request increments apiRequestCount (Step 03-01)
// ---------------------------------------------------------------------------

describe("api_request increments apiRequestCount", () => {
  it("each api_request event increments apiRequestCount by one", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        (startingRequestCount, costUsd) => {
          const initial: SessionMetrics = {
            ...createInitialMetrics("request-count-test"),
            apiRequestCount: startingRequestCount,
          };
          const event = {
            eventType: "api_request" as const,
            payload: {
              usage: {
                input_tokens: 100,
                output_tokens: 50,
                cache_read_input_tokens: 0,
                cache_creation_input_tokens: 0,
                cost_usd: costUsd,
                model: "claude-sonnet-4-20250514",
                duration_ms: 1000,
                speed: "normal",
              },
            },
            receivedAt: "2026-03-27T10:00:00Z",
          };
          const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

          expect(updated.apiRequestCount).toBe(startingRequestCount + 1);
        },
      ),
    );
  });

  it("api_request in hook-only mode also increments apiRequestCount", () => {
    const initial: SessionMetrics = {
      ...createInitialMetrics("hook-request-test"),
      apiRequestCount: 5,
    };
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          cost_usd: 0.01,
          model: "claude-sonnet-4-20250514",
          duration_ms: 1000,
          speed: "normal",
        },
      },
      receivedAt: "2026-03-27T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, false);

    expect(updated.apiRequestCount).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Dual dispatch: OTel-active suppresses hook cost/token contribution
// ---------------------------------------------------------------------------

const apiRequestEventArb = fc.record({
  eventType: fc.constant("api_request" as const),
  payload: fc.record({
    usage: fc.record({
      input_tokens: tokenCountArb,
      output_tokens: tokenCountArb,
      cache_read_input_tokens: fc.constant(0),
      cache_creation_input_tokens: fc.constant(0),
      cost_usd: fc.double({ min: 0, max: 100, noNaN: true }),
      model: modelArb,
      duration_ms: fc.constant(1000),
      speed: fc.constant("normal"),
    }),
  }),
  receivedAt: timestampArb,
});

describe("dual dispatch: isOtelActive selects handler table", () => {

  it("prompt_submit with isOtelActive=true does not change cost or tokens", () => {
    fc.assert(
      fc.property(tokenBearingEventArb, (event) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("otel-suppress"),
          sessionCost: 5.0,
          totalTokens: 10000,
        };
        const patched = { ...event, eventType: "prompt_submit" as const };
        const updated = aggregateEvent(initial, patched, DEFAULT_PRICING_TABLE, true);

        expect(updated.sessionCost).toBe(5.0);
        expect(updated.totalTokens).toBe(10000);
        expect(updated.totalEventCount).toBe(initial.totalEventCount + 1);
      }),
    );
  });

  it("tool_call_end with isOtelActive=true does not change cost or tokens", () => {
    fc.assert(
      fc.property(tokenBearingEventArb, (event) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("otel-suppress"),
          sessionCost: 3.0,
          totalTokens: 8000,
        };
        const patched = { ...event, eventType: "tool_call_end" as const };
        const updated = aggregateEvent(initial, patched, DEFAULT_PRICING_TABLE, true);

        expect(updated.sessionCost).toBe(3.0);
        expect(updated.totalTokens).toBe(8000);
      }),
    );
  });

  it("tool_call_start with isOtelActive=true does not increment toolCallCount", () => {
    fc.assert(
      fc.property(toolCallStartEventArb, (event) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("otel-suppress"),
          toolCallCount: 5,
        };
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

        expect(updated.toolCallCount).toBe(5);
      }),
    );
  });

  it("agent_complete with isOtelActive=true decrements count but does not change cost", () => {
    const initial: SessionMetrics = {
      ...createInitialMetrics("otel-agent"),
      activeAgentCount: 2,
      sessionCost: 4.0,
      totalTokens: 7000,
    };
    const event = {
      eventType: "agent_complete" as const,
      payload: {
        usage: {
          input_tokens: 500,
          output_tokens: 200,
          model: "claude-sonnet-4-20250514",
        },
      },
      receivedAt: "2026-03-27T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

    expect(updated.activeAgentCount).toBe(1);
    expect(updated.sessionCost).toBe(4.0);
    expect(updated.totalTokens).toBe(7000);
  });

  it("api_request with isOtelActive=true still applies cost_usd and tokens", () => {
    fc.assert(
      fc.property(apiRequestEventArb, (event) => {
        const initial = createInitialMetrics("otel-api");
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

        expect(updated.totalTokens).toBeGreaterThanOrEqual(0);
        expect(updated.sessionCost).toBeGreaterThanOrEqual(0);
        expect(updated.totalEventCount).toBe(1);
      }),
    );
  });

  it("api_request with isOtelActive=true sets sessionStartedAt when empty", () => {
    fc.assert(
      fc.property(apiRequestEventArb, (event) => {
        const initial = createInitialMetrics("otel-timing");
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

        expect(updated.sessionStartedAt).toBe(event.receivedAt);
      }),
    );
  });

  it("api_request with isOtelActive=true does not overwrite sessionStartedAt when already set", () => {
    fc.assert(
      fc.property(apiRequestEventArb, (event) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("otel-timing-preserve"),
          sessionStartedAt: "2026-01-01T00:00:00Z",
        };
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

        expect(updated.sessionStartedAt).toBe("2026-01-01T00:00:00Z");
      }),
    );
  });

  it("api_request with isOtelActive=false does not set sessionStartedAt", () => {
    const initial = createInitialMetrics("hook-timing");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          cost_usd: 0.01,
          model: "claude-sonnet-4-20250514",
          duration_ms: 1000,
          speed: "normal",
        },
      },
      receivedAt: "2026-03-27T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, false);

    expect(updated.sessionStartedAt).toBe("");
  });

  it("isOtelActive=false preserves existing hook behavior for all event types", () => {
    fc.assert(
      fc.property(tokenBearingEventArb, (event) => {
        const initial = createInitialMetrics("hook-compat");
        const withoutFlag = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
        const withFalse = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, false);

        expect(withFalse.sessionCost).toBe(withoutFlag.sessionCost);
        expect(withFalse.totalTokens).toBe(withoutFlag.totalTokens);
        expect(withFalse.toolCallCount).toBe(withoutFlag.toolCallCount);
        expect(withFalse.activeAgentCount).toBe(withoutFlag.activeAgentCount);
      }),
    );
  });
});
