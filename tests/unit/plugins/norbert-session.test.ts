/**
 * Unit tests: norbert-session Plugin
 *
 * Validates that the norbert-session plugin correctly implements the
 * NorbertPlugin interface, registers views, tabs, and hook processors,
 * and uses only the public plugin API.
 *
 * Driving port: NorbertPlugin.onLoad() -> NorbertAPI
 */

import { describe, it, expect, beforeEach } from "vitest";
import { loadPlugins } from "../../../src/plugins/lifecycleManager";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import { createPluginRegistry } from "../../../src/plugins/pluginRegistry";
import { resetHookBridge, deliverHookEvent } from "../../../src/plugins/hookBridge";
import { norbertSessionPlugin } from "../../../src/plugins/norbert-session/index";
import { NORBERT_SESSION_MANIFEST } from "../../../src/plugins/norbert-session/manifest";
import { createSessionHookProcessor } from "../../../src/plugins/norbert-session/hookProcessor";
import type { NorbertPlugin, PluginRegistry } from "../../../src/plugins/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const loadNorbertSession = (): PluginRegistry => {
  resetHookBridge();
  return loadPlugins(
    [norbertSessionPlugin],
    createPluginRegistry(),
    createNorbertAPI
  );
};

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

describe("norbert-session manifest", () => {
  it("has correct plugin identity", () => {
    expect(NORBERT_SESSION_MANIFEST.id).toBe("norbert-session");
    expect(NORBERT_SESSION_MANIFEST.name).toBe("Norbert Session");
    expect(NORBERT_SESSION_MANIFEST.version).toBe("0.3.0");
    expect(NORBERT_SESSION_MANIFEST.norbert_api).toBe("^0.3.0");
    expect(NORBERT_SESSION_MANIFEST.dependencies).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Plugin interface compliance
// ---------------------------------------------------------------------------

describe("norbert-session plugin interface", () => {
  it("exports a valid NorbertPlugin with manifest, onLoad, and onUnload", () => {
    expect(norbertSessionPlugin.manifest).toBeDefined();
    expect(norbertSessionPlugin.onLoad).toBeTypeOf("function");
    expect(norbertSessionPlugin.onUnload).toBeTypeOf("function");
  });

  it("manifest matches the exported constant", () => {
    expect(norbertSessionPlugin.manifest).toEqual(NORBERT_SESSION_MANIFEST);
  });
});

// ---------------------------------------------------------------------------
// View registration
// ---------------------------------------------------------------------------

describe("norbert-session view registration", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = loadNorbertSession();
  });

  it("registers session-list as a primary view with correct metadata", () => {
    const sessionList = registry.views.find((v) => v.id === "session-list");
    expect(sessionList).toBeDefined();
    expect(sessionList!.pluginId).toBe("norbert-session");
    expect(sessionList!.label).toBe("Sessions");
    expect(sessionList!.icon).toBe("list-tree");
    expect(sessionList!.primaryView).toBe(true);
    expect(sessionList!.floatMetric).toBe("active_session_count");
  });

  it("registers session-detail as a non-primary view", () => {
    const sessionDetail = registry.views.find((v) => v.id === "session-detail");
    expect(sessionDetail).toBeDefined();
    expect(sessionDetail!.pluginId).toBe("norbert-session");
    expect(sessionDetail!.label).toBe("Session Detail");
    expect(sessionDetail!.primaryView).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tab registration
// ---------------------------------------------------------------------------

describe("norbert-session tab registration", () => {
  it("registers a sessions sidebar tab", () => {
    const registry = loadNorbertSession();
    const sessionsTab = registry.tabs.find((t) => t.id === "sessions");
    expect(sessionsTab).toBeDefined();
    expect(sessionsTab!.pluginId).toBe("norbert-session");
    expect(sessionsTab!.icon).toBe("list-tree");
    expect(sessionsTab!.label).toBe("Sessions");
  });
});

// ---------------------------------------------------------------------------
// Hook processor registration
// ---------------------------------------------------------------------------

describe("norbert-session hook processor", () => {
  it("registers a hook processor for session events", () => {
    const registry = loadNorbertSession();
    const sessionHook = registry.hookRegistrations.find(
      (h) => h.pluginId === "norbert-session"
    );
    expect(sessionHook).toBeDefined();
    expect(sessionHook!.hookName).toBe("session-event");
  });

  it("hook processor is a pure function that accepts payloads", () => {
    const processor = createSessionHookProcessor();
    // The processor should accept unknown payloads without throwing
    expect(() => processor({ type: "session_start", sessionId: "s1" })).not.toThrow();
    expect(() => processor(null)).not.toThrow();
    expect(() => processor(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Plugin loads via standard lifecycle
// ---------------------------------------------------------------------------

describe("norbert-session lifecycle", () => {
  it("is marked as loaded in the registry after loadPlugins", () => {
    const registry = loadNorbertSession();
    expect(registry.loadedPluginIds).toContain("norbert-session");
  });

  it("onUnload completes without error", () => {
    expect(() => norbertSessionPlugin.onUnload()).not.toThrow();
  });
});
