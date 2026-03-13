/**
 * Zone Toggle — pure functions for toggling the Secondary zone.
 *
 * Manages show/hide of the Secondary zone with memory of the last-used
 * view for restoration. All functions are pure and return new state.
 *
 * The last-used secondary view is stored in the LayoutState via a
 * convention: when hiding, we remember the view; when showing, we restore it.
 * Memory is carried as an extra property on the returned object.
 */

import type { LayoutState, ZoneState } from "./types";
import { createZoneRegistry, getZone, addZone, removeZone } from "./zoneRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Extended layout state that carries memory of the last secondary zone view.
 * Compatible with LayoutState (superset).
 */
export type TwoZoneLayoutState = LayoutState & {
  readonly lastSecondaryView: ZoneState | null;
};

// ---------------------------------------------------------------------------
// createDefaultLayoutState — first launch state
// ---------------------------------------------------------------------------

/**
 * Creates the default layout state for first launch:
 * Main zone with null view, no Secondary, divider at 50%.
 */
export const createDefaultLayoutState = (): TwoZoneLayoutState => ({
  zones: createZoneRegistry(),
  floatingPanels: [],
  dividerPosition: 0.5,
  activePreset: "default",
  lastSecondaryView: null,
});

// ---------------------------------------------------------------------------
// isSecondaryVisible — check if secondary zone exists
// ---------------------------------------------------------------------------

/**
 * Returns true if the secondary zone is present in the layout.
 */
export const isSecondaryVisible = (layout: LayoutState): boolean =>
  getZone(layout.zones, "secondary") !== undefined;

// ---------------------------------------------------------------------------
// toggleSecondaryZone — show/hide with view memory
// ---------------------------------------------------------------------------

const emptySecondaryZone: ZoneState = { viewId: null, pluginId: null };

/**
 * Toggles the Secondary zone:
 * - If hidden: shows it, restoring the last-used view (or empty if none)
 * - If visible: hides it, remembering the current view for later restore
 */
export const toggleSecondaryZone = (
  layout: TwoZoneLayoutState
): TwoZoneLayoutState => {
  const secondaryZone = getZone(layout.zones, "secondary");

  if (secondaryZone !== undefined) {
    // Currently visible -> hide, remember the view
    return {
      ...layout,
      zones: removeZone(layout.zones, "secondary"),
      lastSecondaryView: secondaryZone,
    };
  }

  // Currently hidden -> show, restore last-used view or empty
  const viewToRestore = layout.lastSecondaryView ?? emptySecondaryZone;
  return {
    ...layout,
    zones: addZone(layout.zones, "secondary", viewToRestore),
  };
};
