/// Sidebar Manager — pure functions for sidebar state management.
///
/// All functions are pure: no side effects, no IO.
/// State changes produce new SidebarState values.
/// Persistence is handled by sidebarPersistor (effect boundary).

import type { ViewRegistration } from "../plugins/types";
import type { SidebarItem, SidebarState } from "./types";

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/// Creates a SidebarItem from a ViewRegistration.
const createSidebarItem = (
  view: ViewRegistration,
  order: number,
  bottomPinnedIds: readonly string[]
): SidebarItem => ({
  id: view.id,
  pluginId: view.pluginId,
  label: view.label,
  icon: view.icon,
  visible: true,
  pinned: bottomPinnedIds.includes(view.id) ? "bottom" : "none",
  order,
});

/// Creates the default sidebar state from a set of view registrations.
/// All items are visible. Bottom-pinned items are marked accordingly.
/// Order follows the input array order.
export const createDefaultSidebarState = (
  views: readonly ViewRegistration[],
  bottomPinnedIds: readonly string[]
): SidebarState => ({
  items: views.map((view, index) => createSidebarItem(view, index, bottomPinnedIds)),
});

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

/// Toggles the visibility of a sidebar item by id.
/// Returns a new state with the item's visible flag flipped.
export const toggleVisibility = (
  state: SidebarState,
  itemId: string
): SidebarState => ({
  items: state.items.map((item) =>
    item.id === itemId ? { ...item, visible: !item.visible } : item
  ),
});

// ---------------------------------------------------------------------------
// Reorder
// ---------------------------------------------------------------------------

/// Reorders an unpinned item to a new index among unpinned items.
/// Pinned items always remain at the bottom in their original relative order.
/// The newIndex refers to position among unpinned items only.
export const reorderItem = (
  state: SidebarState,
  itemId: string,
  newIndex: number
): SidebarState => {
  const unpinned = state.items.filter((item) => item.pinned === "none");
  const pinned = state.items.filter((item) => item.pinned !== "none");

  const itemToMove = unpinned.find((item) => item.id === itemId);
  if (!itemToMove) {
    // Item not found among unpinned — return state unchanged
    return state;
  }

  const withoutItem = unpinned.filter((item) => item.id !== itemId);
  const clampedIndex = Math.max(0, Math.min(newIndex, withoutItem.length));

  const reorderedUnpinned = [
    ...withoutItem.slice(0, clampedIndex),
    itemToMove,
    ...withoutItem.slice(clampedIndex),
  ];

  const allReordered = [...reorderedUnpinned, ...pinned];

  return {
    items: allReordered.map((item, index) => ({ ...item, order: index })),
  };
};

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/// Resets the sidebar to the default state derived from view registrations.
/// Equivalent to createDefaultSidebarState — same function, clearer intent.
export const resetToDefaults = (
  views: readonly ViewRegistration[],
  bottomPinnedIds: readonly string[]
): SidebarState => createDefaultSidebarState(views, bottomPinnedIds);

// ---------------------------------------------------------------------------
// Plugin merge
// ---------------------------------------------------------------------------

/// Merges new plugins into existing sidebar state.
/// New items (not already in state) are appended before bottom-pinned items.
/// Existing items preserve their current order and visibility.
export const mergeNewPlugins = (
  state: SidebarState,
  allViews: readonly ViewRegistration[],
  bottomPinnedIds: readonly string[]
): SidebarState => {
  const existingIds = new Set(state.items.map((item) => item.id));
  const newViews = allViews.filter((view) => !existingIds.has(view.id));

  if (newViews.length === 0) {
    return state;
  }

  const unpinned = state.items.filter((item) => item.pinned === "none");
  const pinned = state.items.filter((item) => item.pinned !== "none");

  const newItems: readonly SidebarItem[] = newViews.map((view, index) =>
    createSidebarItem(view, unpinned.length + index, bottomPinnedIds)
  );

  const allItems = [...unpinned, ...newItems, ...pinned];

  return {
    items: allItems.map((item, index) => ({ ...item, order: index })),
  };
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/// Returns only visible items, sorted by order.
/// Unpinned items come first, followed by bottom-pinned items.
export const getVisibleItems = (
  state: SidebarState
): readonly SidebarItem[] => {
  const visible = state.items.filter((item) => item.visible);
  const unpinned = visible.filter((item) => item.pinned === "none");
  const pinned = visible.filter((item) => item.pinned !== "none");

  return [
    ...unpinned.sort((a, b) => a.order - b.order),
    ...pinned.sort((a, b) => a.order - b.order),
  ];
};

/// Returns all items (visible and hidden), sorted by order.
export const getAllItems = (
  state: SidebarState
): readonly SidebarItem[] =>
  [...state.items].sort((a, b) => a.order - b.order);
