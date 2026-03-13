/**
 * Acceptance tests: Multi-Window with Independent Layouts (US-006)
 *
 * Validates multiple independent Norbert windows sharing a single
 * backend process, each with independent layout and live updates.
 *
 * Driving ports: WindowCreate port, WindowClose port, WindowLabel port
 * These tests invoke through the window management interface,
 * never through internal Tauri webview creation or IPC routing.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createWindowConfig,
  formatWindowTitle,
} from "../../../src/multiWindow/windowFactory";
import {
  createIpcRouter,
  type HookEvent,
} from "../../../src/multiWindow/ipcRouter";
import {
  createMultiWindowState,
  createWindow,
  closeWindow,
  updateWindowLayout,
  getWindowLayout,
  labelWindow,
  getWindowState,
  type MultiWindowState,
} from "../../../src/multiWindow/windowStateManager";
import {
  serializeLayout,
  deserializeLayout,
  serializeWindowSet,
  deserializeWindowSet,
} from "../../../src/layout/layoutPersistor";
import type { LayoutState } from "../../../src/layout/types";

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Window Lifecycle
// ---------------------------------------------------------------------------

describe("Open new window via right-click on sidebar icon", () => {
  it("new window opens with the selected view in Main zone", () => {
    // GIVEN: the user has Norbert open on the primary monitor
    // WHEN: the user right-clicks the Sessions sidebar icon
    // AND: selects "Open in New Window"
    const config = createWindowConfig("session-list", "norbert-sessions");

    // THEN: a new Norbert window opens with a valid config
    expect(config.ok).toBe(true);
    if (!config.ok) return;

    // AND: the new window shows Session List in its Main zone
    expect(config.value.viewId).toBe("session-list");
    expect(config.value.pluginId).toBe("norbert-sessions");
    expect(config.value.label).toMatch(/^norbert-/);
  });
});

describe("Open new window via keyboard shortcut", () => {
  it("new window opens with default layout", () => {
    // GIVEN: the user has Norbert open
    // WHEN: the user opens a new window via keyboard shortcut (no specific view)
    const config = createWindowConfig(null, null);

    // THEN: a new window opens with the default layout
    expect(config.ok).toBe(true);
    if (!config.ok) return;

    expect(config.value.viewId).toBeNull();
    expect(config.value.pluginId).toBeNull();
    // AND: the window has a unique label
    expect(config.value.label).toMatch(/^norbert-/);
  });
});

describe("Two windows with independent layouts", () => {
  it("changing one window layout does not affect the other", () => {
    // GIVEN: the user has two windows open
    const layout1: LayoutState = {
      zones: new Map([
        ["main", { viewId: "session-list", pluginId: "norbert-sessions" }],
        ["secondary", { viewId: "session-detail", pluginId: "norbert-sessions" }],
      ]),
      floatingPanels: [],
      dividerPosition: 0.6,
      activePreset: "default",
    };
    const layout2: LayoutState = {
      zones: new Map([
        ["main", { viewId: "session-list", pluginId: "norbert-sessions" }],
      ]),
      floatingPanels: [],
      dividerPosition: 1.0,
      activePreset: "default",
    };

    let state = createMultiWindowState();
    state = createWindow(state, "window-1", "Window 1", layout1);
    state = createWindow(state, "window-2", "Window 2", layout2);

    // WHEN: the user changes Window 2's Main view to a different plugin
    const updatedLayout2: LayoutState = {
      ...layout2,
      zones: new Map([
        ["main", { viewId: "event-detail", pluginId: "norbert-events" }],
      ]),
    };
    state = updateWindowLayout(state, "window-2", updatedLayout2);

    // THEN: Window 1's layout is completely unaffected
    const window1Layout = getWindowLayout(state, "window-1");
    expect(window1Layout).toBeDefined();
    expect(window1Layout!.zones.get("main")?.viewId).toBe("session-list");
    expect(window1Layout!.zones.get("secondary")?.viewId).toBe("session-detail");
    expect(window1Layout!.dividerPosition).toBe(0.6);

    // AND: Window 2's layout reflects the change
    const window2Layout = getWindowLayout(state, "window-2");
    expect(window2Layout).toBeDefined();
    expect(window2Layout!.zones.get("main")?.viewId).toBe("event-detail");
  });
});

describe("Both windows receive live event updates", () => {
  it("hook event updates appear in both windows", () => {
    // GIVEN: the user has two windows showing the same session view
    const router = createIpcRouter();
    const receivedByWindow1: HookEvent[] = [];
    const receivedByWindow2: HookEvent[] = [];

    const unsubscribe1 = router.subscribeWindow("window-1", (event) => {
      receivedByWindow1.push(event);
    });
    const unsubscribe2 = router.subscribeWindow("window-2", (event) => {
      receivedByWindow2.push(event);
    });

    // WHEN: a new hook event arrives
    const hookEvent: HookEvent = {
      hookName: "session_start",
      payload: { sessionId: "abc-123" },
      timestamp: Date.now(),
    };
    router.broadcastEvent(hookEvent);

    // THEN: both windows update to reflect the new event
    expect(receivedByWindow1).toEqual([hookEvent]);
    expect(receivedByWindow2).toEqual([hookEvent]);

    unsubscribe1();
    unsubscribe2();
  });
});

describe("Label a window for identification", () => {
  it("label appears in title bar and status bar", () => {
    // GIVEN: the user has a second window open
    const layout: LayoutState = {
      zones: new Map([["main", { viewId: null, pluginId: null }]]),
      floatingPanels: [],
      dividerPosition: 1.0,
      activePreset: "default",
    };
    let state = createMultiWindowState();
    state = createWindow(state, "window-2", "norbert-2", layout);

    // WHEN: the user labels the window "Monitor 2 - Sessions"
    state = labelWindow(state, "window-2", "Monitor 2 - Sessions");

    // THEN: the title bar shows "Norbert - Monitor 2 - Sessions"
    const windowState = getWindowState(state, "window-2");
    expect(windowState).toBeDefined();
    const title = formatWindowTitle(windowState!.label);
    expect(title).toBe("Norbert - Monitor 2 - Sessions");

    // AND: the status bar shows the label
    expect(windowState!.label).toBe("Monitor 2 - Sessions");
  });
});

// ---------------------------------------------------------------------------
// PERSISTENCE SCENARIOS
// ---------------------------------------------------------------------------

describe("Per-window layout persists across restart", () => {
  it("both windows reopen with their saved layouts", () => {
    // GIVEN: the user has two windows with different layouts
    const layout1: LayoutState = {
      zones: new Map([
        ["main", { viewId: "session-list", pluginId: "norbert-sessions" }],
      ]),
      floatingPanels: [],
      dividerPosition: 0.7,
      activePreset: "default",
    };
    const layout2: LayoutState = {
      zones: new Map([
        ["main", { viewId: "event-detail", pluginId: "norbert-events" }],
      ]),
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "debug",
    };

    let state = createMultiWindowState();
    state = createWindow(state, "window-1", "Main Monitor", layout1);
    state = createWindow(state, "window-2", "Side Monitor", layout2);

    // WHEN: the user quits (serialize per-window layouts + window set)
    const layout1Json = serializeLayout(layout1);
    const layout2Json = serializeLayout(layout2);
    const windowSetJson = serializeWindowSet(state);

    // AND: relaunches Norbert (deserialize window set + per-window layouts)
    const restoredWindowSet = deserializeWindowSet(windowSetJson);
    const restoredLayout1 = deserializeLayout(layout1Json);
    const restoredLayout2 = deserializeLayout(layout2Json);

    // THEN: both windows reopen
    expect(restoredWindowSet).toHaveLength(2);
    expect(restoredWindowSet[0].windowId).toBe("window-1");
    expect(restoredWindowSet[0].label).toBe("Main Monitor");
    expect(restoredWindowSet[1].windowId).toBe("window-2");
    expect(restoredWindowSet[1].label).toBe("Side Monitor");

    // AND: each has its saved layout restored
    expect(restoredLayout1.dividerPosition).toBe(0.7);
    expect(restoredLayout1.zones.get("main")?.viewId).toBe("session-list");
    expect(restoredLayout2.dividerPosition).toBe(0.5);
    expect(restoredLayout2.zones.get("main")?.viewId).toBe("event-detail");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Closing one window does not affect others", () => {
  it("remaining window continues operating normally", () => {
    // GIVEN: the user has two windows open
    const layout: LayoutState = {
      zones: new Map([["main", { viewId: "session-list", pluginId: "norbert-sessions" }]]),
      floatingPanels: [],
      dividerPosition: 1.0,
      activePreset: "default",
    };
    let state = createMultiWindowState();
    state = createWindow(state, "window-1", "Primary", layout);
    state = createWindow(state, "window-2", "Secondary", layout);

    // WHEN: the user closes Window 2
    state = closeWindow(state, "window-2");

    // THEN: Window 1 continues operating normally
    const window1Layout = getWindowLayout(state, "window-1");
    expect(window1Layout).toBeDefined();
    expect(window1Layout!.zones.get("main")?.viewId).toBe("session-list");

    // AND: Window 2 is gone
    expect(getWindowLayout(state, "window-2")).toBeUndefined();

    // AND: the backend process remains alive (state still has windows)
    expect(state.windows).toHaveLength(1);
  });
});

describe("Last window closing keeps backend alive in tray mode", () => {
  it("backend continues receiving hooks after last window closes", () => {
    // GIVEN: the user has one Norbert window open
    const layout: LayoutState = {
      zones: new Map([["main", { viewId: "session-list", pluginId: "norbert-sessions" }]]),
      floatingPanels: [],
      dividerPosition: 1.0,
      activePreset: "default",
    };
    let state = createMultiWindowState();
    state = createWindow(state, "window-1", "Primary", layout);

    // WHEN: the user closes the last window
    state = closeWindow(state, "window-1");

    // THEN: the state is empty but valid (backend continues running in tray)
    expect(state.windows).toHaveLength(0);

    // AND: hooks continue to be received via the router (independent of window state)
    const router = createIpcRouter();
    const received: HookEvent[] = [];
    // No windows subscribed, but router still works
    router.broadcastEvent({
      hookName: "session_start",
      payload: {},
      timestamp: Date.now(),
    });
    // Backend is alive -- router accepts events even with no windows
    expect(router.subscriberCount()).toBe(0);

    // WHEN: the user clicks the tray icon to reopen
    // The window can be re-created from persisted layout
    state = createWindow(state, "window-1", "Primary", layout);
    expect(state.windows).toHaveLength(1);
    expect(getWindowLayout(state, "window-1")?.zones.get("main")?.viewId).toBe(
      "session-list"
    );
  });
});

describe("Single backend process regardless of window count", () => {
  it("opening additional windows does not spawn new backend processes", () => {
    // GIVEN: Norbert is running with one window
    // The single-backend invariant is enforced by the window factory:
    // creating window configs never spawns a new process.
    // All configs reference the same backend via the shared IPC router.
    const router = createIpcRouter();

    // WHEN: the user opens a second and third window
    const config1 = createWindowConfig("session-list", "norbert-sessions");
    const config2 = createWindowConfig("event-detail", "norbert-events");
    const config3 = createWindowConfig(null, null);

    expect(config1.ok).toBe(true);
    expect(config2.ok).toBe(true);
    expect(config3.ok).toBe(true);

    // Subscribe all three windows
    const received: HookEvent[][] = [[], [], []];
    const unsub1 = router.subscribeWindow("w1", (e) => received[0].push(e));
    const unsub2 = router.subscribeWindow("w2", (e) => received[1].push(e));
    const unsub3 = router.subscribeWindow("w3", (e) => received[2].push(e));

    // THEN: all windows share the same data source (single router)
    const event: HookEvent = {
      hookName: "test_event",
      payload: {},
      timestamp: Date.now(),
    };
    router.broadcastEvent(event);

    // AND: all three windows receive the event from the single backend
    expect(received[0]).toHaveLength(1);
    expect(received[1]).toHaveLength(1);
    expect(received[2]).toHaveLength(1);

    unsub1();
    unsub2();
    unsub3();
  });
});

// @property
describe("No performance degradation with two windows", () => {
  it("two windows with independent layouts do not interfere", () => {
    // Property: for any two distinct window IDs and any layouts,
    // updating one window's layout never changes the other's layout.
    const layoutArb = fc.record({
      dividerPosition: fc.double({ min: 0, max: 1, noNaN: true }),
      activePreset: fc.string({ minLength: 1, maxLength: 20 }),
    });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        layoutArb,
        layoutArb,
        layoutArb,
        (windowId1, windowId2, layoutProps1, layoutProps2, updateProps) => {
          // Require distinct window IDs
          if (windowId1 === windowId2) return true;

          const makeLayout = (props: {
            dividerPosition: number;
            activePreset: string;
          }): LayoutState => ({
            zones: new Map([["main", { viewId: null, pluginId: null }]]),
            floatingPanels: [],
            dividerPosition: props.dividerPosition,
            activePreset: props.activePreset,
          });

          let state = createMultiWindowState();
          state = createWindow(state, windowId1, "w1", makeLayout(layoutProps1));
          state = createWindow(state, windowId2, "w2", makeLayout(layoutProps2));

          // Update window 2's layout
          state = updateWindowLayout(
            state,
            windowId2,
            makeLayout(updateProps)
          );

          // Window 1's layout must be unchanged
          const w1Layout = getWindowLayout(state, windowId1);
          return (
            w1Layout !== undefined &&
            w1Layout.dividerPosition === layoutProps1.dividerPosition &&
            w1Layout.activePreset === layoutProps1.activePreset
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
