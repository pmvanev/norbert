/// Window State Manager -- pure functions for multi-window state management.
///
/// Each window gets an independent LayoutState. All functions are pure:
/// they take state and return new state without mutation.
///
/// Types:
///   WindowState: { windowId, label, layoutState }
///   MultiWindowState: { windows: readonly WindowState[] }
///
/// Functions:
///   createMultiWindowState() -> MultiWindowState
///   createWindow(state, windowId, label, layout) -> MultiWindowState
///   closeWindow(state, windowId) -> MultiWindowState
///   updateWindowLayout(state, windowId, layout) -> MultiWindowState
///   getWindowLayout(state, windowId) -> LayoutState | undefined
///   labelWindow(state, windowId, label) -> MultiWindowState
///   getWindowState(state, windowId) -> WindowState | undefined

import type { LayoutState } from "../layout/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A single window's state: identity, label, and independent layout.
export type WindowState = {
  readonly windowId: string;
  readonly label: string;
  readonly layoutState: LayoutState;
};

/// The collection of all open window states.
export type MultiWindowState = {
  readonly windows: readonly WindowState[];
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/// Creates an empty multi-window state with no windows.
export const createMultiWindowState = (): MultiWindowState => ({
  windows: [],
});

// ---------------------------------------------------------------------------
// State transitions (pure functions)
// ---------------------------------------------------------------------------

/// Adds a new window with the given id, label, and layout.
/// Returns a new MultiWindowState with the window appended.
export const createWindow = (
  state: MultiWindowState,
  windowId: string,
  label: string,
  layoutState: LayoutState
): MultiWindowState => ({
  windows: [...state.windows, { windowId, label, layoutState }],
});

/// Removes the window with the given id.
/// Returns unchanged state if the window is not found.
export const closeWindow = (
  state: MultiWindowState,
  windowId: string
): MultiWindowState => ({
  windows: state.windows.filter((w) => w.windowId !== windowId),
});

/// Updates the layout for a specific window, leaving all others unchanged.
/// Returns unchanged state if the window is not found.
export const updateWindowLayout = (
  state: MultiWindowState,
  windowId: string,
  layoutState: LayoutState
): MultiWindowState => ({
  windows: state.windows.map((w) =>
    w.windowId === windowId ? { ...w, layoutState } : w
  ),
});

/// Returns the layout for a specific window, or undefined if not found.
export const getWindowLayout = (
  state: MultiWindowState,
  windowId: string
): LayoutState | undefined =>
  state.windows.find((w) => w.windowId === windowId)?.layoutState;

/// Updates the label for a specific window, leaving all others unchanged.
/// Returns unchanged state if the window is not found.
export const labelWindow = (
  state: MultiWindowState,
  windowId: string,
  label: string
): MultiWindowState => ({
  windows: state.windows.map((w) =>
    w.windowId === windowId ? { ...w, label } : w
  ),
});

/// Returns the full WindowState for a specific window, or undefined if not found.
export const getWindowState = (
  state: MultiWindowState,
  windowId: string
): WindowState | undefined =>
  state.windows.find((w) => w.windowId === windowId);
