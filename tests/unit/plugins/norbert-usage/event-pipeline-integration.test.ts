/**
 * Integration test: Event Pipeline (DB event → hookProcessor → metricsStore)
 *
 * This test exercises the full frontend event pipeline using production-shaped
 * event payloads (as returned by Tauri IPC `get_session_events`).
 *
 * The bug this catches: hookProcessor received the full DB event wrapper
 * { session_id, event_type, payload: { usage: {...} }, ... } but passed it
 * as-is to the aggregator. The token extractor looked for `payload.usage`
 * at the wrong nesting level and always returned "absent".
 *
 * This test wires up the real plugin onLoad, feeds production-shaped events
 * through the registered hook processor, and asserts the metrics store
 * reflects extracted tokens and computed costs.
 *
 * NOTE: usageMetricsStore is a module-level singleton that accumulates state
 * across tests. Tests use delta assertions (before/after) instead of absolute
 * values.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { usageMetricsStore } from "../../../../src/plugins/norbert-usage/index";
import { norbertUsagePlugin } from "../../../../src/plugins/norbert-usage/index";
import { resetHookBridge, deliverHookEvent } from "../../../../src/plugins/hookBridge";
import { createPluginRegistry } from "../../../../src/plugins/pluginRegistry";
import { createNorbertAPI } from "../../../../src/plugins/apiFactory";
import { loadPlugins } from "../../../../src/plugins/lifecycleManager";
import { norbertSessionPlugin } from "../../../../src/plugins/norbert-session/index";

// ---------------------------------------------------------------------------
// Production event shapes — exactly what get_session_events returns via IPC
// ---------------------------------------------------------------------------

/** An OTel api_request event WITH token usage -- the sole cost-bearing
 *  event type under the OTel-authoritative policy. */
const makeWrappedApiRequestWithUsage = (sessionId: string) => ({
  session_id: sessionId,
  event_type: "api_request",
  payload: {
    session_id: sessionId,
    usage: {
      input_tokens: 1200,
      output_tokens: 400,
      cache_read_input_tokens: 500,
      cache_creation_input_tokens: 0,
      model: "claude-sonnet-4-20250514",
    },
  },
  received_at: "2026-03-13T22:00:00Z",
  provider: "otel",
});

/** A hook tool_call_end with usage -- refreshes context window but must
 *  NOT credit tokens/cost. */
const makeWrappedHookToolCallEndWithUsage = (sessionId: string) => ({
  session_id: sessionId,
  event_type: "tool_call_end",
  payload: {
    session_id: sessionId,
    tool: "Read",
    input: { file_path: "/tmp/test.ts" },
    usage: {
      input_tokens: 1200,
      output_tokens: 400,
      cache_read_input_tokens: 500,
      cache_creation_input_tokens: 0,
      model: "claude-sonnet-4-20250514",
    },
  },
  received_at: "2026-03-13T22:00:00Z",
  provider: "claude_code",
});

/** A SessionStart event (no token data expected). */
const makeWrappedSessionStart = (sessionId: string) => ({
  session_id: sessionId,
  event_type: "session_start",
  payload: {
    session_id: sessionId,
  },
  received_at: "2026-03-13T21:59:00Z",
  provider: "claude_code",
});

/** An OTel tool_result event -- drives toolCallCount under the
 *  OTel-authoritative policy. */
const makeWrappedToolResult = (sessionId: string) => ({
  session_id: sessionId,
  event_type: "tool_result",
  payload: {
    session_id: sessionId,
    tool_name: "Read",
    success: true,
    duration_ms: 120,
  },
  received_at: "2026-03-13T22:00:00Z",
  provider: "otel",
});

/** A hook prompt_submit with usage -- refreshes context window but
 *  must NOT credit tokens/cost under the OTel-authoritative policy. */
const makeWrappedHookPromptSubmit = (sessionId: string) => ({
  session_id: sessionId,
  event_type: "prompt_submit",
  payload: {
    session_id: sessionId,
    usage: {
      input_tokens: 3000,
      output_tokens: 1500,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
      model: "claude-opus-4-20250514",
    },
  },
  received_at: "2026-03-13T22:01:00Z",
  provider: "claude_code",
});

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("Event pipeline integration: DB event → hookBridge → metricsStore", () => {
  beforeAll(() => {
    // Initialize plugin system once (same as App.tsx does on mount)
    resetHookBridge();
    loadPlugins(
      [norbertSessionPlugin, norbertUsagePlugin],
      createPluginRegistry(),
      createNorbertAPI,
    );
  });

  it("OTel api_request with usage data produces non-zero tokens and cost in the store", () => {
    const before = usageMetricsStore.getMetrics();
    const event = makeWrappedApiRequestWithUsage("sess-integration-1");

    deliverHookEvent("session-event", event);

    const after = usageMetricsStore.getMetrics();
    const deltaTokens = after.totalTokens - before.totalTokens;
    expect(deltaTokens).toBe(1600); // 1200 input + 400 output
    expect(after.inputTokens - before.inputTokens).toBe(1200);
    expect(after.outputTokens - before.outputTokens).toBe(400);
    expect(after.sessionCost).toBeGreaterThan(before.sessionCost);
    expect(after.totalEventCount).toBeGreaterThan(before.totalEventCount);
  });

  it("hook tool_call_end refreshes context window but does not credit cost", () => {
    const before = usageMetricsStore.getMetrics();
    const event = makeWrappedHookToolCallEndWithUsage("sess-integration-ctx");

    deliverHookEvent("session-event", event);

    const after = usageMetricsStore.getMetrics();
    expect(after.totalTokens).toBe(before.totalTokens);
    expect(after.sessionCost).toBe(before.sessionCost);
    expect(after.contextWindowTokens).toBe(1700); // 1200 input + 500 cache_read
    expect(after.totalEventCount).toBe(before.totalEventCount + 1);
  });

  it("session_start event increments activeAgentCount without adding tokens", () => {
    const before = usageMetricsStore.getMetrics();
    const event = makeWrappedSessionStart("sess-integration-2");

    deliverHookEvent("session-event", event);

    const after = usageMetricsStore.getMetrics();
    expect(after.activeAgentCount).toBe(before.activeAgentCount + 1);
    expect(after.totalTokens).toBe(before.totalTokens); // no change
    expect(after.sessionCost).toBe(before.sessionCost); // no change
    expect(after.totalEventCount).toBe(before.totalEventCount + 1);
  });

  it("OTel tool_result increments toolCallCount without adding tokens", () => {
    const before = usageMetricsStore.getMetrics();
    const event = makeWrappedToolResult("sess-integration-3");

    deliverHookEvent("session-event", event);

    const after = usageMetricsStore.getMetrics();
    expect(after.toolCallCount).toBe(before.toolCallCount + 1);
    expect(after.totalTokens).toBe(before.totalTokens); // no change
  });

  it("hook prompt_submit with usage refreshes context without adding tokens/cost", () => {
    const before = usageMetricsStore.getMetrics();
    const event = makeWrappedHookPromptSubmit("sess-integration-4");

    deliverHookEvent("session-event", event);

    const after = usageMetricsStore.getMetrics();
    expect(after.totalTokens).toBe(before.totalTokens);
    expect(after.sessionCost).toBe(before.sessionCost);
    // 3000 input + 0 cache tokens for Opus (200k window) => 1.5%
    expect(after.contextWindowTokens).toBe(3000);
  });

  it("time series buffer receives samples when api_request events flow", () => {
    const timeSeries = usageMetricsStore.getTimeSeries();
    // Previous api_request events should have pushed samples
    expect(timeSeries.samples.length).toBeGreaterThanOrEqual(1);
    expect(timeSeries.samples[0].tokenRate).toBeGreaterThan(0);
  });
});
