/**
 * Context Menu — pure functions for generating zone assignment menu items.
 *
 * Menu items are dynamically generated from the zone registry,
 * never hardcoded. Each item carries the data needed to call assignView.
 */

import type { LayoutState } from "./types";
import { listZoneNames } from "./zoneRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A context menu item representing an "assign view to zone" action.
 */
export type ContextMenuItem = {
  readonly label: string;
  readonly zoneName: string;
  readonly viewId: string;
  readonly pluginId: string;
};

// ---------------------------------------------------------------------------
// generateContextMenuItems
// ---------------------------------------------------------------------------

/**
 * Generates context menu items for assigning a view to any available zone.
 *
 * One item per zone in the registry. Labels are derived from zone names.
 * The resulting items carry all data needed to call assignView.
 */
export const generateContextMenuItems = (
  layout: LayoutState,
  viewId: string,
  pluginId: string
): readonly ContextMenuItem[] =>
  listZoneNames(layout.zones).map((zoneName) => ({
    label: `Open in ${zoneName}`,
    zoneName,
    viewId,
    pluginId,
  }));
