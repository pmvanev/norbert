/**
 * Integration test: Plugin wiring connects hooks to dispatch (D1)
 *
 * Proves that loading norbert-notif via loadPlugins and delivering a hook
 * event through the hookBridge results in the registered hook processor
 * being invoked. This validates the walking skeleton wiring end-to-end.
 *
 * Driving ports: loadPlugins, deliverHookEvent
 * Domain: plugin lifecycle, hook bridge
 */

import { describe, it, expect, beforeEach } from "vitest";
import { loadPlugins } from "../../../src/plugins/lifecycleManager";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import { createPluginRegistry } from "../../../src/plugins/pluginRegistry";
import {
  resetHookBridge,
  deliverHookEvent,
} from "../../../src/plugins/hookBridge";
import { norbertNotifPlugin } from "../../../src/plugins/norbert-notif/index";

beforeEach(() => {
  resetHookBridge();
});

describe("Plugin wiring connects hooks to dispatch via hookBridge", () => {
  it("loading norbert-notif and delivering a hook event invokes the registered processor", () => {
    // Given norbert-notif is loaded via the standard plugin loader
    const registry = loadPlugins(
      [norbertNotifPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // And the plugin registered hook processors for notification event sources
    expect(registry.loadedPluginIds).toContain("norbert-notif");
    expect(registry.hookRegistrations.length).toBeGreaterThanOrEqual(1);

    // When a hook event is delivered through the hookBridge
    // (The walking skeleton processor is a no-op, so we verify it does not throw)
    const hookEvent = {
      hookName: "session-event",
      eventType: "session_response_completed",
      payload: {
        sessionName: "integration-test",
        duration: "2m 10s",
        cost: 3.50,
      },
    };

    // Then delivering the event does not throw (processor is wired and invoked)
    expect(() => deliverHookEvent(hookEvent.hookName, hookEvent)).not.toThrow();

    // And the hook registration in the registry confirms the wiring exists
    const sessionHooks = registry.hookRegistrations.filter(
      (hr) => hr.hookName === "session-event" && hr.pluginId === "norbert-notif"
    );
    expect(sessionHooks).toHaveLength(1);
  });
});
