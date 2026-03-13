/**
 * Preset Manager -- pure functions for named layout preset management.
 *
 * Pure core: createPreset, applyPreset, renamePreset, deletePreset,
 *            getDefaultPreset, resetToDefault, saveCopyOfPreset
 *
 * All functions are pure and return new values. No side effects.
 * Built-in presets are immutable (cannot be renamed or deleted).
 */

import type { LayoutState, PresetState } from "./types";
import { createZoneRegistry } from "./zoneRegistry";

// ---------------------------------------------------------------------------
// getDefaultPreset -- the single built-in preset
// ---------------------------------------------------------------------------

/**
 * Returns the built-in "Default" preset: single Main zone, no floating panels,
 * divider at center (0.5).
 */
export const getDefaultPreset = (): PresetState => ({
  name: "Default",
  zones: createZoneRegistry(),
  floatingPanels: [],
  dividerPosition: 0.5,
  isBuiltIn: true,
});

// ---------------------------------------------------------------------------
// createPreset -- snapshot current layout as a named custom preset
// ---------------------------------------------------------------------------

/**
 * Creates a new custom (non-built-in) preset from the current layout state.
 * Captures zones, floating panels, and divider position.
 */
export const createPreset = (name: string, layout: LayoutState): PresetState => ({
  name,
  zones: layout.zones,
  floatingPanels: layout.floatingPanels,
  dividerPosition: layout.dividerPosition,
  isBuiltIn: false,
});

// ---------------------------------------------------------------------------
// applyPreset -- convert a preset back into a LayoutState
// ---------------------------------------------------------------------------

/**
 * Applies a preset, producing a LayoutState with activePreset set to the
 * preset's name.
 */
export const applyPreset = (preset: PresetState): LayoutState => ({
  zones: preset.zones,
  floatingPanels: preset.floatingPanels,
  dividerPosition: preset.dividerPosition,
  activePreset: preset.name,
});

// ---------------------------------------------------------------------------
// resetToDefault -- apply the default preset
// ---------------------------------------------------------------------------

/**
 * Resets to the default layout: single Main zone, no floating panels,
 * divider at center.
 */
export const resetToDefault = (): LayoutState => applyPreset(getDefaultPreset());

// ---------------------------------------------------------------------------
// saveCopyOfPreset -- create a custom copy of any preset
// ---------------------------------------------------------------------------

/**
 * Creates a custom (non-built-in) copy of a preset with a new name.
 * Used for "Save Copy As..." on built-in presets.
 */
export const saveCopyOfPreset = (
  source: PresetState,
  newName: string
): PresetState => ({
  ...source,
  name: newName,
  isBuiltIn: false,
});

// ---------------------------------------------------------------------------
// renamePreset -- rename a custom preset in a list
// ---------------------------------------------------------------------------

/**
 * Renames the preset at the given index. Built-in presets and out-of-bounds
 * indices are silently ignored (list returned unchanged).
 */
export const renamePreset = (
  presets: readonly PresetState[],
  index: number,
  newName: string
): readonly PresetState[] => {
  if (index < 0 || index >= presets.length) {
    return presets;
  }
  const target = presets[index];
  if (target.isBuiltIn) {
    return presets;
  }
  return presets.map((preset, i) =>
    i === index ? { ...preset, name: newName } : preset
  );
};

// ---------------------------------------------------------------------------
// deletePreset -- remove a custom preset from a list
// ---------------------------------------------------------------------------

/**
 * Deletes the preset at the given index. Built-in presets and out-of-bounds
 * indices are silently ignored (list returned unchanged).
 */
export const deletePreset = (
  presets: readonly PresetState[],
  index: number
): readonly PresetState[] => {
  if (index < 0 || index >= presets.length) {
    return presets;
  }
  if (presets[index].isBuiltIn) {
    return presets;
  }
  return presets.filter((_, i) => i !== index);
};
