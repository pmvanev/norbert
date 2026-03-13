/**
 * Layout Persistor -- pure functions for layout serialization and validation.
 *
 * Pure core: serializeLayout, deserializeLayout, validateViewIds
 * Effect boundary (not in this module): file I/O, debounced auto-save
 *
 * Map<string, ZoneState> requires special handling for JSON serialization
 * since JSON.stringify does not serialize Maps. We convert to/from
 * array-of-entries format.
 */

import type { LayoutState, ZoneState, FloatingPanelState } from "./types";
import type { MultiWindowState } from "../multiWindow/windowStateManager";

// ---------------------------------------------------------------------------
// Serialization DTO -- flat JSON-friendly shape
// ---------------------------------------------------------------------------

type ZoneEntryDto = readonly [string, ZoneState];

type LayoutDto = {
  readonly zones: readonly ZoneEntryDto[];
  readonly floatingPanels: readonly FloatingPanelState[];
  readonly dividerPosition: number;
  readonly activePreset: string;
};

// ---------------------------------------------------------------------------
// serializeLayout — LayoutState -> JSON string
// ---------------------------------------------------------------------------

const layoutToDto = (layout: LayoutState): LayoutDto => ({
  zones: [...layout.zones.entries()],
  floatingPanels: layout.floatingPanels,
  dividerPosition: layout.dividerPosition,
  activePreset: layout.activePreset,
});

/**
 * Serializes a LayoutState to a JSON string.
 * Converts the zones Map to an array of [name, state] entries for JSON compatibility.
 */
export const serializeLayout = (layout: LayoutState): string =>
  JSON.stringify(layoutToDto(layout));

// ---------------------------------------------------------------------------
// deserializeLayout — JSON string -> LayoutState
// ---------------------------------------------------------------------------

const dtoToLayout = (dto: LayoutDto): LayoutState => ({
  zones: new Map(dto.zones),
  floatingPanels: dto.floatingPanels,
  dividerPosition: dto.dividerPosition,
  activePreset: dto.activePreset,
});

/**
 * Deserializes a JSON string to a LayoutState.
 * Restores zones from array-of-entries back to a Map.
 * Returns a default empty layout if the JSON is malformed.
 */
export const deserializeLayout = (json: string): LayoutState => {
  try {
    return dtoToLayout(JSON.parse(json) as LayoutDto);
  } catch {
    return {
      zones: new Map(),
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "Default",
    };
  }
};

// ---------------------------------------------------------------------------
// validateViewIds — replace invalid view IDs with graceful empty state
// ---------------------------------------------------------------------------

const validateZoneEntry = (
  availableViewIds: ReadonlySet<string>,
  [name, zone]: readonly [string, ZoneState]
): readonly [string, ZoneState] => {
  if (zone.viewId === null || availableViewIds.has(zone.viewId)) {
    return [name, zone];
  }
  return [name, { viewId: null, pluginId: null }];
};

// ---------------------------------------------------------------------------
// Window set serialization -- windows.json for restart restore
// ---------------------------------------------------------------------------

/// DTO for a window entry in the persisted window set.
type WindowEntryDto = {
  readonly windowId: string;
  readonly label: string;
};

/**
 * Serializes the current window set to a JSON string (windows.json).
 * Captures window IDs and labels for restart restore.
 * Layout data is persisted separately as layout-{windowId}.json.
 */
export const serializeWindowSet = (state: MultiWindowState): string =>
  JSON.stringify(
    state.windows.map((w) => ({
      windowId: w.windowId,
      label: w.label,
    }))
  );

/**
 * Deserializes a JSON string to an array of window entries.
 * Returns the window IDs and labels needed to restore windows on restart.
 * Returns an empty array if the JSON is malformed.
 */
export const deserializeWindowSet = (json: string): readonly WindowEntryDto[] => {
  try {
    return JSON.parse(json) as readonly WindowEntryDto[];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// validateViewIds — replace invalid view IDs with graceful empty state
// ---------------------------------------------------------------------------

/**
 * Validates all view IDs in a LayoutState against available views.
 * Zones referencing uninstalled/unavailable views get null viewId and pluginId.
 * Does not modify divider position, active preset, or floating panels.
 */
export const validateViewIds = (
  layout: LayoutState,
  availableViewIds: ReadonlySet<string>
): LayoutState => {
  const validatedEntries = [...layout.zones.entries()].map((entry) =>
    validateZoneEntry(availableViewIds, entry)
  );
  return {
    ...layout,
    zones: new Map(validatedEntries),
  };
};
