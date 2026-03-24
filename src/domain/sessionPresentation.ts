/// Pure presentation logic extracted from view components.
///
/// These functions derive CSS class names and display labels from session state,
/// keeping the view components thin (rendering only) and the logic testable.

/// Derive the status label for a session detail header.
///
/// Pure function: returns "Active" or "Completed" based on whether
/// the session is currently active.
export function deriveStatusLabel(isActive: boolean): string {
  return isActive ? "Active" : "Completed";
}

/// Derive the CSS class for the status value in the session detail header.
///
/// Pure function: returns "status-active" or "status-completed".
export function deriveStatusClass(isActive: boolean): string {
  return isActive ? "status-active" : "status-completed";
}

/// Derive the CSS class for a session row in the session list.
///
/// Pure function: active sessions get the "live-s" modifier for the glow effect.
export function deriveSessionRowClass(isActive: boolean): string {
  return isActive ? "srow live-s" : "srow";
}

/// Derive the CSS class for the status dot indicator in the session list.
///
/// Pure function: active sessions show a pulsing "live" dot,
/// completed sessions show a dim "done" dot.
export function deriveSessionDotClass(isActive: boolean): string {
  return isActive ? "sdot live" : "sdot done";
}
