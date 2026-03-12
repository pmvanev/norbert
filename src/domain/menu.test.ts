import { describe, it, expect, vi } from "vitest";
import {
  buildThemeItems,
  buildMenuBar,
  type MenuAction,
  type SubMenu,
} from "./menu";

describe("buildThemeItems", () => {
  it("returns one item per theme", () => {
    const items = buildThemeItems("nb", vi.fn());
    expect(items).toHaveLength(5);
  });

  it("marks only the current theme as checked", () => {
    const items = buildThemeItems("vd", vi.fn());
    const checked = items.filter((i) => i.checked);
    expect(checked).toHaveLength(1);
    expect(checked[0].label).toBe("VS Code Dark");
  });

  it("calls onSelect with the theme name when action fires", () => {
    const onSelect = vi.fn();
    const items = buildThemeItems("nb", onSelect);
    const clItem = items.find((i) => i.label === "Claude Light")!;
    clItem.onAction();
    expect(onSelect).toHaveBeenCalledWith("cl");
  });
});

describe("buildMenuBar", () => {
  it("returns a single View menu entry", () => {
    const menu = buildMenuBar("nb", vi.fn());
    expect(menu).toHaveLength(1);
    expect(menu[0].label).toBe("View");
  });

  it("has View > Appearance > Theme submenu path", () => {
    const menu = buildMenuBar("nb", vi.fn());
    const viewItems = menu[0].items;
    expect(viewItems).toHaveLength(1);

    const appearance = viewItems[0] as SubMenu;
    expect(appearance.kind).toBe("submenu");
    expect(appearance.label).toBe("Appearance");

    const themeMenu = appearance.items[0] as SubMenu;
    expect(themeMenu.kind).toBe("submenu");
    expect(themeMenu.label).toBe("Theme");
    expect(themeMenu.items).toHaveLength(5);
  });

  it("theme items reflect the current theme", () => {
    const menu = buildMenuBar("cd", vi.fn());
    const appearance = menu[0].items[0] as SubMenu;
    const themeMenu = appearance.items[0] as SubMenu;
    const checked = (themeMenu.items as ReadonlyArray<MenuAction>).filter(
      (i) => i.checked
    );
    expect(checked).toHaveLength(1);
    expect(checked[0].label).toBe("Claude Dark");
  });
});
