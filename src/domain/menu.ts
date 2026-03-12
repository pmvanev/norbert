/// Menu bar domain types and data.
/// Pure data definitions — no React, no DOM.

import { type ThemeName, THEME_NAMES, THEME_LABELS } from "./theme";

/// A leaf menu item that triggers an action.
export type MenuAction = {
  readonly kind: "action";
  readonly label: string;
  readonly checked?: boolean;
  readonly onAction: () => void;
};

/// A submenu containing nested items.
export type SubMenu = {
  readonly kind: "submenu";
  readonly label: string;
  readonly items: ReadonlyArray<MenuItem>;
};

export type MenuItem = MenuAction | SubMenu;

/// A top-level menu entry in the menu bar.
export type MenuEntry = {
  readonly label: string;
  readonly items: ReadonlyArray<MenuItem>;
};

/// Build the View menu's Appearance > Theme submenu from current theme state.
export const buildThemeItems = (
  currentTheme: ThemeName,
  onSelect: (theme: ThemeName) => void
): ReadonlyArray<MenuAction> =>
  THEME_NAMES.map((name) => ({
    kind: "action" as const,
    label: THEME_LABELS[name],
    checked: name === currentTheme,
    onAction: () => onSelect(name),
  }));

/// Build the complete menu bar structure.
export const buildMenuBar = (
  currentTheme: ThemeName,
  onThemeSelect: (theme: ThemeName) => void
): ReadonlyArray<MenuEntry> => [
  {
    label: "View",
    items: [
      {
        kind: "submenu",
        label: "Appearance",
        items: [
          {
            kind: "submenu",
            label: "Theme",
            items: buildThemeItems(currentTheme, onThemeSelect),
          },
        ],
      },
    ],
  },
];
