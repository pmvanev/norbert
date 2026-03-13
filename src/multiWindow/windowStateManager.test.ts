/// Window State Manager unit tests.
///
/// Tests the pure functions for managing multiple independent window states.
/// Property-based tests verify domain invariants (independence, immutability).

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { LayoutState } from "../layout/types";
import {
  createMultiWindowState,
  createWindow,
  closeWindow,
  updateWindowLayout,
  getWindowLayout,
  labelWindow,
  getWindowState,
} from "./windowStateManager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLayout = (viewId: string | null = null, divider = 1.0): LayoutState => ({
  zones: new Map([["main", { viewId, pluginId: viewId ? "test-plugin" : null }]]),
  floatingPanels: [],
  dividerPosition: divider,
  activePreset: "default",
});

// ---------------------------------------------------------------------------
// createMultiWindowState
// ---------------------------------------------------------------------------

describe("createMultiWindowState", () => {
  it("creates an empty state with no windows", () => {
    const state = createMultiWindowState();
    expect(state.windows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createWindow
// ---------------------------------------------------------------------------

describe("createWindow", () => {
  it("adds a window with the given id, label, and layout", () => {
    const state = createMultiWindowState();
    const layout = makeLayout("session-list");
    const next = createWindow(state, "w1", "Primary", layout);

    expect(next.windows).toHaveLength(1);
    expect(next.windows[0].windowId).toBe("w1");
    expect(next.windows[0].label).toBe("Primary");
    expect(next.windows[0].layoutState).toEqual(layout);
  });

  it("does not mutate the original state", () => {
    const state = createMultiWindowState();
    const layout = makeLayout();
    const next = createWindow(state, "w1", "Primary", layout);

    expect(state.windows).toHaveLength(0);
    expect(next.windows).toHaveLength(1);
  });

  it("adds multiple windows independently", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "First", makeLayout("view-a"));
    state = createWindow(state, "w2", "Second", makeLayout("view-b"));

    expect(state.windows).toHaveLength(2);
    expect(state.windows[0].windowId).toBe("w1");
    expect(state.windows[1].windowId).toBe("w2");
  });
});

// ---------------------------------------------------------------------------
// closeWindow
// ---------------------------------------------------------------------------

describe("closeWindow", () => {
  it("removes the specified window", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "First", makeLayout());
    state = createWindow(state, "w2", "Second", makeLayout());
    state = closeWindow(state, "w1");

    expect(state.windows).toHaveLength(1);
    expect(state.windows[0].windowId).toBe("w2");
  });

  it("returns unchanged state when window id not found", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "First", makeLayout());
    const next = closeWindow(state, "nonexistent");

    expect(next.windows).toHaveLength(1);
  });

  it("can close all windows (empty state)", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "First", makeLayout());
    state = closeWindow(state, "w1");

    expect(state.windows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// updateWindowLayout
// ---------------------------------------------------------------------------

describe("updateWindowLayout", () => {
  it("updates layout for the specified window only", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "First", makeLayout("view-a", 0.5));
    state = createWindow(state, "w2", "Second", makeLayout("view-b", 0.6));

    const newLayout = makeLayout("view-c", 0.8);
    state = updateWindowLayout(state, "w1", newLayout);

    expect(getWindowLayout(state, "w1")?.zones.get("main")?.viewId).toBe("view-c");
    expect(getWindowLayout(state, "w1")?.dividerPosition).toBe(0.8);
    // w2 unchanged
    expect(getWindowLayout(state, "w2")?.zones.get("main")?.viewId).toBe("view-b");
    expect(getWindowLayout(state, "w2")?.dividerPosition).toBe(0.6);
  });

  it("returns unchanged state when window not found", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "First", makeLayout());
    const next = updateWindowLayout(state, "nonexistent", makeLayout("x"));

    expect(next).toEqual(state);
  });
});

// ---------------------------------------------------------------------------
// getWindowLayout
// ---------------------------------------------------------------------------

describe("getWindowLayout", () => {
  it("returns layout for existing window", () => {
    let state = createMultiWindowState();
    const layout = makeLayout("session-list", 0.7);
    state = createWindow(state, "w1", "Primary", layout);

    expect(getWindowLayout(state, "w1")).toEqual(layout);
  });

  it("returns undefined for non-existent window", () => {
    const state = createMultiWindowState();
    expect(getWindowLayout(state, "nonexistent")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// labelWindow
// ---------------------------------------------------------------------------

describe("labelWindow", () => {
  it("updates label for the specified window", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "old-label", makeLayout());
    state = labelWindow(state, "w1", "New Label");

    const windowState = getWindowState(state, "w1");
    expect(windowState?.label).toBe("New Label");
  });

  it("does not affect other windows", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "Label A", makeLayout());
    state = createWindow(state, "w2", "Label B", makeLayout());
    state = labelWindow(state, "w1", "Updated A");

    expect(getWindowState(state, "w1")?.label).toBe("Updated A");
    expect(getWindowState(state, "w2")?.label).toBe("Label B");
  });
});

// ---------------------------------------------------------------------------
// getWindowState
// ---------------------------------------------------------------------------

describe("getWindowState", () => {
  it("returns full window state for existing window", () => {
    let state = createMultiWindowState();
    state = createWindow(state, "w1", "Primary", makeLayout("view-a"));

    const ws = getWindowState(state, "w1");
    expect(ws).toBeDefined();
    expect(ws!.windowId).toBe("w1");
    expect(ws!.label).toBe("Primary");
  });

  it("returns undefined for non-existent window", () => {
    const state = createMultiWindowState();
    expect(getWindowState(state, "nonexistent")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Property: window independence
// ---------------------------------------------------------------------------

describe("windowStateManager properties", () => {
  it("updating one window never affects another", () => {
    const layoutArb = fc.record({
      dividerPosition: fc.double({ min: 0, max: 1, noNaN: true }),
      activePreset: fc.string({ minLength: 1, maxLength: 10 }),
    });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        layoutArb,
        layoutArb,
        layoutArb,
        (id1, id2, props1, props2, updateProps) => {
          if (id1 === id2) return true;

          const toLayout = (p: { dividerPosition: number; activePreset: string }): LayoutState => ({
            zones: new Map([["main", { viewId: null, pluginId: null }]]),
            floatingPanels: [],
            dividerPosition: p.dividerPosition,
            activePreset: p.activePreset,
          });

          let state = createMultiWindowState();
          state = createWindow(state, id1, "w1", toLayout(props1));
          state = createWindow(state, id2, "w2", toLayout(props2));
          state = updateWindowLayout(state, id2, toLayout(updateProps));

          const w1 = getWindowLayout(state, id1);
          return (
            w1 !== undefined &&
            w1.dividerPosition === props1.dividerPosition &&
            w1.activePreset === props1.activePreset
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("close then get returns undefined", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (windowId) => {
          let state = createMultiWindowState();
          state = createWindow(state, windowId, "label", makeLayout());
          state = closeWindow(state, windowId);
          return getWindowLayout(state, windowId) === undefined;
        }
      ),
      { numRuns: 50 }
    );
  });
});
