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

// ---------------------------------------------------------------------------
// Threshold validation
// ---------------------------------------------------------------------------

const isPositive = (value: number): boolean => value > 0;

const isPercentageInRange = (value: number): boolean =>
  Number.isInteger(value) && value >= 1 && value <= 99;

/// Validate a threshold value for a given unit.
/// Cost thresholds ("$") must be positive numbers.
/// Percentage thresholds ("%") must be integers in the 1-99 range.
export const validateThreshold = (
  value: number,
  unit: string
): ValidationResult<number> => {
  if (!isPositive(value)) {
    return fail("Threshold must be a positive number");
  }

  if (unit === "%" && !isPercentageInRange(value)) {
    return fail("Percentage threshold must be between 1 and 99");
  }

  return succeed(value);
};
