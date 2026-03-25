import { useState, useCallback, useEffect, useRef } from "react";
import type { MenuEntry, MenuItem, MenuAction, SubMenu } from "../domain/menu";

type MenuBarProps = {
  readonly entries: ReadonlyArray<MenuEntry>;
};

/// Renders a single menu action item (leaf node).
const ActionItem = ({ item }: { item: MenuAction }) => (
  <button className="menu-item" onClick={item.onAction} role="menuitem">
    <span className="menu-check">{item.checked ? "✓" : ""}</span>
    <span>{item.label}</span>
  </button>
);

/// Renders a submenu with hover-to-open flyout.
const SubMenuItem = ({ item }: { item: SubMenu }) => (
  <div className="menu-item menu-submenu">
    <span className="menu-check" />
    <span>{item.label}</span>
    <span className="menu-arrow">›</span>
    <div className="menu-dropdown menu-flyout">
      {item.items.map((child, i) => (
        <MenuItemView key={i} item={child} />
      ))}
    </div>
  </div>
);

/// Dispatches rendering based on menu item kind.
const MenuItemView = ({ item }: { item: MenuItem }) =>
  item.kind === "action" ? (
    <ActionItem item={item} />
  ) : (
    <SubMenuItem item={item} />
  );

export const MenuBar = ({ entries }: MenuBarProps) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(
    (label: string) => {
      setOpenMenu((prev) => (prev === label ? null : label));
    },
    []
  );

  const handleMouseEnter = useCallback(
    (label: string) => {
      if (openMenu !== null) {
        setOpenMenu(label);
      }
    },
    [openMenu]
  );

  /// Close menu when clicking outside.
  useEffect(() => {
    if (openMenu === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  /// Close menu after any action item is clicked.
  const handleBarClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".menu-item:not(.menu-submenu)")) {
      setOpenMenu(null);
    }
  }, []);

  return (
    <div className="menu-bar" ref={barRef} onClick={handleBarClick}>
      {entries.map((entry) => (
        <div
          key={entry.label}
          className={`menu-top ${openMenu === entry.label ? "open" : ""}`}
        >
          <button
            className="menu-top-label"
            onClick={() => handleToggle(entry.label)}
            onMouseEnter={() => handleMouseEnter(entry.label)}
          >
            {entry.label}
          </button>
          {openMenu === entry.label && (
            <div className="menu-dropdown" role="menu">
              {entry.items.map((item, i) => (
                <MenuItemView key={i} item={item} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
