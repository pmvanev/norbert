/// Window opacity percentage, a number in the inclusive range [0, 100].
/// Drives the native window's translucency so users can see through Norbert
/// to whatever is behind it (e.g. their terminal running Claude Code).
export type OpacityPercent = number;

/// Minimum allowed opacity. Zero makes the window fully transparent.
export const MIN_OPACITY_PERCENT = 0;

/// Maximum allowed opacity. 100 is fully opaque (default look).
export const MAX_OPACITY_PERCENT = 100;

/// Default opacity when no stored preference exists.
export const DEFAULT_OPACITY_PERCENT: OpacityPercent = 100;

/// localStorage key for persisting opacity preference.
export const OPACITY_STORAGE_KEY = "norbert-window-opacity";

/// Validates whether a value is a finite number in the allowed percent range.
export const isValidOpacityPercent = (
  value: unknown
): value is OpacityPercent =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= MIN_OPACITY_PERCENT &&
  value <= MAX_OPACITY_PERCENT;

/// Reads the stored opacity preference, falling back to DEFAULT_OPACITY_PERCENT
/// when storage is empty or contains an invalid value.
/// Accepts a storage-like object (port) to keep this function pure.
export const readStoredOpacity = (
  storage: Pick<Storage, "getItem">
): OpacityPercent => {
  const raw = storage.getItem(OPACITY_STORAGE_KEY);
  if (raw === null || raw === "") return DEFAULT_OPACITY_PERCENT;
  const parsed = Number(raw);
  return isValidOpacityPercent(parsed) ? parsed : DEFAULT_OPACITY_PERCENT;
};

/// Persists an opacity percent to storage.
/// Accepts a storage-like object (port) to keep this function pure.
export const storeOpacity = (
  percent: OpacityPercent,
  storage: Pick<Storage, "setItem">
): void => {
  storage.setItem(OPACITY_STORAGE_KEY, String(percent));
};
