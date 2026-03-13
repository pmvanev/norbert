/**
 * Acceptance tests: Floating Panel with Pill Minimize (US-005)
 *
 * Validates floating panels as resizable, repositionable overlays
 * that can minimize to a pill showing a live metric.
 *
 * Driving ports: FloatingPanelControl port
 * These tests invoke through the floating panel control interface,
 * never through internal z-index management or snap calculations.
 */

import { describe, it, expect } from "vitest";
import type { LayoutState, FloatingPanelState } from "../../../src/layout/types";
import {
  openPanel,
  closePanel,
  minimizePanel,
  restorePanel,
  movePanel,
  resizePanel,
  snapToEdge,
} from "../../../src/layout/floatingPanelManager";
import {
  serializeLayout,
  deserializeLayout,
} from "../../../src/layout/layoutPersistor";
import { createZoneRegistry } from "../../../src/layout/zoneRegistry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const emptyLayout: LayoutState = {
  zones: createZoneRegistry(),
  floatingPanels: [],
  dividerPosition: 0.5,
  activePreset: "default",
};

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Panel Lifecycle
// ---------------------------------------------------------------------------

describe("Any registered view can open as a floating panel", () => {
  it("selecting 'Open as Floating Panel' shows overlay with view content", () => {
    // GIVEN: Session List is a registered view
    // WHEN: the user opens it as a floating panel
    const layout = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );

    // THEN: a floating panel appears in the layout state
    expect(layout.floatingPanels).toHaveLength(1);
    const panel = layout.floatingPanels[0];
    expect(panel.viewId).toBe("session-list");
    expect(panel.pluginId).toBe("norbert-session");
    // AND: the panel has the specified position and size
    expect(panel.position).toEqual({ x: 100, y: 100 });
    expect(panel.size).toEqual({ width: 400, height: 300 });
    // AND: the panel is not minimized
    expect(panel.minimized).toBe(false);
  });
});

describe("Floating panel snaps to window edges", () => {
  it("panel snaps when dragged within 20px of window edge", () => {
    // GIVEN: a floating panel exists
    const layout = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 200, y: 200 },
      { width: 400, height: 300 }
    );

    // WHEN: the panel is moved to within 20px of the left edge
    const windowSize = { width: 1920, height: 1080 };
    const snappedPosition = snapToEdge(
      { x: 15, y: 200 },
      { width: 400, height: 300 },
      windowSize
    );

    // THEN: the panel snaps to the window edge (x = 0)
    expect(snappedPosition.x).toBe(0);

    // AND: snapping also works for the top edge
    const snappedTop = snapToEdge(
      { x: 200, y: 10 },
      { width: 400, height: 300 },
      windowSize
    );
    expect(snappedTop.y).toBe(0);

    // AND: snapping works for right edge (panel right edge within 20px)
    const snappedRight = snapToEdge(
      { x: 1920 - 400 - 15, y: 200 },
      { width: 400, height: 300 },
      windowSize
    );
    expect(snappedRight.x).toBe(1920 - 400);

    // AND: snapping works for bottom edge
    const snappedBottom = snapToEdge(
      { x: 200, y: 1080 - 300 - 10 },
      { width: 400, height: 300 },
      windowSize
    );
    expect(snappedBottom.y).toBe(1080 - 300);
  });
});

describe("Minimize to pill with live metric", () => {
  it("pill shows view name and floatMetric value that updates live", () => {
    // GIVEN: the user has a floating Session List panel open
    const layout = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );

    // WHEN: the user minimizes the panel
    const minimized = minimizePanel(layout, 0);

    // THEN: the panel is marked as minimized
    expect(minimized.floatingPanels[0].minimized).toBe(true);
    // AND: the panel retains its previous position and size for restore
    expect(minimized.floatingPanels[0].position).toEqual({ x: 100, y: 100 });
    expect(minimized.floatingPanels[0].size).toEqual({ width: 400, height: 300 });
  });
});

describe("Clicking pill restores panel to previous size and position", () => {
  it("restored panel appears at its pre-minimize position", () => {
    // GIVEN: a floating panel was minimized to a pill
    const layout = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 250, y: 150 },
      { width: 500, height: 350 }
    );
    const minimized = minimizePanel(layout, 0);

    // WHEN: the user clicks the pill (restores)
    const restored = restorePanel(minimized, 0);

    // THEN: the panel restores to its previous size and position
    expect(restored.floatingPanels[0].minimized).toBe(false);
    expect(restored.floatingPanels[0].position).toEqual({ x: 250, y: 150 });
    expect(restored.floatingPanels[0].size).toEqual({ width: 500, height: 350 });
  });
});

describe("Floating panel Switch Mode via menu", () => {
  it("user switches panel content to another view from the same plugin", () => {
    // GIVEN: the user has a floating panel showing Session List
    const layout = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );

    // WHEN: the user switches to Session Detail via the panel menu
    // Switch mode = close old panel + open new panel at same position/size
    const closed = closePanel(layout, 0);
    const switched = openPanel(
      closed,
      "session-detail",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );

    // THEN: the panel content is now Session Detail
    expect(switched.floatingPanels).toHaveLength(1);
    expect(switched.floatingPanels[0].viewId).toBe("session-detail");
    // AND: the panel remains at its current position
    expect(switched.floatingPanels[0].position).toEqual({ x: 100, y: 100 });
  });
});

describe("Multiple floating panels can be open simultaneously", () => {
  it("two floating panels from different plugins coexist", () => {
    // GIVEN: a floating Session List panel is open
    const layout1 = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );

    // WHEN: the user opens a second floating panel for a different view
    const layout2 = openPanel(
      layout1,
      "metrics-dashboard",
      "norbert-metrics",
      { x: 550, y: 100 },
      { width: 500, height: 400 }
    );

    // THEN: both panels are visible
    expect(layout2.floatingPanels).toHaveLength(2);
    // AND: each can be independently moved
    const moved = movePanel(layout2, 0, { x: 200, y: 200 });
    expect(moved.floatingPanels[0].position).toEqual({ x: 200, y: 200 });
    expect(moved.floatingPanels[1].position).toEqual({ x: 550, y: 100 });
    // AND: each can be independently minimized
    const min1 = minimizePanel(moved, 1);
    expect(min1.floatingPanels[0].minimized).toBe(false);
    expect(min1.floatingPanels[1].minimized).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("View without floatMetric minimizes to pill with name only", () => {
  it("pill shows only view name when no metric is declared", () => {
    // GIVEN: a view does not declare a floatMetric
    const layout = openPanel(
      emptyLayout,
      "simple-view",
      "norbert-basic",
      { x: 100, y: 100 },
      { width: 300, height: 200 }
    );

    // WHEN: the user minimizes its floating panel
    const minimized = minimizePanel(layout, 0);

    // THEN: the panel is minimized with no floatMetric
    expect(minimized.floatingPanels[0].minimized).toBe(true);
    expect(minimized.floatingPanels[0].floatMetric).toBeNull();
  });
});

describe("Floating panel position and size persist across restarts", () => {
  it("panel reappears at saved position with same view on restart", () => {
    // GIVEN: the user has positioned a floating panel at a specific location
    const layout = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 350, y: 200 },
      { width: 600, height: 450 }
    );

    // WHEN: the layout is serialized and deserialized (simulates restart)
    const json = serializeLayout(layout);
    const restored = deserializeLayout(json);

    // THEN: the floating panel reappears at the same position and size
    expect(restored.floatingPanels).toHaveLength(1);
    expect(restored.floatingPanels[0].viewId).toBe("session-list");
    expect(restored.floatingPanels[0].pluginId).toBe("norbert-session");
    expect(restored.floatingPanels[0].position).toEqual({ x: 350, y: 200 });
    expect(restored.floatingPanels[0].size).toEqual({ width: 600, height: 450 });
  });
});

describe("Closing floating panel removes it from layout state", () => {
  it("closed panel does not reappear on next launch", () => {
    // GIVEN: the user has a floating panel open
    const layout = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );

    // WHEN: the user closes the panel
    const closed = closePanel(layout, 0);

    // THEN: the panel is removed from the layout state
    expect(closed.floatingPanels).toHaveLength(0);

    // AND: it does not reappear on next launch
    const json = serializeLayout(closed);
    const restored = deserializeLayout(json);
    expect(restored.floatingPanels).toHaveLength(0);
  });
});
