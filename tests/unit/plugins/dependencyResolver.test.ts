/**
 * Unit tests: Dependency Resolver
 *
 * Validates topological sort via Kahn's algorithm with semver range
 * validation, and disabled dependency degradation warnings.
 * Pure functions tested with in-memory manifests.
 *
 * Test budget: 9 scenarios = max 18 tests (2x rule).
 * Actual: 15 tests covering topological ordering, semver validation,
 * circular detection, missing dependency reporting, and disabled degradation.
 */

import { describe, it, expect } from "vitest";
import type { PluginManifest } from "../../../src/plugins/types";
import { resolveDependencies } from "../../../src/plugins/dependencyResolver";

// ---------------------------------------------------------------------------
// Helper: create a manifest with minimal fields
// ---------------------------------------------------------------------------

const manifest = (
  id: string,
  version: string,
  dependencies: Readonly<Record<string, string>> = {}
): PluginManifest => ({
  id,
  name: id,
  version,
  norbert_api: "^1.0.0",
  dependencies,
});

// ---------------------------------------------------------------------------
// Topological ordering
// ---------------------------------------------------------------------------

describe("resolveDependencies — topological ordering", () => {
  it("returns single plugin with no dependencies", () => {
    const manifests = [manifest("alpha", "1.0.0")];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.loadOrder).toEqual(["alpha"]);
  });

  it("orders dependency before dependent", () => {
    const manifests = [
      manifest("usage", "1.0.0", { session: "^1.0.0" }),
      manifest("session", "1.0.0"),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.loadOrder.indexOf("session")).toBeLessThan(
      result.value.loadOrder.indexOf("usage")
    );
  });

  it("handles diamond dependency graph", () => {
    // A depends on B and C; B and C both depend on D
    const manifests = [
      manifest("A", "1.0.0", { B: "^1.0.0", C: "^1.0.0" }),
      manifest("B", "1.0.0", { D: "^1.0.0" }),
      manifest("C", "1.0.0", { D: "^1.0.0" }),
      manifest("D", "1.0.0"),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // D before B and C; B and C before A
    expect(result.value.loadOrder.indexOf("D")).toBeLessThan(result.value.loadOrder.indexOf("B"));
    expect(result.value.loadOrder.indexOf("D")).toBeLessThan(result.value.loadOrder.indexOf("C"));
    expect(result.value.loadOrder.indexOf("B")).toBeLessThan(result.value.loadOrder.indexOf("A"));
    expect(result.value.loadOrder.indexOf("C")).toBeLessThan(result.value.loadOrder.indexOf("A"));
  });

  it("returns empty resolution for empty input", () => {
    const result = resolveDependencies([]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.loadOrder).toEqual([]);
    expect(result.value.degradationWarnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Semver version validation
// ---------------------------------------------------------------------------

describe("resolveDependencies — semver validation", () => {
  it("accepts dependency when installed version satisfies range", () => {
    const manifests = [
      manifest("consumer", "1.0.0", { provider: "^1.0.0" }),
      manifest("provider", "1.2.3"),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(true);
  });

  it("rejects dependency when installed version does not satisfy range", () => {
    const manifests = [
      manifest("consumer", "1.0.0", { provider: ">=2.0.0" }),
      manifest("provider", "1.5.0"),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("provider");
    expect(result.error).toContain(">=2.0.0");
    expect(result.error).toContain("1.5.0");
  });
});

// ---------------------------------------------------------------------------
// Missing dependencies
// ---------------------------------------------------------------------------

describe("resolveDependencies — missing dependencies", () => {
  it("reports single missing dependency", () => {
    const manifests = [
      manifest("consumer", "1.0.0", { "not-installed": "^1.0.0" }),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("not-installed");
    expect(result.error).toContain("not installed");
  });

  it("reports multiple missing dependencies in single error", () => {
    const manifests = [
      manifest("consumer", "1.0.0", {
        "dep-one": "^1.0.0",
        "dep-two": "^2.0.0",
      }),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("dep-one");
    expect(result.error).toContain("dep-two");
  });
});

// ---------------------------------------------------------------------------
// Circular dependencies
// ---------------------------------------------------------------------------

describe("resolveDependencies — circular dependencies", () => {
  it("detects simple two-node cycle", () => {
    const manifests = [
      manifest("A", "1.0.0", { B: "^1.0.0" }),
      manifest("B", "1.0.0", { A: "^1.0.0" }),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/circular/i);
    expect(result.error).toContain("A");
    expect(result.error).toContain("B");
  });

  it("detects three-node cycle", () => {
    const manifests = [
      manifest("X", "1.0.0", { Y: "^1.0.0" }),
      manifest("Y", "1.0.0", { Z: "^1.0.0" }),
      manifest("Z", "1.0.0", { X: "^1.0.0" }),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/circular/i);
  });
});

// ---------------------------------------------------------------------------
// Disabled dependency degradation
// ---------------------------------------------------------------------------

describe("resolveDependencies — disabled dependency degradation", () => {
  it("produces degradation warning when dependency is disabled", () => {
    const manifests = [
      manifest("consumer", "1.0.0", { provider: "^1.0.0" }),
      manifest("provider", "1.0.0"),
    ];
    const disabledPluginIds = new Set(["provider"]);

    const result = resolveDependencies(manifests, disabledPluginIds);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degradationWarnings).toHaveLength(1);
    expect(result.value.degradationWarnings[0].pluginId).toBe("consumer");
    expect(result.value.degradationWarnings[0].disabledDependency).toBe("provider");
  });

  it("includes re-enable action in degradation warning", () => {
    const manifests = [
      manifest("consumer", "1.0.0", { provider: "^1.0.0" }),
      manifest("provider", "1.0.0"),
    ];
    const disabledPluginIds = new Set(["provider"]);

    const result = resolveDependencies(manifests, disabledPluginIds);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const warning = result.value.degradationWarnings[0];
    expect(warning.reEnableAction).toBe("provider");
    expect(warning.message).toMatch(/re-enable/i);
  });

  it("excludes disabled plugins from topological sort but keeps dependents", () => {
    const manifests = [
      manifest("consumer", "1.0.0", { provider: "^1.0.0" }),
      manifest("provider", "1.0.0"),
    ];
    const disabledPluginIds = new Set(["provider"]);

    const result = resolveDependencies(manifests, disabledPluginIds);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Both still in load order (disabled ones included for reference)
    // but consumer can still load
    expect(result.value.loadOrder).toContain("consumer");
    expect(result.value.loadOrder).toContain("provider");
  });

  it("produces no warnings when no dependencies are disabled", () => {
    const manifests = [
      manifest("consumer", "1.0.0", { provider: "^1.0.0" }),
      manifest("provider", "1.0.0"),
    ];

    const result = resolveDependencies(manifests);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degradationWarnings).toEqual([]);
  });

  it("produces warnings for multiple disabled dependencies of same plugin", () => {
    const manifests = [
      manifest("consumer", "1.0.0", { "dep-a": "^1.0.0", "dep-b": "^1.0.0" }),
      manifest("dep-a", "1.0.0"),
      manifest("dep-b", "1.0.0"),
    ];
    const disabledPluginIds = new Set(["dep-a", "dep-b"]);

    const result = resolveDependencies(manifests, disabledPluginIds);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degradationWarnings).toHaveLength(2);
    const disabledDeps = result.value.degradationWarnings.map((w) => w.disabledDependency);
    expect(disabledDeps).toContain("dep-a");
    expect(disabledDeps).toContain("dep-b");
  });
});
