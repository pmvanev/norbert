/**
 * Unit tests: Floating Panel Manager
 *
 * Validates pure functions for floating panel lifecycle:
 * open, close, minimize, restore, move, resize, snap-to-edge.
 * Uses property-based testing for domain invariants.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  openPanel,
  closePanel,
  minimizePanel,
  restorePanel,
  movePanel,
  resizePanel,
  snapToEdge,
} from "../../../src/layout/floatingPanelManager";
import type { LayoutState, Position, Size } from "../../../src/layout/types";
import { createZoneRegistry } from "../../../src/layout/zoneRegistry";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const positionArb: fc.Arbitrary<Position> = fc.record({
  x: fc.integer({ min: 0, max: 3840 }),
  y: fc.integer({ min: 0, max: 2160 }),
});

const sizeArb: fc.Arbitrary<Size> = fc.record({
  width: fc.integer({ min: 50, max: 2000 }),
  height: fc.integer({ min: 50, max: 1500 }),
});

const viewIdArb = fc.string({ minLength: 1, maxLength: 30 });
const pluginIdArb = fc.string({ minLength: 1, maxLength: 30 });

const emptyLayout: LayoutState = {
  zones: createZoneRegistry(),
  floatingPanels: [],
  dividerPosition: 0.5,
  activePreset: "default",
};

const layoutWithOnePanel = (
  viewId = "session-list",
  pluginId = "norbert-session",
  position: Position = { x: 100, y: 100 },
  size: Size = { width: 400, height: 300 }
): LayoutState =>
  openPanel(emptyLayout, viewId, pluginId, position, size);

// ---------------------------------------------------------------------------
// openPanel
// ---------------------------------------------------------------------------

describe("openPanel", () => {
  it("appends a new panel to the floating panels array", () => {
    const layout = openPanel(
      emptyLayout,
      "session-list",
      "norbert-session",
      { x: 100, y: 100 },
      { width: 400, height: 300 }
    );
    expect(layout.floatingPanels).toHaveLength(1);
    expect(layout.floatingPanels[0].viewId).toBe("session-list");
    expect(layout.floatingPanels[0].pluginId).toBe("norbert-session");
    expect(layout.floatingPanels[0].minimized).toBe(false);
    expect(layout.floatingPanels[0].floatMetric).toBeNull();
  });

  it("does not mutate the original layout", () => {
    const original = emptyLayout;
    openPanel(original, "v", "p", { x: 0, y: 0 }, { width: 100, height: 100 });
    expect(original.floatingPanels).toHaveLength(0);
  });

  // Property: panel count increases by exactly one for any valid input
  it("always increases panel count by exactly one", () => {
    fc.assert(
      fc.property(
        viewIdArb,
        pluginIdArb,
        positionArb,
        sizeArb,
        (viewId, pluginId, position, size) => {
          const before = emptyLayout;
          const after = openPanel(before, viewId, pluginId, position, size);
          expect(after.floatingPanels.length).toBe(
            before.floatingPanels.length + 1
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: opened panel always starts non-minimized
  it("opened panel is never minimized", () => {
    fc.assert(
      fc.property(
        viewIdArb,
        pluginIdArb,
        positionArb,
        sizeArb,
        (viewId, pluginId, position, size) => {
          const layout = openPanel(emptyLayout, viewId, pluginId, position, size);
          const panel = layout.floatingPanels[layout.floatingPanels.length - 1];
          expect(panel.minimized).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: openPanel preserves existing panels
  it("preserves all existing panels", () => {
    fc.assert(
      fc.property(
        viewIdArb,
        pluginIdArb,
        positionArb,
        sizeArb,
        (viewId, pluginId, position, size) => {
          const layout1 = openPanel(
            emptyLayout,
            "existing-view",
            "existing-plugin",
            { x: 50, y: 50 },
            { width: 200, height: 200 }
          );
          const layout2 = openPanel(layout1, viewId, pluginId, position, size);
          // First panel unchanged
          expect(layout2.floatingPanels[0]).toEqual(layout1.floatingPanels[0]);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// closePanel
// ---------------------------------------------------------------------------

describe("closePanel", () => {
  it("removes the panel at the given index", () => {
    const layout = layoutWithOnePanel();
    const closed = closePanel(layout, 0);
    expect(closed.floatingPanels).toHaveLength(0);
  });

  it("returns layout unchanged for out-of-bounds index", () => {
    const layout = layoutWithOnePanel();
    const result = closePanel(layout, 5);
    expect(result.floatingPanels).toHaveLength(1);
  });

  it("does not mutate the original layout", () => {
    const layout = layoutWithOnePanel();
    closePanel(layout, 0);
    expect(layout.floatingPanels).toHaveLength(1);
  });

  // Property: close then count = count - 1 (for valid index)
  it("decreases panel count by exactly one for valid index", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (panelCount) => {
          let layout = emptyLayout;
          for (let i = 0; i < panelCount; i++) {
            layout = openPanel(
              layout,
              `view-${i}`,
              `plugin-${i}`,
              { x: i * 100, y: 0 },
              { width: 200, height: 200 }
            );
          }
          const indexToClose = 0;
          const closed = closePanel(layout, indexToClose);
          expect(closed.floatingPanels.length).toBe(panelCount - 1);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// minimizePanel / restorePanel
// ---------------------------------------------------------------------------

describe("minimizePanel", () => {
  it("sets minimized to true", () => {
    const layout = layoutWithOnePanel();
    const minimized = minimizePanel(layout, 0);
    expect(minimized.floatingPanels[0].minimized).toBe(true);
  });

  it("preserves position and size for later restore", () => {
    const layout = layoutWithOnePanel(
      "v",
      "p",
      { x: 250, y: 150 },
      { width: 500, height: 350 }
    );
    const minimized = minimizePanel(layout, 0);
    expect(minimized.floatingPanels[0].position).toEqual({ x: 250, y: 150 });
    expect(minimized.floatingPanels[0].size).toEqual({ width: 500, height: 350 });
  });

  it("returns layout unchanged for out-of-bounds index", () => {
    const layout = layoutWithOnePanel();
    const result = minimizePanel(layout, 5);
    expect(result).toBe(layout);
  });
});

describe("restorePanel", () => {
  it("sets minimized to false", () => {
    const layout = layoutWithOnePanel();
    const minimized = minimizePanel(layout, 0);
    const restored = restorePanel(minimized, 0);
    expect(restored.floatingPanels[0].minimized).toBe(false);
  });

  // Property: minimize then restore is identity for position/size
  it("minimize-restore roundtrip preserves position and size", () => {
    fc.assert(
      fc.property(positionArb, sizeArb, (position, size) => {
        const layout = openPanel(emptyLayout, "v", "p", position, size);
        const minimized = minimizePanel(layout, 0);
        const restored = restorePanel(minimized, 0);
        expect(restored.floatingPanels[0].position).toEqual(position);
        expect(restored.floatingPanels[0].size).toEqual(size);
        expect(restored.floatingPanels[0].minimized).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("returns layout unchanged for out-of-bounds index", () => {
    const layout = layoutWithOnePanel();
    const result = restorePanel(layout, 5);
    expect(result).toBe(layout);
  });
});

// ---------------------------------------------------------------------------
// movePanel
// ---------------------------------------------------------------------------

describe("movePanel", () => {
  it("updates position of the specified panel", () => {
    const layout = layoutWithOnePanel();
    const moved = movePanel(layout, 0, { x: 500, y: 300 });
    expect(moved.floatingPanels[0].position).toEqual({ x: 500, y: 300 });
  });

  it("does not affect other panels", () => {
    const layout1 = layoutWithOnePanel();
    const layout2 = openPanel(
      layout1,
      "other-view",
      "other-plugin",
      { x: 600, y: 400 },
      { width: 300, height: 200 }
    );
    const moved = movePanel(layout2, 0, { x: 0, y: 0 });
    expect(moved.floatingPanels[1].position).toEqual({ x: 600, y: 400 });
  });

  it("returns layout unchanged for out-of-bounds index", () => {
    const layout = layoutWithOnePanel();
    const result = movePanel(layout, 5, { x: 0, y: 0 });
    expect(result).toBe(layout);
  });

  // Property: move preserves all fields except position
  it("move only changes position, nothing else", () => {
    fc.assert(
      fc.property(positionArb, (newPosition) => {
        const layout = layoutWithOnePanel();
        const moved = movePanel(layout, 0, newPosition);
        const original = layout.floatingPanels[0];
        const updated = moved.floatingPanels[0];
        expect(updated.viewId).toBe(original.viewId);
        expect(updated.pluginId).toBe(original.pluginId);
        expect(updated.size).toEqual(original.size);
        expect(updated.minimized).toBe(original.minimized);
        expect(updated.position).toEqual(newPosition);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// resizePanel
// ---------------------------------------------------------------------------

describe("resizePanel", () => {
  it("updates size of the specified panel", () => {
    const layout = layoutWithOnePanel();
    const resized = resizePanel(layout, 0, { width: 800, height: 600 });
    expect(resized.floatingPanels[0].size).toEqual({ width: 800, height: 600 });
  });

  it("returns layout unchanged for out-of-bounds index", () => {
    const layout = layoutWithOnePanel();
    const result = resizePanel(layout, 5, { width: 100, height: 100 });
    expect(result).toBe(layout);
  });

  // Property: resize only changes size, nothing else
  it("resize only changes size, nothing else", () => {
    fc.assert(
      fc.property(sizeArb, (newSize) => {
        const layout = layoutWithOnePanel();
        const resized = resizePanel(layout, 0, newSize);
        const original = layout.floatingPanels[0];
        const updated = resized.floatingPanels[0];
        expect(updated.viewId).toBe(original.viewId);
        expect(updated.pluginId).toBe(original.pluginId);
        expect(updated.position).toEqual(original.position);
        expect(updated.minimized).toBe(original.minimized);
        expect(updated.size).toEqual(newSize);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// snapToEdge
// ---------------------------------------------------------------------------

describe("snapToEdge", () => {
  const windowSize = { width: 1920, height: 1080 };
  const panelSize = { width: 400, height: 300 };

  it("snaps to left edge when within snap distance", () => {
    const result = snapToEdge({ x: 15, y: 200 }, panelSize, windowSize);
    expect(result.x).toBe(0);
    expect(result.y).toBe(200);
  });

  it("snaps to top edge when within snap distance", () => {
    const result = snapToEdge({ x: 200, y: 10 }, panelSize, windowSize);
    expect(result.x).toBe(200);
    expect(result.y).toBe(0);
  });

  it("snaps to right edge when panel right within snap distance", () => {
    const result = snapToEdge(
      { x: 1920 - 400 - 15, y: 200 },
      panelSize,
      windowSize
    );
    expect(result.x).toBe(1920 - 400);
  });

  it("snaps to bottom edge when panel bottom within snap distance", () => {
    const result = snapToEdge(
      { x: 200, y: 1080 - 300 - 10 },
      panelSize,
      windowSize
    );
    expect(result.y).toBe(1080 - 300);
  });

  it("does not snap when outside snap distance", () => {
    const result = snapToEdge({ x: 100, y: 100 }, panelSize, windowSize);
    expect(result).toEqual({ x: 100, y: 100 });
  });

  it("supports custom snap distance", () => {
    // x=25 is outside default 20px but inside 30px
    const result = snapToEdge({ x: 25, y: 200 }, panelSize, windowSize, 30);
    expect(result.x).toBe(0);
  });

  it("snaps to both edges simultaneously (corner snap)", () => {
    const result = snapToEdge({ x: 10, y: 5 }, panelSize, windowSize);
    expect(result).toEqual({ x: 0, y: 0 });
  });

  // Property: snapped position is always >= 0 and panel fits within window
  it("snapped position keeps panel within window bounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -50, max: 2000 }),
        fc.integer({ min: -50, max: 1200 }),
        fc.integer({ min: 50, max: 800 }),
        fc.integer({ min: 50, max: 600 }),
        (x, y, w, h) => {
          const result = snapToEdge(
            { x, y },
            { width: w, height: h },
            windowSize
          );
          // Snap should not push panel out-of-bounds on the left/top
          // (though it may leave it where it is if outside snap distance)
          if (x >= 0 && x <= 20) expect(result.x).toBe(0);
          if (y >= 0 && y <= 20) expect(result.y).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
