import { describe, it, expect, beforeEach } from "vitest";
import {
  THEME_NAMES,
  THEME_LABELS,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isValidThemeName,
  themeToClassName,
  readStoredTheme,
  storeTheme,
} from "./theme";

describe("THEME_NAMES", () => {
  it("contains exactly 5 themes", () => {
    expect(THEME_NAMES).toHaveLength(5);
  });

  it("includes all expected theme identifiers", () => {
    expect(THEME_NAMES).toEqual(["nb", "cd", "vd", "cl", "vl"]);
  });
});

describe("THEME_LABELS", () => {
  it("maps each theme name to a human-readable label", () => {
    expect(THEME_LABELS.nb).toBe("Norbert");
    expect(THEME_LABELS.cd).toBe("Claude Dark");
    expect(THEME_LABELS.vd).toBe("VS Code Dark");
    expect(THEME_LABELS.cl).toBe("Claude Light");
    expect(THEME_LABELS.vl).toBe("VS Code Light");
  });
});

describe("DEFAULT_THEME", () => {
  it("is Norbert theme", () => {
    expect(DEFAULT_THEME).toBe("nb");
  });
});

describe("isValidThemeName", () => {
  it("returns true for all valid theme names", () => {
    for (const name of THEME_NAMES) {
      expect(isValidThemeName(name)).toBe(true);
    }
  });

  it("returns false for invalid strings", () => {
    expect(isValidThemeName("invalid")).toBe(false);
    expect(isValidThemeName("")).toBe(false);
    expect(isValidThemeName("NB")).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isValidThemeName(null)).toBe(false);
    expect(isValidThemeName(undefined)).toBe(false);
  });
});

describe("themeToClassName", () => {
  it("converts Norbert theme to theme-nb class", () => {
    expect(themeToClassName("nb")).toBe("theme-nb");
  });

  it("converts each theme name to its CSS class", () => {
    expect(themeToClassName("cd")).toBe("theme-cd");
    expect(themeToClassName("vd")).toBe("theme-vd");
    expect(themeToClassName("cl")).toBe("theme-cl");
    expect(themeToClassName("vl")).toBe("theme-vl");
  });
});

describe("readStoredTheme", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
  });

  const createMockStorage = (): Pick<Storage, "getItem"> => ({
    getItem: (key: string) => storage[key] ?? null,
  });

  it("returns default theme when storage is empty", () => {
    const result = readStoredTheme(createMockStorage());
    expect(result).toBe(DEFAULT_THEME);
  });

  it("returns stored theme when valid", () => {
    storage[THEME_STORAGE_KEY] = "cd";
    const result = readStoredTheme(createMockStorage());
    expect(result).toBe("cd");
  });

  it("returns default theme when stored value is invalid", () => {
    storage[THEME_STORAGE_KEY] = "garbage";
    const result = readStoredTheme(createMockStorage());
    expect(result).toBe(DEFAULT_THEME);
  });

  it("returns default theme when stored value is empty string", () => {
    storage[THEME_STORAGE_KEY] = "";
    const result = readStoredTheme(createMockStorage());
    expect(result).toBe(DEFAULT_THEME);
  });
});

describe("storeTheme", () => {
  it("writes theme name to storage under the correct key", () => {
    const stored: Record<string, string> = {};
    const mockStorage: Pick<Storage, "setItem"> = {
      setItem: (key: string, value: string) => {
        stored[key] = value;
      },
    };

    storeTheme("vd", mockStorage);
    expect(stored[THEME_STORAGE_KEY]).toBe("vd");
  });
});
