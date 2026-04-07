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

// Hook-path events that carry a usage record but, under the
// OTel-authoritative cost policy, do NOT credit tokens/cost.
const hookUsageEventTypeArb = fc.constantFrom(
  "prompt_submit" as const,
  "tool_call_end" as const,
  "agent_complete" as const,
);

const hookUsageEventArb = fc.record({
  eventType: hookUsageEventTypeArb,
  payload: fc.record({
    usage: fc.record({
      input_tokens: tokenCountArb,
      output_tokens: tokenCountArb,
      model: modelArb,
    }),
  }),
  receivedAt: timestampArb,
});

// api_request events: the sole cost/token source under the new policy.
const tokenBearingEventArb = fc.record({
  eventType: fc.constant("api_request" as const),
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

describe("OTel api_request events are the sole source of tokens and cost", () => {
  it("api_request with usage increases totalTokens, inputTokens, outputTokens, and sessionCost", () => {
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

  it("token accumulation is monotonically non-decreasing over a sequence of api_request events", () => {
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

  it("hook-path events (prompt_submit / tool_call_end / agent_complete) never credit tokens or cost", () => {
    fc.assert(
      fc.property(hookUsageEventArb, (event) => {
        const initial = createInitialMetrics("hook-no-cost");
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

        expect(updated.totalTokens).toBe(0);
        expect(updated.inputTokens).toBe(0);
        expect(updated.outputTokens).toBe(0);
        expect(updated.sessionCost).toBe(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// tool_call_start increments tool count only
// ---------------------------------------------------------------------------

describe("tool_result is the OTel-authoritative source for tool counts", () => {
  it("tool_result increments tool count while cost and tokens remain unchanged", () => {
    const initial: SessionMetrics = {
      ...createInitialMetrics("test"),
      sessionCost: 5.5,
      totalTokens: 10000,
      toolCallCount: 3,
    };
    const event = {
      eventType: "tool_result" as const,
      payload: { tool_name: "Read", success: true, duration_ms: 120 },
      receivedAt: "2025-01-01T00:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    expect(updated.toolCallCount).toBe(4);
    expect(updated.sessionCost).toBe(5.5);
    expect(updated.totalTokens).toBe(10000);
  });

  it("tool_call_start (hook PreToolUse) is an identity signal and does NOT increment tool count", () => {
    // Regression guard for double-counting: sessions with both hooks
    // and OTel enabled fire tool_call_start AND tool_result for the
    // same tool call. Only one should count.
    fc.assert(
      fc.property(toolCallStartEventArb, (event) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("test"),
          toolCallCount: 3,
        };
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

        expect(updated.toolCallCount).toBe(3);
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
// OTel api_request: cost_usd bypass (acceptance)
// ---------------------------------------------------------------------------

describe("api_request totalTokens reflects all billed token categories", () => {
  // Regression guard: Claude Code's OTel exporter reports input,
  // output, cache_read, and cache_creation tokens separately, and
  // Anthropic bills against the sum of all four. Earlier the
  // aggregator only summed input + output, which made totalTokens
  // appear ~50x smaller than what sessionCost was computed against
  // (because cache reads/creations dominate in long sessions with
  // prompt caching). This test pins the all-categories sum so a
  // future regression can't silently misreport tokens.
  it("includes cache_read and cache_creation tokens in totalTokens", () => {
    const initial = createInitialMetrics("cache-totals");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 1_000,
          output_tokens: 500,
          cache_read_input_tokens: 35_000,
          cache_creation_input_tokens: 8_000,
          cost_usd: 0.05,
          model: "claude-sonnet-4-5-20250929",
        },
      },
      receivedAt: "2025-06-15T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    expect(updated.totalTokens).toBe(1_000 + 500 + 35_000 + 8_000);
    expect(updated.inputTokens).toBe(1_000);
    expect(updated.outputTokens).toBe(500);
    expect(updated.cacheReadTokens).toBe(35_000);
    expect(updated.cacheCreationTokens).toBe(8_000);
  });

  it("totalTokens accumulates cache categories across multiple api_request events", () => {
    let metrics = createInitialMetrics("cache-accum");
    const mkEvent = (cacheRead: number, cacheCreate: number) => ({
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: cacheRead,
          cache_creation_input_tokens: cacheCreate,
          model: "claude-sonnet-4-5-20250929",
        },
      },
      receivedAt: "2025-06-15T10:00:00Z",
    });

    metrics = aggregateEvent(metrics, mkEvent(10_000, 2_000), DEFAULT_PRICING_TABLE);
    metrics = aggregateEvent(metrics, mkEvent(15_000, 0), DEFAULT_PRICING_TABLE);
    metrics = aggregateEvent(metrics, mkEvent(20_000, 1_500), DEFAULT_PRICING_TABLE);

    expect(metrics.cacheReadTokens).toBe(45_000);
    expect(metrics.cacheCreationTokens).toBe(3_500);
    expect(metrics.inputTokens).toBe(300);
    expect(metrics.outputTokens).toBe(150);
    expect(metrics.totalTokens).toBe(300 + 150 + 45_000 + 3_500);
  });
});

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
    // totalTokens includes cache_creation_input_tokens because that's
    // what Anthropic bills against -- otherwise the displayed total can
    // be orders of magnitude smaller than the cost was computed against.
    expect(updated.totalTokens).toBe(337 + 12 + 0 + 22996);
    expect(updated.inputTokens).toBe(337);
    expect(updated.outputTokens).toBe(12);
    expect(updated.cacheCreationTokens).toBe(22996);
    expect(updated.cacheReadTokens).toBe(0);
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

describe("Non-metric event types increment totalEventCount only", () => {
  // Note: tool_result is NOT in this list because it is the
  // OTel-authoritative source for toolCallCount increments.
  const nonMetricEventTypes = [
    "user_prompt",
    "tool_decision",
  ] as const;

  it.each(nonMetricEventTypes)(
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

  it("api_error increments apiErrorCount in addition to totalEventCount", () => {
    const initial: SessionMetrics = {
      ...createInitialMetrics("api-error-identity-test"),
      sessionCost: 1.5,
      totalTokens: 5000,
      toolCallCount: 3,
      activeAgentCount: 1,
      apiErrorCount: 2,
    };
    const event = {
      eventType: "api_error" as const,
      payload: { status_code: 429, error: "rate_limit_exceeded" },
      receivedAt: "2025-06-15T10:03:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    expect(updated.totalEventCount).toBe(initial.totalEventCount + 1);
    expect(updated.apiErrorCount).toBe(3);
    expect(updated.sessionCost).toBe(1.5);
    expect(updated.totalTokens).toBe(5000);
    expect(updated.toolCallCount).toBe(3);
    expect(updated.activeAgentCount).toBe(1);
    expect(updated.lastEventAt).toBe("2025-06-15T10:03:00Z");
  });
});

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

describe("OTel-authoritative cost policy (unified handler table)", () => {
  // Under the unified OTel-authoritative table the legacy `isOtelActive`
  // parameter is an unused passthrough. Cost comes exclusively from
  // api_request; hook-path usage events contribute only to the context
  // window snapshot. These tests pin that contract so the isOtelActive
  // flag can't silently bring hook-cost-crediting back.

  it("prompt_submit does not change cost or tokens, regardless of isOtelActive flag", () => {
    fc.assert(
      fc.property(tokenBearingEventArb, fc.boolean(), (event, flag) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("policy-prompt"),
          sessionCost: 5.0,
          totalTokens: 10000,
        };
        const patched = { ...event, eventType: "prompt_submit" as const };
        const updated = aggregateEvent(initial, patched, DEFAULT_PRICING_TABLE, flag);

        expect(updated.sessionCost).toBe(5.0);
        expect(updated.totalTokens).toBe(10000);
        expect(updated.totalEventCount).toBe(initial.totalEventCount + 1);
      }),
    );
  });

  it("tool_call_end does not change cost or tokens, regardless of isOtelActive flag", () => {
    fc.assert(
      fc.property(tokenBearingEventArb, fc.boolean(), (event, flag) => {
        const initial: SessionMetrics = {
          ...createInitialMetrics("policy-tool-end"),
          sessionCost: 3.0,
          totalTokens: 8000,
        };
        const patched = { ...event, eventType: "tool_call_end" as const };
        const updated = aggregateEvent(initial, patched, DEFAULT_PRICING_TABLE, flag);

        expect(updated.sessionCost).toBe(3.0);
        expect(updated.totalTokens).toBe(8000);
      }),
    );
  });

  it("agent_complete decrements count and refreshes context, but does not change cost", () => {
    const initial: SessionMetrics = {
      ...createInitialMetrics("policy-agent"),
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
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    expect(updated.activeAgentCount).toBe(1);
    expect(updated.sessionCost).toBe(4.0);
    expect(updated.totalTokens).toBe(7000);
    expect(updated.contextWindowTokens).toBe(500);
  });

  it("api_request applies cost_usd and tokens", () => {
    fc.assert(
      fc.property(apiRequestEventArb, (event) => {
        const initial = createInitialMetrics("policy-api");
        const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

        expect(updated.totalTokens).toBeGreaterThanOrEqual(0);
        expect(updated.sessionCost).toBeGreaterThanOrEqual(0);
        expect(updated.totalEventCount).toBe(1);
      }),
    );
  });

  it("hook events arriving before api_request never credit cost (no double-counting)", () => {
    // Regression guard for the double-counting bug: hook usage for a
    // request followed by the OTel api_request for the SAME request
    // must yield exactly one cost contribution.
    const initial = createInitialMetrics("policy-no-doublecount");
    const model = "claude-sonnet-4-20250514";

    const hookEvent = {
      eventType: "prompt_submit" as const,
      payload: { usage: { input_tokens: 1000, output_tokens: 500, model } },
      receivedAt: "2026-03-27T10:00:00Z",
    };
    const apiEvent = {
      eventType: "api_request" as const,
      payload: { usage: { input_tokens: 1000, output_tokens: 500, model } },
      receivedAt: "2026-03-27T10:00:01Z",
    };

    const afterHook = aggregateEvent(initial, hookEvent, DEFAULT_PRICING_TABLE);
    const afterApi = aggregateEvent(afterHook, apiEvent, DEFAULT_PRICING_TABLE);

    // Exactly ONE request's worth of tokens, not two.
    expect(afterApi.totalTokens).toBe(1500);
    expect(afterApi.apiRequestCount).toBe(1);

    // Expected cost for one Sonnet request at the default rates.
    const expectedCost = (1000 / 1000) * 0.003 + (500 / 1000) * 0.015;
    expect(afterApi.sessionCost).toBeCloseTo(expectedCost, 6);
  });

  it("NaN cost_usd falls back to pricing model", () => {
    const initial = createInitialMetrics("nan-cost-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          cost_usd: NaN,
          model: "claude-sonnet-4-20250514",
          duration_ms: 1000,
          speed: "normal",
        },
      },
      receivedAt: "2026-03-27T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // Sonnet: (1000/1000)*0.003 + (500/1000)*0.015 = 0.0105
    expect(updated.sessionCost).toBeCloseTo(0.0105, 6);
    expect(updated.totalTokens).toBe(1500);
  });

  it("Infinity cost_usd falls back to pricing model", () => {
    const initial = createInitialMetrics("infinity-cost-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          cost_usd: Infinity,
          model: "claude-sonnet-4-20250514",
          duration_ms: 1000,
          speed: "normal",
        },
      },
      receivedAt: "2026-03-27T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // Sonnet: (1000/1000)*0.003 + (500/1000)*0.015 = 0.0105
    expect(updated.sessionCost).toBeCloseTo(0.0105, 6);
    expect(updated.totalTokens).toBe(1500);
  });

  it("negative cost_usd falls back to pricing model", () => {
    const initial = createInitialMetrics("negative-cost-test");
    const event = {
      eventType: "api_request" as const,
      payload: {
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          cost_usd: -0.5,
          model: "claude-sonnet-4-20250514",
          duration_ms: 1000,
          speed: "normal",
        },
      },
      receivedAt: "2026-03-27T10:00:00Z",
    };
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);

    // Sonnet: (1000/1000)*0.003 + (500/1000)*0.015 = 0.0105
    expect(updated.sessionCost).toBeCloseTo(0.0105, 6);
    expect(updated.totalTokens).toBe(1500);
  });

  it("isOtelActive is a no-op passthrough: result is identical for any flag value", () => {
    fc.assert(
      fc.property(apiRequestEventArb, (event) => {
        const initial = createInitialMetrics("flag-noop");
        const withoutFlag = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE);
        const withFalse = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, false);
        const withTrue = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

        expect(withFalse.sessionCost).toBe(withoutFlag.sessionCost);
        expect(withFalse.totalTokens).toBe(withoutFlag.totalTokens);
        expect(withTrue.sessionCost).toBe(withoutFlag.sessionCost);
        expect(withTrue.totalTokens).toBe(withoutFlag.totalTokens);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Context window tracking: fill percentage must be updated from any event
// that carries a usage record, in both hook and OTel dispatch modes, so
// the fuel gauge reflects the most recent request's input side.
// ---------------------------------------------------------------------------

describe("aggregateEvent populates contextWindow fields from usage", () => {
  const sonnetUsageEvent = (inputTokens: number, outputTokens = 0, eventType = "tool_call_end") => ({
    eventType,
    receivedAt: "2025-01-01T00:00:00Z",
    payload: {
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        model: "claude-sonnet-4-20250514",
      },
    },
  });

  it("hook tool_call_end sets contextWindowPct from input tokens vs model max", () => {
    const initial = createInitialMetrics("ctx-hook");
    const updated = aggregateEvent(initial, sonnetUsageEvent(100_000), DEFAULT_PRICING_TABLE, false);

    expect(updated.contextWindowTokens).toBe(100_000);
    expect(updated.contextWindowMaxTokens).toBe(200_000);
    expect(updated.contextWindowPct).toBe(50);
    expect(updated.contextWindowModel).toBe("claude-sonnet-4-20250514");
  });

  it("OTel api_request sets contextWindowPct even when hook cost is suppressed", () => {
    const initial = createInitialMetrics("ctx-otel");
    const event = sonnetUsageEvent(60_000, 0, "api_request");
    const updated = aggregateEvent(initial, event, DEFAULT_PRICING_TABLE, true);

    expect(updated.contextWindowTokens).toBe(60_000);
    expect(updated.contextWindowPct).toBe(30);
  });

  it("context window is replaced, not accumulated, across successive events", () => {
    const initial = createInitialMetrics("ctx-replace");
    const afterLarge = aggregateEvent(initial, sonnetUsageEvent(150_000), DEFAULT_PRICING_TABLE, false);
    expect(afterLarge.contextWindowPct).toBe(75);

    const afterSmall = aggregateEvent(afterLarge, sonnetUsageEvent(20_000), DEFAULT_PRICING_TABLE, false);
    expect(afterSmall.contextWindowTokens).toBe(20_000);
    expect(afterSmall.contextWindowPct).toBe(10);
  });

  it("contextWindowMaxTokens is sticky once promoted to the 1M beta tier", () => {
    // First request crosses 200k -> session promoted to 1M tier.
    const initial = createInitialMetrics("ctx-sticky");
    const bigUsage = {
      eventType: "api_request",
      receivedAt: "2025-01-01T00:00:00Z",
      payload: {
        usage: {
          input_tokens: 685_000,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          model: "claude-sonnet-4-5-20250929",
        },
      },
    };
    const afterBig = aggregateEvent(initial, bigUsage, DEFAULT_PRICING_TABLE);
    expect(afterBig.contextWindowMaxTokens).toBe(1_000_000);
    expect(afterBig.contextWindowPct).toBeCloseTo(68.5, 1);

    // A later, smaller request must NOT flap the session back to 200k.
    const smallUsage = {
      eventType: "api_request",
      receivedAt: "2025-01-01T00:01:00Z",
      payload: {
        usage: {
          input_tokens: 50_000,
          output_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          model: "claude-sonnet-4-5-20250929",
        },
      },
    };
    const afterSmall = aggregateEvent(afterBig, smallUsage, DEFAULT_PRICING_TABLE);
    expect(afterSmall.contextWindowMaxTokens).toBe(1_000_000);
    expect(afterSmall.contextWindowTokens).toBe(50_000);
    expect(afterSmall.contextWindowPct).toBe(5);
  });

  it("events without a usage record leave the context snapshot untouched", () => {
    const initial = createInitialMetrics("ctx-retain");
    const withContext = aggregateEvent(initial, sonnetUsageEvent(80_000), DEFAULT_PRICING_TABLE, false);
    expect(withContext.contextWindowPct).toBe(40);

    const noUsageEvent = {
      eventType: "user_prompt",
      receivedAt: "2025-01-01T00:00:01Z",
      payload: { text: "hello" },
    };
    const after = aggregateEvent(withContext, noUsageEvent, DEFAULT_PRICING_TABLE, false);
    expect(after.contextWindowTokens).toBe(80_000);
    expect(after.contextWindowPct).toBe(40);
  });
});
