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

/** A PostToolUse event WITH token usage (tool_call_end in canonical form). */
const makeWrappedToolCallEndWithUsage = (sessionId: string) => ({
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

/** A PreToolUse event (tool_call_start, no token data). */
const makeWrappedToolCallStart = (sessionId: string) => ({
  session_id: sessionId,
  event_type: "tool_call_start",
  payload: {
    session_id: sessionId,
    tool: "Read",
    input: { file_path: "/tmp/test.ts" },
  },
  received_at: "2026-03-13T22:00:00Z",
  provider: "claude_code",
});

/** A UserPromptSubmit event WITH token usage (prompt_submit). */
const makeWrappedPromptSubmit = (sessionId: string) => ({
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

  it("tool_call_end with usage data produces non-zero tokens and cost in the store", () => {
    const before = usageMetricsStore.getMetrics();
    const event = makeWrappedToolCallEndWithUsage("sess-integration-1");

    deliverHookEvent("session-event", event);

    const after = usageMetricsStore.getMetrics();
    const deltaTokens = after.totalTokens - before.totalTokens;
    expect(deltaTokens).toBe(1600); // 1200 input + 400 output
    expect(after.inputTokens - before.inputTokens).toBe(1200);
    expect(after.outputTokens - before.outputTokens).toBe(400);
    expect(after.sessionCost).toBeGreaterThan(before.sessionCost);
    expect(after.totalEventCount).toBeGreaterThan(before.totalEventCount);
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

  it("tool_call_start increments toolCallCount without adding tokens", () => {
    const before = usageMetricsStore.getMetrics();
    const event = makeWrappedToolCallStart("sess-integration-3");

    deliverHookEvent("session-event", event);

    const after = usageMetricsStore.getMetrics();
    expect(after.toolCallCount).toBe(before.toolCallCount + 1);
    expect(after.totalTokens).toBe(before.totalTokens); // no change
  });

  it("prompt_submit with usage data adds tokens and cost", () => {
    const before = usageMetricsStore.getMetrics();
    const event = makeWrappedPromptSubmit("sess-integration-4");

    deliverHookEvent("session-event", event);

    const after = usageMetricsStore.getMetrics();
    expect(after.totalTokens - before.totalTokens).toBe(4500); // 3000 + 1500
    expect(after.inputTokens - before.inputTokens).toBe(3000);
    expect(after.outputTokens - before.outputTokens).toBe(1500);
    expect(after.sessionCost).toBeGreaterThan(before.sessionCost);
  });

  it("time series buffer receives samples when token events flow", () => {
    const timeSeries = usageMetricsStore.getTimeSeries();
    // Previous token-bearing events should have pushed samples
    expect(timeSeries.samples.length).toBeGreaterThanOrEqual(1);
    expect(timeSeries.samples[0].tokenRate).toBeGreaterThan(0);
  });
});
