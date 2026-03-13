/**
 * Assignment Engine — pure function for assigning views to zones.
 *
 * All four assignment mechanisms (context menu, drag-drop, picker, preset)
 * funnel through this single pure function, guaranteeing identical state
 * for the same inputs regardless of trigger mechanism.
 *
 * assignView is the sole driving port for view assignment.
 */

import type { LayoutState } from "./types";
import { setZoneView } from "./zoneRegistry";

/**
 * Assigns a view to a named zone, producing a new LayoutState.
 *
 * If the zone does not exist in the registry, returns the layout unchanged.
 * If the zone already has a view, the previous occupant is replaced.
 * Unregistered viewIds are stored as-is (renderer shows empty state).
 */
export const assignView = (
  layout: LayoutState,
  zoneName: string,
  viewId: string,
  pluginId: string
): LayoutState => {
  const updatedZones = setZoneView(layout.zones, zoneName, viewId, pluginId);

  // setZoneView returns unchanged registry when zone does not exist
  if (updatedZones === layout.zones) {
    return layout;
  }

  return {
    ...layout,
    zones: updatedZones,
  };
};
