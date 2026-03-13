/**
 * Drag and Drop — types and helpers for view assignment via drag-drop.
 *
 * The pure assignment logic lives in assignmentEngine.ts.
 * This module provides the drag/drop data types and validation
 * used by React components at the UI boundary.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Data transferred during a drag operation from the sidebar.
 */
export type DragPayload = {
  readonly viewId: string;
  readonly pluginId: string;
};

/**
 * Result of evaluating a drop target.
 */
export type DropTarget =
  | { readonly kind: "zone"; readonly zoneName: string }
  | { readonly kind: "invalid" };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Creates a drag payload for a sidebar view icon.
 */
export const createDragPayload = (
  viewId: string,
  pluginId: string
): DragPayload => ({
  viewId,
  pluginId,
});

/**
 * Evaluates whether a drop target is a valid zone.
 * Returns a DropTarget discriminated union.
 */
export const evaluateDropTarget = (
  zoneNames: readonly string[],
  targetName: string | null
): DropTarget => {
  if (targetName !== null && zoneNames.includes(targetName)) {
    return { kind: "zone", zoneName: targetName };
  }
  return { kind: "invalid" };
};

/**
 * Generates the branded overlay label for a drop target zone.
 */
export const dropOverlayLabel = (zoneName: string): string =>
  `Assign to ${zoneName}`;
