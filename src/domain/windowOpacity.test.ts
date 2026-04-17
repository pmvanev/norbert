import { describe, it, expect, beforeEach } from "vitest";
import {
  MIN_OPACITY_PERCENT,
  MAX_OPACITY_PERCENT,
  DEFAULT_OPACITY_PERCENT,
  OPACITY_STORAGE_KEY,
  isValidOpacityPercent,
  readStoredOpacity,
  storeOpacity,
} from "./windowOpacity";

describe("MIN_OPACITY_PERCENT / MAX_OPACITY_PERCENT", () => {
  it("spans the full 0–100 percent range", () => {
    expect(MIN_OPACITY_PERCENT).toBe(0);
    expect(MAX_OPACITY_PERCENT).toBe(100);
  });
});

describe("DEFAULT_OPACITY_PERCENT", () => {
  it("is fully opaque", () => {
    expect(DEFAULT_OPACITY_PERCENT).toBe(100);
  });
});

describe("isValidOpacityPercent", () => {
  it("returns true for integers inside the allowed range", () => {
    expect(isValidOpacityPercent(0)).toBe(true);
    expect(isValidOpacityPercent(50)).toBe(true);
    expect(isValidOpacityPercent(100)).toBe(true);
  });

  it("returns true for fractional values inside the allowed range", () => {
    expect(isValidOpacityPercent(42.5)).toBe(true);
  });

  it("returns false for numbers outside the allowed range", () => {
    expect(isValidOpacityPercent(-1)).toBe(false);
    expect(isValidOpacityPercent(101)).toBe(false);
  });

  it("returns false for non-number types", () => {
    expect(isValidOpacityPercent("50")).toBe(false);
    expect(isValidOpacityPercent(null)).toBe(false);
    expect(isValidOpacityPercent(undefined)).toBe(false);
    expect(isValidOpacityPercent(NaN)).toBe(false);
  });
});

describe("readStoredOpacity", () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
  });

  const createMockStorage = (): Pick<Storage, "getItem"> => ({
    getItem: (key: string) => storage[key] ?? null,
  });

  it("returns default opacity when storage is empty", () => {
    const result = readStoredOpacity(createMockStorage());
    expect(result).toBe(DEFAULT_OPACITY_PERCENT);
  });

  it("returns stored opacity when valid", () => {
    storage[OPACITY_STORAGE_KEY] = "70";
    const result = readStoredOpacity(createMockStorage());
    expect(result).toBe(70);
  });

  it("returns default opacity when stored value is not numeric", () => {
    storage[OPACITY_STORAGE_KEY] = "garbage";
    const result = readStoredOpacity(createMockStorage());
    expect(result).toBe(DEFAULT_OPACITY_PERCENT);
  });

  it("returns default opacity when stored value is out of range", () => {
    storage[OPACITY_STORAGE_KEY] = "150";
    const result = readStoredOpacity(createMockStorage());
    expect(result).toBe(DEFAULT_OPACITY_PERCENT);
  });

  it("returns default opacity when stored value is empty string", () => {
    storage[OPACITY_STORAGE_KEY] = "";
    const result = readStoredOpacity(createMockStorage());
    expect(result).toBe(DEFAULT_OPACITY_PERCENT);
  });
});

describe("storeOpacity", () => {
  it("writes opacity to storage under the correct key", () => {
    const stored: Record<string, string> = {};
    const mockStorage: Pick<Storage, "setItem"> = {
      setItem: (key: string, value: string) => {
        stored[key] = value;
      },
    };

    storeOpacity(65, mockStorage);
    expect(stored[OPACITY_STORAGE_KEY]).toBe("65");
  });
});
