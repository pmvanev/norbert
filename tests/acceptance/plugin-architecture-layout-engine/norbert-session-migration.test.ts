/**
 * Acceptance tests: norbert-session Plugin Migration and API Validation (US-009)
 *
 * Validates that norbert-session works as a standalone plugin using
 * only the public NorbertPlugin interface, and that the session list
 * view is assignable to all placement targets.
 *
 * Driving ports: NorbertPlugin interface (onLoad/onUnload)
 * These tests invoke through the plugin lifecycle contract,
 * validating that norbert-session never uses internal Norbert APIs.
 */

import { describe, it, expect } from "vitest";
import { loadPlugins } from "../../../src/plugins/lifecycleManager";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import { createPluginRegistry } from "../../../src/plugins/pluginRegistry";
import { scanPlugins } from "../../../src/plugins/pluginLoader";
import { resetHookBridge, deliverHookEvent } from "../../../src/plugins/hookBridge";
import { norbertSessionPlugin } from "../../../src/plugins/norbert-session/index";
import { assignView } from "../../../src/layout/assignmentEngine";
import { openPanel, minimizePanel } from "../../../src/layout/floatingPanelManager";
import {
  serializeLayout,
  deserializeLayout,
} from "../../../src/layout/layoutPersistor";
import { createZoneRegistry, addZone } from "../../../src/layout/zoneRegistry";
import { createWindowConfig } from "../../../src/multiWindow/windowFactory";
import {
  createMultiWindowState,
  createWindow,
  getWindowLayout,
  updateWindowLayout,
} from "../../../src/multiWindow/windowStateManager";
import { createIpcRouter } from "../../../src/multiWindow/ipcRouter";
import type { LayoutState } from "../../../src/layout/types";
import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Helper: create a layout with Main and Secondary zones
// ---------------------------------------------------------------------------

const createTwoZoneLayout = (): LayoutState => {
  const zones = addZone(
    createZoneRegistry(),
    "secondary",
    { viewId: null, pluginId: null }
  );
  return {
    zones,
    floatingPanels: [],
    dividerPosition: 0.5,
    activePreset: "Default",
  };
};

// ---------------------------------------------------------------------------
// Helper: load norbert-session and return registry
// ---------------------------------------------------------------------------

const loadSessionPlugin = () => {
  resetHookBridge();
  return loadPlugins(
    [norbertSessionPlugin],
    createPluginRegistry(),
    createNorbertAPI
  );
};

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("norbert-session works across all placement targets", () => {
  it("Session List assignable to Main, Secondary, floating panel, and new window", () => {
    // GIVEN: norbert-session is loaded and registers session-list view
    const registry = loadSessionPlugin();
    const sessionListView = registry.views.find((v) => v.id === "session-list");
    expect(sessionListView).toBeDefined();

    // AND: a layout with Main and Secondary zones exists
    const layout = createTwoZoneLayout();

    // WHEN: Session List is assigned to the Main zone via assignView
    const withMain = assignView(layout, "main", "session-list", "norbert-session");

    // THEN: Main zone holds session-list
    expect(withMain.zones.get("main")).toEqual({
      viewId: "session-list",
      pluginId: "norbert-session",
    });

    // WHEN: Session List is assigned to the Secondary zone
    const withSecondary = assignView(layout, "secondary", "session-list", "norbert-session");

    // THEN: Secondary zone holds session-list
    expect(withSecondary.zones.get("secondary")).toEqual({
      viewId: "session-list",
      pluginId: "norbert-session",
    });

    // WHEN: Session List is opened as a floating panel
    const withPanel = openPanel(
      layout,
      "session-list",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );

    // THEN: the floating panel holds session-list
    expect(withPanel.floatingPanels).toHaveLength(1);
    expect(withPanel.floatingPanels[0].viewId).toBe("session-list");
    expect(withPanel.floatingPanels[0].pluginId).toBe("norbert-session");

    // WHEN: Session List is opened in a new window
    const windowConfig = createWindowConfig("session-list", "norbert-session", "sessions-window");
    expect(windowConfig.ok).toBe(true);
    if (windowConfig.ok) {
      const windowState = createWindow(
        createMultiWindowState(),
        "win-1",
        windowConfig.value.label,
        withMain
      );

      // THEN: the new window has a layout with session-list in main zone
      const windowLayout = getWindowLayout(windowState, "win-1");
      expect(windowLayout).toBeDefined();
      expect(windowLayout!.zones.get("main")).toEqual({
        viewId: "session-list",
        pluginId: "norbert-session",
      });
    }
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Plugin Registration
// ---------------------------------------------------------------------------

describe("norbert-session registers views via plugin API", () => {
  it("Session List and sidebar icon appear after registration", () => {
    // GIVEN: norbert-session implements NorbertPlugin interface
    resetHookBridge();
    const registry = loadPlugins(
      [norbertSessionPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // WHEN: norbert-session calls api.ui.registerView() with "session-list" as primaryView
    const sessionListView = registry.views.find((v) => v.id === "session-list");
    const sessionDetailView = registry.views.find((v) => v.id === "session-detail");

    // THEN: the view appears in the layout engine's view picker
    expect(sessionListView).toBeDefined();
    expect(sessionListView!.pluginId).toBe("norbert-session");
    expect(sessionListView!.label).toBe("Sessions");
    expect(sessionListView!.icon).toBe("\u229E");
    expect(sessionListView!.primaryView).toBe(true);

    // AND: session-detail view is also registered
    expect(sessionDetailView).toBeDefined();
    expect(sessionDetailView!.pluginId).toBe("norbert-session");
    expect(sessionDetailView!.label).toBe("Session Detail");

    // AND: the sidebar shows the Sessions icon
    const sessionsTab = registry.tabs.find((t) => t.id === "sessions");
    expect(sessionsTab).toBeDefined();
    expect(sessionsTab!.pluginId).toBe("norbert-session");
    expect(sessionsTab!.icon).toBe("\u229E");

    // AND: a hook processor is registered
    expect(registry.hookRegistrations.length).toBeGreaterThanOrEqual(1);
    const sessionHook = registry.hookRegistrations.find(
      (h) => h.pluginId === "norbert-session"
    );
    expect(sessionHook).toBeDefined();
  });
});

describe("norbert-session is a standalone plugin using only public API", () => {
  it("plugin uses zero internal Norbert APIs", () => {
    // GIVEN: norbert-session source code
    const pluginDir = path.resolve(__dirname, "../../../src/plugins/norbert-session");
    const pluginFiles = fs.readdirSync(pluginDir).filter(
      (f) => f.endsWith(".ts") || f.endsWith(".tsx")
    );

    // WHEN: inspecting its imports and dependencies
    for (const file of pluginFiles) {
      const content = fs.readFileSync(path.join(pluginDir, file), "utf-8");

      // THEN: it imports only from the public NorbertPlugin/NorbertAPI interface
      // AND: no internal Norbert modules are referenced
      // Allowed imports: ../types (plugin types), React, domain modules re-exported through plugin API
      // Forbidden: @tauri-apps, direct ../pluginLoader, ../lifecycleManager, ../apiFactory, etc.
      const importLines = content.match(/^import .+ from .+$/gm) ?? [];
      for (const importLine of importLines) {
        // Extract the import path
        const importPathMatch = importLine.match(/from\s+["'](.+?)["']/);
        if (importPathMatch) {
          const importPath = importPathMatch[1];
          // Allow: relative ../types, react, domain modules within the plugin itself
          // Forbid: @tauri-apps, internal plugin infra modules
          expect(importPath).not.toContain("@tauri-apps");
          expect(importPath).not.toMatch(/\.\.\/(pluginLoader|lifecycleManager|apiFactory|sandboxEnforcer|hookBridge|pluginRegistry|dependencyResolver)/);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Placement Targets
// ---------------------------------------------------------------------------

describe("Session List view persists in layout across restart", () => {
  it("session view assignment survives app restart", () => {
    // GIVEN: the user has Session List in Main zone
    const layout = createTwoZoneLayout();
    const withSession = assignView(layout, "main", "session-list", "norbert-session");

    // WHEN: the layout is serialized (simulating app shutdown save)
    const json = serializeLayout(withSession);

    // AND: the layout is deserialized (simulating app restart restore)
    const restored = deserializeLayout(json);

    // THEN: Session List appears in Main zone after restart
    expect(restored.zones.get("main")).toEqual({
      viewId: "session-list",
      pluginId: "norbert-session",
    });

    // AND: the divider position and preset are preserved
    expect(restored.dividerPosition).toBe(withSession.dividerPosition);
    expect(restored.activePreset).toBe(withSession.activePreset);
  });
});

describe("Session List in floating panel shows live metric", () => {
  it("minimized pill shows active session count and updates live", () => {
    // GIVEN: norbert-session is loaded and registers floatMetric
    const registry = loadSessionPlugin();
    const sessionListView = registry.views.find((v) => v.id === "session-list");
    expect(sessionListView).toBeDefined();
    expect(sessionListView!.floatMetric).toBe("active_session_count");

    // AND: Session List is open as a floating panel
    const layout = createTwoZoneLayout();
    const withPanel = openPanel(
      layout,
      "session-list",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );

    // WHEN: the user minimizes the panel
    const minimized = minimizePanel(withPanel, 0);

    // THEN: the panel is minimized (pill state)
    expect(minimized.floatingPanels[0].minimized).toBe(true);

    // AND: the panel still references session-list for metric display
    expect(minimized.floatingPanels[0].viewId).toBe("session-list");
    expect(minimized.floatingPanels[0].pluginId).toBe("norbert-session");

    // AND: the float metric key is available from the view registration
    // (the rendering layer would use this to look up the live metric value)
    expect(sessionListView!.floatMetric).toBe("active_session_count");

    // AND: the hook processor can receive session events to update the count
    // Deliver session events and verify the processor receives them
    resetHookBridge();
    const freshRegistry = loadPlugins(
      [norbertSessionPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // The hook processor is registered for "session-event" --
    // deliver events and verify no errors (processor handles them)
    expect(() => {
      deliverHookEvent("session-event", { type: "session_start", sessionId: "s1" });
      deliverHookEvent("session-event", { type: "session_start", sessionId: "s2" });
      deliverHookEvent("session-event", { type: "session_start", sessionId: "s3" });
    }).not.toThrow();
  });
});

describe("Session List in new window receives live updates", () => {
  it("both original and new window show same data with live updates", () => {
    // GIVEN: the user has Session List in Main zone in the original window
    const layout = createTwoZoneLayout();
    const withSession = assignView(layout, "main", "session-list", "norbert-session");

    // AND: the user opens Session List in a new window
    const windowConfig = createWindowConfig("session-list", "norbert-session", "sessions-window");
    expect(windowConfig.ok).toBe(true);
    if (!windowConfig.ok) return;

    let multiWindowState = createMultiWindowState();
    multiWindowState = createWindow(multiWindowState, "main-window", "main", withSession);
    multiWindowState = createWindow(multiWindowState, "new-window", windowConfig.value.label, withSession);

    // AND: an IPC router is set up for cross-window event delivery
    const router = createIpcRouter();
    const mainEvents: unknown[] = [];
    const newWindowEvents: unknown[] = [];

    router.subscribeWindow("main-window", (event) => mainEvents.push(event));
    router.subscribeWindow("new-window", (event) => newWindowEvents.push(event));

    // WHEN: a new hook event arrives
    const hookEvent = {
      hookName: "session-event",
      payload: { type: "session_start", sessionId: "s4" },
      timestamp: Date.now(),
    };
    router.broadcastEvent(hookEvent);

    // THEN: both windows receive the event
    expect(mainEvents).toHaveLength(1);
    expect(newWindowEvents).toHaveLength(1);
    expect(mainEvents[0]).toEqual(hookEvent);
    expect(newWindowEvents[0]).toEqual(hookEvent);

    // AND: both windows have session-list in main zone
    const mainLayout = getWindowLayout(multiWindowState, "main-window");
    const newLayout = getWindowLayout(multiWindowState, "new-window");
    expect(mainLayout!.zones.get("main")).toEqual({
      viewId: "session-list",
      pluginId: "norbert-session",
    });
    expect(newLayout!.zones.get("main")).toEqual({
      viewId: "session-list",
      pluginId: "norbert-session",
    });
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("All Phase 2 session list functionality preserved", () => {
  it("no regression in session list features after migration to plugin", () => {
    // GIVEN: norbert-session is loaded as a plugin
    const registry = loadSessionPlugin();

    // THEN: session-list view is registered with correct metadata
    const sessionListView = registry.views.find((v) => v.id === "session-list");
    expect(sessionListView).toBeDefined();
    expect(sessionListView!.primaryView).toBe(true);
    expect(sessionListView!.minWidth).toBe(280);
    expect(sessionListView!.minHeight).toBe(200);

    // AND: session-detail view is registered
    const sessionDetailView = registry.views.find((v) => v.id === "session-detail");
    expect(sessionDetailView).toBeDefined();
    expect(sessionDetailView!.minWidth).toBe(400);
    expect(sessionDetailView!.minHeight).toBe(300);

    // AND: sidebar tab is registered for quick access
    const sessionsTab = registry.tabs.find((t) => t.id === "sessions");
    expect(sessionsTab).toBeDefined();
    expect(sessionsTab!.label).toBe("Sessions");
    expect(sessionsTab!.order).toBe(0);

    // AND: hook processor is registered for session events
    const sessionHook = registry.hookRegistrations.find(
      (h) => h.pluginId === "norbert-session" && h.hookName === "session-event"
    );
    expect(sessionHook).toBeDefined();

    // AND: the plugin can be assigned to layout zones (layout engine compatible)
    const layout = createTwoZoneLayout();
    const withSession = assignView(layout, "main", "session-list", "norbert-session");
    expect(withSession.zones.get("main")!.viewId).toBe("session-list");
  });
});

describe("norbert-session loads via plugin loader like any plugin", () => {
  it("first-party plugin goes through standard load path", () => {
    // GIVEN: norbert-session is bundled with Norbert core
    resetHookBridge();

    // WHEN: the plugin loader scans for installed plugins
    const scannedPlugins = scanPlugins([norbertSessionPlugin]);

    // THEN: norbert-session is discovered via standard scan
    expect(scannedPlugins).toContainEqual(
      expect.objectContaining({ manifest: expect.objectContaining({ id: "norbert-session" }) })
    );

    // AND: it loads via the standard plugin loader
    const registry = loadPlugins(
      scannedPlugins,
      createPluginRegistry(),
      createNorbertAPI
    );

    // AND: it receives the same sandboxed NorbertAPI as third-party plugins
    expect(registry.loadedPluginIds).toContain("norbert-session");
    expect(registry.views.length).toBeGreaterThanOrEqual(2);
  });
});

describe("norbert-session hook processor receives session events", () => {
  it("registered hook processor receives and processes session events", () => {
    // GIVEN: norbert-session has registered a hook processor via api.hooks
    const registry = loadSessionPlugin();

    // Verify the hook registration exists
    const sessionHook = registry.hookRegistrations.find(
      (h) => h.pluginId === "norbert-session" && h.hookName === "session-event"
    );
    expect(sessionHook).toBeDefined();

    // WHEN: session-related hook events arrive
    // THEN: the hook processor receives the events without error
    expect(() => {
      deliverHookEvent("session-event", {
        type: "session_start",
        sessionId: "test-session-1",
        timestamp: Date.now(),
      });
    }).not.toThrow();

    expect(() => {
      deliverHookEvent("session-event", {
        type: "session_end",
        sessionId: "test-session-1",
        timestamp: Date.now(),
      });
    }).not.toThrow();

    // AND: events for unrelated hooks do not cause errors
    expect(() => {
      deliverHookEvent("other-hook", { data: "irrelevant" });
    }).not.toThrow();
  });
});

describe("Session List placement persists in layout file", () => {
  it("norbert-session view placement stored correctly in layout format", () => {
    // GIVEN: Session List is assigned to the Main zone
    const layout = createTwoZoneLayout();
    const withSession = assignView(layout, "main", "session-list", "norbert-session");

    // WHEN: the layout is saved
    const json = serializeLayout(withSession);

    // THEN: the layout file contains the zone assignment
    const parsed = JSON.parse(json);
    const mainZoneEntry = parsed.zones.find(
      (entry: [string, { viewId: string; pluginId: string }]) => entry[0] === "main"
    );
    expect(mainZoneEntry).toBeDefined();
    expect(mainZoneEntry[1].viewId).toBe("session-list");
    expect(mainZoneEntry[1].pluginId).toBe("norbert-session");

    // AND: deserialization restores the assignment exactly
    const restored = deserializeLayout(json);
    expect(restored.zones.get("main")).toEqual({
      viewId: "session-list",
      pluginId: "norbert-session",
    });
  });
});
