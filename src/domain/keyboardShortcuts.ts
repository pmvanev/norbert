/**
 * Keyboard shortcut dispatch logic.
 *
 * Pure function: maps a keyboard event description to an action name.
 * The caller is responsible for executing the action.
 */

export type ShortcutAction =
  | "new-window"
  | "close-window"
  | "quit-all"
  | "zoom-in"
  | "zoom-out"
  | "zoom-reset"
  | null;

interface KeyDescription {
  readonly ctrlOrMeta: boolean;
  readonly shift: boolean;
  readonly key: string;
}

export function resolveShortcut(key: KeyDescription): ShortcutAction {
  if (!key.ctrlOrMeta) return null;

  if (key.shift && key.key === "N") return "new-window";
  if (key.shift && key.key === "Q") return "quit-all";
  if (key.key === "q") return "close-window";
  if (key.key === "=" || key.key === "+") return "zoom-in";
  if (key.key === "-") return "zoom-out";
  if (key.key === "0") return "zoom-reset";

  return null;
}
