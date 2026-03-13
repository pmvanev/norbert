/**
 * Layout engine algebraic data types.
 *
 * All types are readonly and immutable. State changes produce new values.
 * Zone registry uses a keyed Map for count-agnostic zone management.
 */

// ---------------------------------------------------------------------------
// ZoneState — represents the content assigned to a single zone
// ---------------------------------------------------------------------------

export type ZoneState = {
  readonly viewId: string | null;
  readonly pluginId: string | null;
};

// ---------------------------------------------------------------------------
// ZoneRegistry — keyed map of zone names to zone states
// ---------------------------------------------------------------------------

export type ZoneRegistry = ReadonlyMap<string, ZoneState>;

// ---------------------------------------------------------------------------
// FloatingPanelState — a detached panel with position and size
// ---------------------------------------------------------------------------

export type Position = {
  readonly x: number;
  readonly y: number;
};

export type Size = {
  readonly width: number;
  readonly height: number;
};

export type FloatingPanelState = {
  readonly viewId: string;
  readonly pluginId: string;
  readonly position: Position;
  readonly size: Size;
  readonly minimized: boolean;
  readonly floatMetric: string | null;
};

// ---------------------------------------------------------------------------
// PresetState — a named layout configuration snapshot
// ---------------------------------------------------------------------------

export type PresetState = {
  readonly name: string;
  readonly zones: ZoneRegistry;
  readonly floatingPanels: readonly FloatingPanelState[];
  readonly dividerPosition: number;
  readonly isBuiltIn: boolean;
};

// ---------------------------------------------------------------------------
// LayoutState — the composed top-level layout state
// ---------------------------------------------------------------------------

export type LayoutState = {
  readonly zones: ZoneRegistry;
  readonly floatingPanels: readonly FloatingPanelState[];
  readonly dividerPosition: number;
  readonly activePreset: string;
};
