/**
 * Integration smoke test: Phosphor v2 end-to-end wiring.
 *
 * Closes the "wiring gap" loop that seam tests miss: proves a synthetic
 * hook event flows through the real hookProcessor, populates the real
 * multiSessionStore, and materializes as a non-empty pulse / trace on
 * the buildFrame projection that the PhosphorScopeView consumes.
 *
 * Driving port (acceptance-level): hookProcessor(payload) -> store state
 * Driven port asserted against: buildFrame(store, metric, now) -> Frame
 *
 * All three tests use the real factories (no mocks on the path). Time is
 * controlled with vi.useFakeTimers so the 5s rate ticker fires
 * deterministically.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createHookProcessor,
} from "../../../src/plugins/norbert-usage/hookProcessor";
import { createMultiSessionStore } from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";
import { buildFrame } from "../../../src/plugins/norbert-usage/domain/phosphor/scopeProjection";
import { DEFAULT_PRICING_TABLE } from "../../../src/plugins/norbert-usage/domain/pricingModel";
import { createInitialMetrics } from "../../../src/plugins/norbert-usage/domain/metricsAggregator";

const NOW = 1_700_000_000_000;
const SESSION_ID = "sess-phosphor-smoke";

// ---------------------------------------------------------------------------
// Helpers — minimal payload factories shaped like real Tauri hook events.
// ---------------------------------------------------------------------------

const makeHookPayload = (
  eventType: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> => ({
  session_id: SESSION_ID,
  event_type: eventType,
  provider: "hook",
  ...extras,
});

const makeOtelApiRequestPayload = (
  totalTokens: number,
  durationMs: number,
): Record<string, unknown> => ({
  session_id: SESSION_ID,
  event_type: "api_request",
  provider: "otel",
  payload: {
    session_id: SESSION_ID,
    duration_ms: durationMs,
    usage: {
      input_tokens: Math.floor(totalTokens * 0.6),
      output_tokens: totalTokens - Math.floor(totalTokens * 0.6),
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      model: "claude-sonnet-4-20250514",
    },
  },
});

/**
 * Wire a real hookProcessor to a real multiSessionStore. Mirrors the
 * production wiring in src/plugins/norbert-usage/index.ts but scoped to
 * the test — no global stores, no plugin loader.
 */
const wireProcessorToStore = (
  store: ReturnType<typeof createMultiSessionStore>,
  now: () => number,
) => {
  return createHookProcessor({
    // updateMetrics is required but unused on the v2 path we exercise here.
    // A no-op reducer-sink is sufficient; the broadcast-session store
    // accumulation is out of this test's scope.
    updateMetrics: (_reducer) => {
      /* v1 global store is not under test here */
    },
    updateMultiSessionMetrics: (sessionId, label, reducer) => {
      store.addSession(sessionId);
      const prev = store.getSession(sessionId) ?? createInitialMetrics(sessionId);
      const next = reducer(prev);
      const withLabel = next.sessionLabel === "" && label !== ""
        ? { ...next, sessionLabel: label }
        : next;
      store.updateSession(sessionId, withLabel);
    },
    // v2 phosphor deps — the wiring we are adding.
    appendRateSample: store.appendRateSample,
    appendPulse: store.appendPulse,
    pricingTable: DEFAULT_PRICING_TABLE,
    now,
  });
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Smoke test 1 — per-event tool pulse lands on the frame
// ---------------------------------------------------------------------------

describe("Phosphor v2 end-to-end smoke — real hookProcessor -> real store -> buildFrame", () => {
  it("a PreToolUse hook event produces a visible pulse on the phosphor scope frame", () => {
    const store = createMultiSessionStore();
    const processor = wireProcessorToStore(store, () => Date.now());

    // When the real processor receives a synthetic PreToolUse payload
    processor(makeHookPayload("PreToolUse"));

    // Then the v2 store's pulse log contains a tool-kind pulse for that session
    const framePromptly = buildFrame(store, "events", Date.now());
    expect(framePromptly.traces.length).toBe(1);
    expect(framePromptly.traces[0].sessionId).toBe(SESSION_ID);
    expect(framePromptly.pulses.length).toBeGreaterThan(0);
    const toolPulse = framePromptly.pulses.find((p) => p.kind === "tool");
    expect(toolPulse).toBeDefined();
    expect(toolPulse?.sessionId).toBe(SESSION_ID);
  });

  it("a 5-second tick of hook events produces an events/s rate sample on the frame's trace", () => {
    const store = createMultiSessionStore();
    const processor = wireProcessorToStore(store, () => Date.now());

    // Arrange: three hook events arrive across a 5-second window.
    processor(makeHookPayload("PreToolUse"));
    vi.advanceTimersByTime(1_000);
    processor(makeHookPayload("PostToolUse"));
    vi.advanceTimersByTime(1_000);
    processor(makeHookPayload("PreToolUse"));
    // Advance to the next rate-tick boundary (5s after NOW).
    vi.advanceTimersByTime(3_000);
    // The v2 rate ticker is driven by the composition root. In the test
    // we invoke the sampler directly via the processor's attached method
    // so we don't couple the test to setInterval scheduling semantics.
    processor.sampleRates(Date.now());

    const frame = buildFrame(store, "events", Date.now());
    expect(frame.traces).toHaveLength(1);
    const trace = frame.traces[0];
    // Three events across a 5 second window => 0.6 events/s.
    expect(trace.samples.length).toBeGreaterThan(0);
    expect(trace.latestValue).toBeGreaterThan(0);
  });

  it("an OTel api_request event produces a tokens/s rate sample on the frame's trace", () => {
    const store = createMultiSessionStore();
    const processor = wireProcessorToStore(store, () => Date.now());

    // Given an OTel api_request reporting 500 tokens over 2 seconds
    processor(makeOtelApiRequestPayload(500, 2_000));

    // Then the tokens/s metric trace has one sample at 250 tok/s
    const frame = buildFrame(store, "tokens", Date.now());
    expect(frame.traces).toHaveLength(1);
    const trace = frame.traces[0];
    expect(trace.samples.length).toBeGreaterThan(0);
    // 500 tokens / (2000ms / 1000) = 250 tokens per second
    expect(trace.latestValue).toBeCloseTo(250, 5);
  });
});
