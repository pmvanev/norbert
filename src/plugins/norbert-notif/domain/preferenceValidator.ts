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
// Validation helpers
// ---------------------------------------------------------------------------

const fail = (message: string): ValidationResult<never> => ({
  ok: false,
  error: message,
});

const succeed = <T>(value: T): ValidationResult<T> => ({
  ok: true,
  value,
});

const isVolumeInRange = (volume: number): boolean =>
  Number.isInteger(volume) && volume >= 0 && volume <= 100;

const hasEvents = (events: readonly unknown[]): boolean =>
  events.length > 0;

// ---------------------------------------------------------------------------
// Preference validation
// ---------------------------------------------------------------------------

/// Validate a complete preferences object.
export const validatePreferences = (
  prefs: NotificationPreferences
): ValidationResult<NotificationPreferences> => {
  if (!hasEvents(prefs.events)) {
    return fail("Preferences must contain at least one event");
  }

  if (!isVolumeInRange(prefs.globalVolume)) {
    return fail("Global volume must be an integer between 0 and 100");
  }

  return succeed(prefs);
};

/// Validate a threshold value for a given unit.
export const validateThreshold = (
  _value: number,
  _unit: string
): ValidationResult<number> => {
  // Stub: will be implemented in a later step
  return { ok: true, value: _value };
};
