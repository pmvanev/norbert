/// Window factory unit tests.
///
/// Tests the pure window configuration creation logic.
/// Property-based tests verify domain invariants.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createWindowConfig,
  formatWindowTitle,
  type WindowConfig,
} from "./windowFactory";

// ---------------------------------------------------------------------------
// createWindowConfig — pure config builder
// ---------------------------------------------------------------------------

describe("createWindowConfig", () => {
  it("creates config with specific view and plugin", () => {
    const result = createWindowConfig("session-list", "norbert-sessions");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.viewId).toBe("session-list");
    expect(result.value.pluginId).toBe("norbert-sessions");
  });

  it("creates config with null view and plugin for default layout", () => {
    const result = createWindowConfig(null, null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.viewId).toBeNull();
    expect(result.value.pluginId).toBeNull();
  });

  it("generates a unique label starting with norbert-", () => {
    const result = createWindowConfig(null, null);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.label).toMatch(/^norbert-/);
  });

  it("uses custom label when provided", () => {
    const result = createWindowConfig(
      "session-list",
      "norbert-sessions",
      "my-monitor"
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.label).toBe("my-monitor");
  });

  it("rejects viewId without pluginId", () => {
    const result = createWindowConfig("session-list", null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("pluginId");
  });

  it("rejects pluginId without viewId", () => {
    const result = createWindowConfig(null, "norbert-sessions");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("viewId");
  });
});

// ---------------------------------------------------------------------------
// Property: generated labels are always unique
// ---------------------------------------------------------------------------

describe("createWindowConfig properties", () => {
  it("every generated config has a unique label", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
              nil: null,
            }),
            fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
              nil: null,
            })
          ),
          { minLength: 2, maxLength: 10 }
        ),
        (pairs) => {
          // Only test valid pairs (both null or both non-null)
          const validPairs = pairs.filter(
            ([v, p]) =>
              (v === null && p === null) || (v !== null && p !== null)
          );
          if (validPairs.length < 2) return true;

          const configs = validPairs
            .map(([v, p]) => createWindowConfig(v, p))
            .filter((r) => r.ok)
            .map((r) => (r as { ok: true; value: WindowConfig }).value);

          const labels = configs.map((c) => c.label);
          const uniqueLabels = new Set(labels);
          return uniqueLabels.size === labels.length;
        }
      )
    );
  });

  it("config viewId and pluginId are both null or both non-null", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
        (viewId, pluginId) => {
          const result = createWindowConfig(viewId, pluginId);
          if (!result.ok) return true; // errors are fine
          const config = result.value;
          // Both null or both non-null
          return (
            (config.viewId === null && config.pluginId === null) ||
            (config.viewId !== null && config.pluginId !== null)
          );
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// formatWindowTitle — pure title formatting
// ---------------------------------------------------------------------------

describe("formatWindowTitle", () => {
  it("formats title with label only", () => {
    const title = formatWindowTitle("window-1");
    expect(title).toBe("Norbert - window-1");
  });

  it("formats title with label and custom suffix", () => {
    const title = formatWindowTitle("window-1", "Sessions");
    expect(title).toBe("Norbert - window-1 - Sessions");
  });
});
