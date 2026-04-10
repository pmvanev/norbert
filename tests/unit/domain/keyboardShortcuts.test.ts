import { describe, it, expect } from "vitest";
import { resolveShortcut, type ShortcutAction } from "../../../src/domain/keyboardShortcuts";

// Helper: simulate a Ctrl+key press (no shift).
const ctrl = (key: string) => ({ ctrlOrMeta: true, shift: false, key });

// Helper: simulate a Ctrl+Shift+key press.
const ctrlShift = (key: string) => ({ ctrlOrMeta: true, shift: true, key });

// Helper: simulate a bare key press (no modifiers).
const bare = (key: string) => ({ ctrlOrMeta: false, shift: false, key });

// ---------------------------------------------------------------------------
// Ctrl+Q closes the current window
// ---------------------------------------------------------------------------

describe("Ctrl+Q closes the current window", () => {
  it("resolves to close-window", () => {
    expect(resolveShortcut(ctrl("q"))).toBe("close-window");
  });

  it("does not trigger quit-all (that requires Shift)", () => {
    expect(resolveShortcut(ctrl("q"))).not.toBe("quit-all");
  });
});

// ---------------------------------------------------------------------------
// Ctrl+Shift+Q quits all windows
// ---------------------------------------------------------------------------

describe("Ctrl+Shift+Q quits all windows", () => {
  it("resolves to quit-all", () => {
    expect(resolveShortcut(ctrlShift("Q"))).toBe("quit-all");
  });

  it("does not resolve to close-window", () => {
    expect(resolveShortcut(ctrlShift("Q"))).not.toBe("close-window");
  });
});

// ---------------------------------------------------------------------------
// Ctrl+Shift+N opens a new window
// ---------------------------------------------------------------------------

describe("Ctrl+Shift+N opens a new window", () => {
  it("resolves to new-window", () => {
    expect(resolveShortcut(ctrlShift("N"))).toBe("new-window");
  });
});

// ---------------------------------------------------------------------------
// Zoom shortcuts
// ---------------------------------------------------------------------------

describe("Zoom shortcuts", () => {
  it("Ctrl+= zooms in", () => {
    expect(resolveShortcut(ctrl("="))).toBe("zoom-in");
  });

  it("Ctrl++ zooms in", () => {
    expect(resolveShortcut(ctrl("+"))).toBe("zoom-in");
  });

  it("Ctrl+- zooms out", () => {
    expect(resolveShortcut(ctrl("-"))).toBe("zoom-out");
  });

  it("Ctrl+0 resets zoom", () => {
    expect(resolveShortcut(ctrl("0"))).toBe("zoom-reset");
  });
});

// ---------------------------------------------------------------------------
// No modifier = no action
// ---------------------------------------------------------------------------

describe("Keys without Ctrl/Meta are ignored", () => {
  it("bare q does nothing", () => {
    expect(resolveShortcut(bare("q"))).toBeNull();
  });

  it("bare N does nothing", () => {
    expect(resolveShortcut(bare("N"))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Unbound keys return null
// ---------------------------------------------------------------------------

describe("Unbound Ctrl+key combinations return null", () => {
  const unboundKeys = ["a", "b", "z", "1", "9", "Enter", "Escape"];
  for (const key of unboundKeys) {
    it(`Ctrl+${key} returns null`, () => {
      expect(resolveShortcut(ctrl(key))).toBeNull();
    });
  }
});
