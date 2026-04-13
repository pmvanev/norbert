/// Pure presentation logic extracted from view components.
///
/// These functions derive CSS class names and display labels from session state,
/// keeping the view components thin (rendering only) and the logic testable.

/// Derive a short, human-readable name for a session from its working
/// directory and optional git branch. Uses the last path segment (the
/// project folder), appends the branch in parentheses when available,
/// and falls back to the provided fallback string when no cwd is available.
///
/// Pure function: no side effects.
export function deriveSessionName(
  cwd: string | null,
  fallback: string,
  gitBranch?: string | null,
): string {
  if (cwd && cwd.length > 0) {
    const segments = cwd.replace(/\\/g, "/").split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      return gitBranch ? `${last} (${gitBranch})` : last;
    }
  }
  return fallback;
}

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

/// Known terminal type to human-readable IDE badge mapping.
const TERMINAL_TYPE_MAP: Readonly<Record<string, string>> = {
  vscode: "VS Code",
  cursor: "Cursor",
  "iTerm.app": "iTerm",
  tmux: "tmux",
  xterm: "xterm",
  "xterm-256color": "Terminal",
  alacritty: "Alacritty",
  WezTerm: "WezTerm",
  windsurf: "Windsurf",
};

/// Map a terminal.type resource attribute to a human-readable IDE badge.
///
/// Pure function: returns the badge string for known types, null for
/// null input or unrecognized terminal types.
export function mapTerminalType(terminalType: string | null): string | null {
  if (terminalType === null) return null;
  return TERMINAL_TYPE_MAP[terminalType] ?? null;
}

/// Format a service.version into a display string with "Claude Code" prefix.
///
/// Pure function: returns "Claude Code {version}" or null for null input.
export function formatClaudeVersion(version: string | null): string | null {
  if (version === null) return null;
  return `Claude Code ${version}`;
}

/// Known OS type to human-readable display name mapping.
const OS_TYPE_MAP: Readonly<Record<string, string>> = {
  windows: "Windows",
  linux: "Linux",
  darwin: "macOS",
};

/// Format os.type and host.arch into a platform display string.
///
/// Pure function: combines OS display name and architecture.
/// Returns null only when both inputs are null.
export function formatPlatform(
  osType: string | null,
  arch: string | null,
): string | null {
  const displayOs = osType !== null ? (OS_TYPE_MAP[osType] ?? osType) : null;
  if (displayOs !== null && arch !== null) return `${displayOs} ${arch}`;
  if (displayOs !== null) return displayOs;
  if (arch !== null) return arch;
  return null;
}
