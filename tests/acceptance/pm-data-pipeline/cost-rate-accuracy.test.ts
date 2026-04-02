/**
 * Acceptance tests: Cost Rate Accuracy
 *
 * Validates that the cost rate computation produces realistic values,
 * not inflated by artificial time deltas.
 *
 * Bug history:
 * - deriveCategorySamples used a hardcoded 1ms delta, inflating cost
 *   rates by ~1000x ($0.14 per API call → $140/sec → $8,400/min)
 * - Heartbeat carried forward stale rates, making momentary spikes
 *   appear sustained
 *
 * These tests verify that:
 * 1. Cost rates from the hook processor are bounded by realistic values
 * 2. Heartbeat produces zero rates during idle (no tokens/dollars flowing)
 * 3. The rate computation uses real elapsed time, not synthetic deltas
 *
 * Traces to: performance-monitor-design-spec.md "2. The Main Graph"
 */

import { describe, it, expect } from "vitest";

import { createHookProcessor, type HookProcessorDeps } from "../../../src/plugins/norbert-usage/hookProcessor";
import type { SessionMetrics } from "../../../src/plugins/norbert-usage/domain/types";
import { createInitialMetrics } from "../../../src/plugins/norbert-usage/domain/metricsAggregator";
import { DEFAULT_PRICING_TABLE } from "../../../src/plugins/norbert-usage/domain/pricingModel";
import type { CategorySampleInput } from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";
import { createHeartbeatSample } from "../../../src/plugins/norbert-usage/domain/heartbeat";

// ---------------------------------------------------------------------------
// Helper: create a hook processor with captured samples
// ---------------------------------------------------------------------------

const createTestProcessor = () => {
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
  return { processor, appendedSamples, sessionMetrics };
};

// ---------------------------------------------------------------------------
// Cost rate from hook processor is bounded by realistic values
// ---------------------------------------------------------------------------

describe("Cost rate from api_request event is realistic", () => {
  it("cost rate does not exceed $10/sec for a single Opus API call", () => {
    // Given a hook processor
    const { processor, appendedSamples } = createTestProcessor();

    // When an api_request event arrives with typical Opus usage
    // (a $0.14 call — 337 input + 12 output + 22996 cache creation tokens)
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
        },
      },
    });

    // Then the cost rate sample should be bounded
    expect(appendedSamples.length).toBeGreaterThanOrEqual(1);
    const lastSample = appendedSamples[appendedSamples.length - 1];

    // Cost rate in $/sec: even at 1 second elapsed, $0.14/1s = $0.14/sec
    // It should NEVER be $140/sec (the 1ms bug) or higher
    expect(lastSample.samples.cost).toBeLessThan(10);
  });

  it("cost rate for a typical Sonnet call is under $1/sec", () => {
    // Given a hook processor
    const { processor, appendedSamples } = createTestProcessor();

    // When a Sonnet api_request arrives (~$0.003 per call)
    processor({
      session_id: "s1",
      event_type: "api_request",
      payload: {
        usage: {
          input_tokens: 500,
          output_tokens: 200,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
          cost_usd: 0.0045,
          model: "claude-sonnet-4-20250514",
        },
      },
    });

    expect(appendedSamples.length).toBeGreaterThanOrEqual(1);
    const lastSample = appendedSamples[appendedSamples.length - 1];

    // $0.0045 over 1+ seconds should be well under $1/sec
    expect(lastSample.samples.cost).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Heartbeat injects zero rates (not carried-forward spikes)
// ---------------------------------------------------------------------------

describe("Heartbeat does not sustain cost rate spikes", () => {
  it("heartbeat produces zero cost rate regardless of previous activity", () => {
    // Given a session that previously had high activity
    const session = {
      ...createInitialMetrics("active-session"),
      activeAgentCount: 2,
      contextWindowPct: 45,
    };

    // When a heartbeat sample is created
    const sample = createHeartbeatSample(session);

    // Then rate-based categories are zero (no tokens/dollars flowing now)
    expect(sample.tokens).toBe(0);
    expect(sample.cost).toBe(0);

    // And point-in-time categories reflect session state
    expect(sample.agents).toBe(2);
    expect(sample.context).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// Sanity: cost_usd from OTel is used directly when present
// ---------------------------------------------------------------------------

describe("OTel cost_usd is used directly, not recomputed", () => {
  it("session cost accumulates the exact cost_usd value", () => {
    // Given a hook processor
    const { processor, sessionMetrics } = createTestProcessor();

    // When an api_request with cost_usd arrives
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
        },
      },
    });

    // Then sessionCost reflects the exact cost_usd (not a recomputed value)
    const metrics = sessionMetrics.get("s1");
    expect(metrics).toBeDefined();
    expect(metrics!.sessionCost).toBeCloseTo(0.144065, 4);
  });
});
