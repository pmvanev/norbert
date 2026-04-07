/**
 * Smoke test: event-to-view pipeline wiring.
 *
 * Verifies that delivering a hook event through the bridge reaches the
 * plugin's shared metricsStore and produces non-zero metrics.
 *
 * This catches the class of bug where everything works in isolation
 * but the event bridge is never called in production.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resetHookBridge, deliverHookEvent } from "../../src/plugins/hookBridge";
import { loadPlugins } from "../../src/plugins/lifecycleManager";
import { createPluginRegistry } from "../../src/plugins/pluginRegistry";
import { createNorbertAPI } from "../../src/plugins/apiFactory";
import {
  norbertUsagePlugin,
  usageMetricsStore,
} from "../../src/plugins/norbert-usage/index";
import { createDefaultLayoutState, isSecondaryVisible } from "../../src/layout/zoneToggle";

describe("Event-to-view pipeline", () => {
  beforeEach(() => {
    resetHookBridge();
    loadPlugins(
      [norbertUsagePlugin],
      createPluginRegistry(),
      createNorbertAPI
    );
  });

  it("delivering a session-event updates the shared metricsStore", () => {
    const before = usageMetricsStore.getMetrics();
    expect(before.totalEventCount).toBe(0);

    deliverHookEvent("session-event", {
      event_type: "prompt_submit",
      session_id: "test-sess-1",
      payload: {},
      received_at: new Date().toISOString(),
      provider: "test",
    });

    const after = usageMetricsStore.getMetrics();
    expect(after.totalEventCount).toBe(1);
  });

  it("hook bridge has a registered processor after plugin load", () => {
    // If no processor is registered, deliverHookEvent is a no-op
    // and totalEventCount stays at 0.
    deliverHookEvent("session-event", {
      event_type: "session_start",
      session_id: "test-sess-2",
      payload: {},
      received_at: new Date().toISOString(),
      provider: "test",
    });

    expect(usageMetricsStore.getMetrics().totalEventCount).toBeGreaterThan(0);
  });

  it("tool_result event increments tool call count (OTel-authoritative)", () => {
    deliverHookEvent("session-event", {
      event_type: "tool_result",
      session_id: "test-sess-3",
      payload: { tool_name: "Read", success: true, duration_ms: 100 },
      received_at: new Date().toISOString(),
      provider: "otel",
    });

    expect(usageMetricsStore.getMetrics().toolCallCount).toBe(1);
  });
});

describe("Initial layout state", () => {
  it("has no secondary zone on startup", () => {
    const layout = createDefaultLayoutState();
    expect(isSecondaryVisible(layout)).toBe(false);
  });
});
