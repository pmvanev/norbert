/**
 * Layout Picker -- pure functions for preset list filtering and display.
 *
 * Provides searchable preset lists for the Layout Picker UI (Ctrl+Shift+L).
 * All functions are pure; React component integration is separate.
 */

import type { PresetState } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A categorized group of presets for picker display.
 */
export type PresetPickerGroup = {
  readonly label: string;
  readonly presets: readonly PresetState[];
};

// ---------------------------------------------------------------------------
// filterPresets -- search presets by name
// ---------------------------------------------------------------------------

/**
 * Filters presets by name (case-insensitive substring match).
 * Returns all presets when query is empty.
 */
export const filterPresets = (
  presets: readonly PresetState[],
  query: string
): readonly PresetState[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery === "") {
    return presets;
  }
  return presets.filter((preset) =>
    preset.name.toLowerCase().includes(normalizedQuery)
  );
};

// ---------------------------------------------------------------------------
// groupPresetsByCategory -- split into built-in and custom groups
// ---------------------------------------------------------------------------

/**
 * Groups presets into "Built-in" and "Custom" categories for display.
 * Empty groups are omitted.
 */
export const groupPresetsByCategory = (
  presets: readonly PresetState[]
): readonly PresetPickerGroup[] => {
  const builtIn = presets.filter((p) => p.isBuiltIn);
  const custom = presets.filter((p) => !p.isBuiltIn);

  const groups: PresetPickerGroup[] = [];
  if (builtIn.length > 0) {
    groups.push({ label: "Built-in", presets: builtIn });
  }
  if (custom.length > 0) {
    groups.push({ label: "Custom", presets: custom });
  }
  return groups;
};
