/**
 * Floating Panel Manager — pure functions for floating panel lifecycle.
 *
 * All operations are immutable: they return new LayoutState values.
 * Panel operations: open, close, minimize, restore, move, resize, snap.
 *
 * No IO or side effects. React components live in separate files.
 */

import type {
  LayoutState,
  FloatingPanelState,
  Position,
  Size,
} from "./types";

// ---------------------------------------------------------------------------
// Helper: update a single panel by index, returning unchanged layout for
// out-of-bounds indices.
// ---------------------------------------------------------------------------

const updatePanelAt = (
  layout: LayoutState,
  panelIndex: number,
  updater: (panel: FloatingPanelState) => FloatingPanelState
): LayoutState => {
  if (panelIndex < 0 || panelIndex >= layout.floatingPanels.length) {
    return layout;
  }
  const updatedPanels = layout.floatingPanels.map((panel, index) =>
    index === panelIndex ? updater(panel) : panel
  );
  return { ...layout, floatingPanels: updatedPanels };
};

// ---------------------------------------------------------------------------
// openPanel — add a new floating panel to the layout
// ---------------------------------------------------------------------------

/**
 * Opens a new floating panel with the given view, position, and size.
 * The panel starts non-minimized with no float metric.
 */
export const openPanel = (
  layout: LayoutState,
  viewId: string,
  pluginId: string,
  position: Position,
  size: Size
): LayoutState => {
  const newPanel: FloatingPanelState = {
    viewId,
    pluginId,
    position,
    size,
    minimized: false,
    floatMetric: null,
  };
  return {
    ...layout,
    floatingPanels: [...layout.floatingPanels, newPanel],
  };
};

// ---------------------------------------------------------------------------
// closePanel — remove a floating panel by index
// ---------------------------------------------------------------------------

/**
 * Closes (removes) the floating panel at the given index.
 * Returns layout unchanged if the index is out of bounds.
 */
export const closePanel = (
  layout: LayoutState,
  panelIndex: number
): LayoutState => {
  if (panelIndex < 0 || panelIndex >= layout.floatingPanels.length) {
    return layout;
  }
  const updatedPanels = layout.floatingPanels.filter(
    (_, index) => index !== panelIndex
  );
  return { ...layout, floatingPanels: updatedPanels };
};

// ---------------------------------------------------------------------------
// minimizePanel — collapse a panel to pill state
// ---------------------------------------------------------------------------

/**
 * Minimizes a floating panel (sets minimized to true).
 * Position and size are preserved for later restore.
 * Returns layout unchanged if the index is out of bounds.
 */
export const minimizePanel = (
  layout: LayoutState,
  panelIndex: number
): LayoutState =>
  updatePanelAt(layout, panelIndex, (panel) => ({
    ...panel,
    minimized: true,
  }));

// ---------------------------------------------------------------------------
// restorePanel — expand a minimized panel back to its previous state
// ---------------------------------------------------------------------------

/**
 * Restores a minimized floating panel (sets minimized to false).
 * The panel returns to its pre-minimize position and size.
 * Returns layout unchanged if the index is out of bounds.
 */
export const restorePanel = (
  layout: LayoutState,
  panelIndex: number
): LayoutState =>
  updatePanelAt(layout, panelIndex, (panel) => ({
    ...panel,
    minimized: false,
  }));

// ---------------------------------------------------------------------------
// movePanel — reposition a floating panel
// ---------------------------------------------------------------------------

/**
 * Moves a floating panel to a new position.
 * Returns layout unchanged if the index is out of bounds.
 */
export const movePanel = (
  layout: LayoutState,
  panelIndex: number,
  position: Position
): LayoutState =>
  updatePanelAt(layout, panelIndex, (panel) => ({
    ...panel,
    position,
  }));

// ---------------------------------------------------------------------------
// resizePanel — change panel dimensions
// ---------------------------------------------------------------------------

/**
 * Resizes a floating panel to a new size.
 * Returns layout unchanged if the index is out of bounds.
 */
export const resizePanel = (
  layout: LayoutState,
  panelIndex: number,
  size: Size
): LayoutState =>
  updatePanelAt(layout, panelIndex, (panel) => ({
    ...panel,
    size,
  }));

// ---------------------------------------------------------------------------
// snapToEdge — snap panel position to window edge if within snap distance
// ---------------------------------------------------------------------------

const DEFAULT_SNAP_DISTANCE = 20;

/**
 * Snaps a panel position to the nearest window edge(s) if within
 * snapDistance pixels. Each axis is snapped independently.
 *
 * Pure function: takes current position, panel size, window size,
 * and returns the (possibly snapped) position.
 */
export const snapToEdge = (
  position: Position,
  panelSize: Size,
  windowSize: Size,
  snapDistance: number = DEFAULT_SNAP_DISTANCE
): Position => {
  const snappedX = snapAxis(
    position.x,
    panelSize.width,
    windowSize.width,
    snapDistance
  );
  const snappedY = snapAxis(
    position.y,
    panelSize.height,
    windowSize.height,
    snapDistance
  );
  return { x: snappedX, y: snappedY };
};

/**
 * Snaps a single axis: if the panel's leading edge is within snapDistance
 * of 0, snap to 0. If the panel's trailing edge is within snapDistance
 * of the window extent, snap so trailing edge touches the extent.
 */
const snapAxis = (
  position: number,
  panelExtent: number,
  windowExtent: number,
  snapDistance: number
): number => {
  // Snap to leading edge (left/top)
  if (position >= 0 && position <= snapDistance) {
    return 0;
  }
  // Snap to trailing edge (right/bottom)
  const trailingEdge = position + panelExtent;
  const distanceFromTrailing = windowExtent - trailingEdge;
  if (distanceFromTrailing >= 0 && distanceFromTrailing <= snapDistance) {
    return windowExtent - panelExtent;
  }
  return position;
};
