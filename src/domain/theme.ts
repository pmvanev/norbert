/// Theme identifiers matching CSS class suffixes.
/// Each maps to a `.theme-{name}` CSS class (except "nb" which uses `:root`).
export const THEME_NAMES = ["nb", "cd", "vd", "cl", "vl"] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

/// Human-readable labels for the theme picker UI.
export const THEME_LABELS: Record<ThemeName, string> = {
  nb: "Norbert",
  cd: "Claude Dark",
  vd: "VS Code Dark",
  cl: "Claude Light",
  vl: "VS Code Light",
};

/// Default theme when no stored preference exists.
export const DEFAULT_THEME: ThemeName = "nb";

/// localStorage key for persisting theme preference.
export const THEME_STORAGE_KEY = "norbert-theme";

/// Validates whether a value is a recognized theme name.
export const isValidThemeName = (value: unknown): value is ThemeName =>
  typeof value === "string" &&
  THEME_NAMES.includes(value as ThemeName);

/// Converts a theme name to its corresponding CSS class name.
export const themeToClassName = (theme: ThemeName): string =>
  `theme-${theme}`;

/// Reads the stored theme preference, falling back to DEFAULT_THEME
/// when storage is empty or contains an invalid value.
/// Accepts a storage-like object (port) to keep this function pure.
export const readStoredTheme = (
  storage: Pick<Storage, "getItem">
): ThemeName => {
  const stored = storage.getItem(THEME_STORAGE_KEY);
  return isValidThemeName(stored) ? stored : DEFAULT_THEME;
};

/// Persists a theme name to storage.
/// Accepts a storage-like object (port) to keep this function pure.
export const storeTheme = (
  theme: ThemeName,
  storage: Pick<Storage, "setItem">
): void => {
  storage.setItem(THEME_STORAGE_KEY, theme);
};
