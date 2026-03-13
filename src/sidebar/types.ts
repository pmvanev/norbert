/// Sidebar type definitions.
///
/// Algebraic data types for sidebar state management:
/// SidebarItem represents a single icon in the sidebar,
/// SidebarState is the immutable collection of all items.

// ---------------------------------------------------------------------------
// PinnedPosition — where an item is pinned (or not)
// ---------------------------------------------------------------------------

/// The three possible pinning positions for a sidebar item.
export const PINNED_POSITIONS = ["none", "bottom"] as const;
export type PinnedPosition = (typeof PINNED_POSITIONS)[number];

// ---------------------------------------------------------------------------
// SidebarItem — a single sidebar icon entry
// ---------------------------------------------------------------------------

/// A sidebar item representing one icon in the sidebar.
/// Combines view identity with visibility, pinning, and order.
export interface SidebarItem {
  readonly id: string;
  readonly pluginId: string;
  readonly label: string;
  readonly icon: string;
  readonly visible: boolean;
  readonly pinned: PinnedPosition;
  readonly order: number;
}

// ---------------------------------------------------------------------------
// SidebarState — the full sidebar configuration
// ---------------------------------------------------------------------------

/// Immutable state of the entire sidebar.
/// All operations on sidebar state return new SidebarState instances.
export interface SidebarState {
  readonly items: readonly SidebarItem[];
}
