/// Window factory — pure functions for window configuration creation.
///
/// Domain types and pure config builders for multi-window management.
/// No Tauri imports here; actual window creation happens at the adapter boundary.
///
/// Ports:
///   createWindowConfig: (viewId, pluginId, label?) -> Result<WindowConfig>
///   formatWindowTitle: (label, suffix?) -> string

import type { Result } from "../plugins/types";
import { ok, err } from "../plugins/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Configuration for a new window. Pure data, no side effects.
export type WindowConfig = {
  readonly label: string;
  readonly viewId: string | null;
  readonly pluginId: string | null;
};

// ---------------------------------------------------------------------------
// Label generation (pure, uses counter for uniqueness)
// ---------------------------------------------------------------------------

let labelCounter = 0;

const generateLabel = (): string => {
  labelCounter += 1;
  return `norbert-${labelCounter}`;
};

// ---------------------------------------------------------------------------
// Window config creation (pure validation + label generation)
// ---------------------------------------------------------------------------

/// Creates a window configuration from a view ID, plugin ID, and optional label.
///
/// Validates that viewId and pluginId are both null (default layout) or both
/// non-null (specific view). Returns an error if only one is provided.
export const createWindowConfig = (
  viewId: string | null,
  pluginId: string | null,
  label?: string
): Result<WindowConfig> => {
  if (viewId !== null && pluginId === null) {
    return err("pluginId is required when viewId is specified");
  }
  if (viewId === null && pluginId !== null) {
    return err("viewId is required when pluginId is specified");
  }

  return ok({
    label: label ?? generateLabel(),
    viewId,
    pluginId,
  });
};

// ---------------------------------------------------------------------------
// Window title formatting (pure)
// ---------------------------------------------------------------------------

/// Formats a window title from a label and optional suffix.
/// "Norbert - {label}" or "Norbert - {label} - {suffix}"
export const formatWindowTitle = (
  label: string,
  suffix?: string
): string => {
  const base = `Norbert - ${label}`;
  return suffix ? `${base} - ${suffix}` : base;
};
