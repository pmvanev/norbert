/// Sidebar Persistor — serialization and deserialization of sidebar state.
///
/// Pure functions for converting SidebarState to/from JSON strings.
/// Actual file I/O (reading/writing sidebar.json) is an adapter concern
/// that lives at the application boundary, not in this module.

import type { SidebarState, SidebarItem } from "./types";

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/// Converts a SidebarState to a JSON string for persistence.
export const serializeSidebarState = (state: SidebarState): string =>
  JSON.stringify(state, null, 2);

// ---------------------------------------------------------------------------
// Deserialization
// ---------------------------------------------------------------------------

/// Restores a SidebarState from a JSON string.
/// The JSON is expected to match the SidebarState shape.
/// Returns null if the JSON is malformed, so callers fall back to defaults.
export const deserializeSidebarState = (json: string): SidebarState | null => {
  try {
    const parsed = JSON.parse(json) as { items: SidebarItem[] };
    return {
      items: parsed.items.map((item) => ({
        id: item.id,
        pluginId: item.pluginId,
        label: item.label,
        icon: item.icon,
        visible: item.visible,
        pinned: item.pinned,
        order: item.order,
      })),
    };
  } catch {
    return null;
  }
};
