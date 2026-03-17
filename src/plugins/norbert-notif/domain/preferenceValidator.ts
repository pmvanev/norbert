/// Preference validation for notification settings.
///
/// Validates user preferences and threshold values against
/// domain constraints. Pure functions -- no side effects.

import type { NotificationPreferences } from "./types";

// ---------------------------------------------------------------------------
// Result type (railway-oriented)
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

// ---------------------------------------------------------------------------
// Placeholder implementations -- to be completed in later steps
// ---------------------------------------------------------------------------

/// Validate a complete preferences object.
export const validatePreferences = (
  _prefs: NotificationPreferences
): ValidationResult<NotificationPreferences> => {
  // Stub: will be implemented in a later step
  return { ok: true, value: _prefs };
};

/// Validate a threshold value for a given unit.
export const validateThreshold = (
  _value: number,
  _unit: string
): ValidationResult<number> => {
  // Stub: will be implemented in a later step
  return { ok: true, value: _value };
};
