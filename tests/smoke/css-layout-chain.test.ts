import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * CSS layout chain smoke test.
 *
 * Verifies that the critical height propagation chain from html → body → #root → main
 * is intact in design-system.css. A break in this chain causes a "black screen" where
 * content renders but is invisible because the layout container has zero height.
 *
 * This test reads the raw CSS file and checks for required property declarations.
 * It does NOT compute styles — it asserts that the declarations exist in the source.
 */

const CSS_PATH = resolve(__dirname, "../../src/styles/design-system.css");

/** Extract all declarations for a given selector from raw CSS text. */
function extractRules(css: string, selector: string): string {
  // Escape special regex characters in selector, but handle comma-separated selectors
  const escapedSelector = selector
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/,\s*/g, ",\\s*");

  const pattern = new RegExp(
    `${escapedSelector}\\s*\\{([^}]*)\\}`,
    "gs"
  );

  const matches = [...css.matchAll(pattern)];
  return matches.map((m) => m[1]).join("\n");
}

/** Check whether a block of CSS declarations contains a property with a given value. */
function hasDeclaration(block: string, property: string, value: string): boolean {
  // Normalize whitespace for matching
  const pattern = new RegExp(
    `${property}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "i"
  );
  return pattern.test(block);
}

describe("CSS layout chain smoke test", () => {
  const css = readFileSync(CSS_PATH, "utf-8");

  describe("html, body height propagation", () => {
    const block = extractRules(css, "html, body");

    it("sets width: 100%", () => {
      expect(hasDeclaration(block, "width", "100%")).toBe(true);
    });

    it("sets height: 100%", () => {
      expect(hasDeclaration(block, "height", "100%")).toBe(true);
    });
  });

  describe("#root fills viewport", () => {
    const block = extractRules(css, "#root");

    it("sets width: 100%", () => {
      expect(hasDeclaration(block, "width", "100%")).toBe(true);
    });

    it("sets height: 100%", () => {
      expect(hasDeclaration(block, "height", "100%")).toBe(true);
    });
  });

  describe("main is a flex column filling #root", () => {
    const block = extractRules(css, "main");

    it("sets display: flex", () => {
      expect(hasDeclaration(block, "display", "flex")).toBe(true);
    });

    it("sets flex-direction: column", () => {
      expect(hasDeclaration(block, "flex-direction", "column")).toBe(true);
    });

    it("sets height: 100%", () => {
      expect(hasDeclaration(block, "height", "100%")).toBe(true);
    });

    it("sets width: 100%", () => {
      expect(hasDeclaration(block, "width", "100%")).toBe(true);
    });
  });

  describe("status-bar does not collapse", () => {
    const block = extractRules(css, ".status-bar");

    it("sets flex-shrink: 0", () => {
      expect(hasDeclaration(block, "flex-shrink", "0")).toBe(true);
    });
  });

  describe("session-list fills available space", () => {
    const block = extractRules(css, ".session-list");

    it("sets flex: 1", () => {
      expect(hasDeclaration(block, "flex", "1")).toBe(true);
    });

    it("sets overflow-y: auto", () => {
      expect(hasDeclaration(block, "overflow-y", "auto")).toBe(true);
    });
  });

  describe("session-list-empty fills available space", () => {
    const block = extractRules(css, ".session-list-empty");

    it("sets flex: 1", () => {
      expect(hasDeclaration(block, "flex", "1")).toBe(true);
    });
  });
});
