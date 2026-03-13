/**
 * View Picker — pure functions for building searchable view lists.
 *
 * Groups registered views by plugin for display in a command-palette
 * style picker. All functions are pure; React component is separate.
 */

import type { PluginRegistry, ViewRegistration } from "../plugins/types";
import { getAllViews } from "../plugins/pluginRegistry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A group of views belonging to the same plugin, for picker display.
 */
export type ViewPickerGroup = {
  readonly pluginId: string;
  readonly views: readonly ViewRegistration[];
};

// ---------------------------------------------------------------------------
// buildViewPickerGroups
// ---------------------------------------------------------------------------

/**
 * Groups all registered views by their pluginId.
 *
 * Returns an array of ViewPickerGroup, one per plugin that has
 * at least one registered view. Order follows first-seen plugin.
 */
export const buildViewPickerGroups = (
  registry: PluginRegistry
): readonly ViewPickerGroup[] => {
  const views = getAllViews(registry);

  const groupMap = new Map<string, ViewRegistration[]>();
  for (const view of views) {
    const existing = groupMap.get(view.pluginId);
    if (existing) {
      existing.push(view);
    } else {
      groupMap.set(view.pluginId, [view]);
    }
  }

  return [...groupMap.entries()].map(([pluginId, pluginViews]) => ({
    pluginId,
    views: pluginViews,
  }));
};
