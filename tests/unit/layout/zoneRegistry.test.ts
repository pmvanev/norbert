/**
 * Unit tests: Zone Registry
 *
 * Validates the zone registry as a keyed map with the invariant
 * that the Main zone is always present and cannot be removed.
 * Uses property-based testing for domain invariants.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createZoneRegistry,
  getZone,
  addZone,
  removeZone,
  listZoneNames,
  setZoneView,
} from "../../../src/layout/zoneRegistry";
import type { ZoneState } from "../../../src/layout/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const zoneNameArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((name) => name !== "main" && name.trim().length > 0);

const zoneStateArb: fc.Arbitrary<ZoneState> = fc.record({
  viewId: fc.option(fc.string({ minLength: 1 }), { nil: null }),
  pluginId: fc.option(fc.string({ minLength: 1 }), { nil: null }),
});

// ---------------------------------------------------------------------------
// createZoneRegistry
// ---------------------------------------------------------------------------

describe("createZoneRegistry", () => {
  it("creates a registry with main zone present", () => {
    const registry = createZoneRegistry();
    const mainZone = getZone(registry, "main");
    expect(mainZone).toBeDefined();
    expect(mainZone!.viewId).toBeNull();
    expect(mainZone!.pluginId).toBeNull();
  });

  it("main is the only zone in a fresh registry", () => {
    const registry = createZoneRegistry();
    const names = listZoneNames(registry);
    expect(names).toEqual(["main"]);
  });
});

// ---------------------------------------------------------------------------
// addZone
// ---------------------------------------------------------------------------

describe("addZone", () => {
  it("adds a new zone to the registry", () => {
    const registry = createZoneRegistry();
    const updated = addZone(registry, "secondary", {
      viewId: "session-detail",
      pluginId: "core",
    });
    const zone = getZone(updated, "secondary");
    expect(zone).toBeDefined();
    expect(zone!.viewId).toBe("session-detail");
  });

  it("does not mutate the original registry", () => {
    const registry = createZoneRegistry();
    addZone(registry, "secondary", { viewId: null, pluginId: null });
    expect(getZone(registry, "secondary")).toBeUndefined();
  });

  // Property: adding a zone preserves main
  it("preserves main zone for any added zone name", () => {
    fc.assert(
      fc.property(zoneNameArb, zoneStateArb, (name, state) => {
        const registry = createZoneRegistry();
        const updated = addZone(registry, name, state);
        expect(getZone(updated, "main")).toBeDefined();
        expect(getZone(updated, name)).toEqual(state);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// removeZone
// ---------------------------------------------------------------------------

describe("removeZone", () => {
  it("removes a non-main zone", () => {
    const registry = addZone(createZoneRegistry(), "secondary", {
      viewId: null,
      pluginId: null,
    });
    const updated = removeZone(registry, "secondary");
    expect(getZone(updated, "secondary")).toBeUndefined();
  });

  it("refuses to remove main zone", () => {
    const registry = createZoneRegistry();
    const updated = removeZone(registry, "main");
    expect(getZone(updated, "main")).toBeDefined();
  });

  it("does not mutate the original registry", () => {
    const registry = addZone(createZoneRegistry(), "secondary", {
      viewId: null,
      pluginId: null,
    });
    removeZone(registry, "secondary");
    expect(getZone(registry, "secondary")).toBeDefined();
  });

  // Property: removing any zone never removes main
  it("never removes main regardless of zone name attempted", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 20 }), (name) => {
        const registry = createZoneRegistry();
        const updated = removeZone(registry, name);
        expect(getZone(updated, "main")).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// setZoneView
// ---------------------------------------------------------------------------

describe("setZoneView", () => {
  it("updates viewId and pluginId for an existing zone", () => {
    const registry = createZoneRegistry();
    const updated = setZoneView(registry, "main", "session-list", "core");
    const zone = getZone(updated, "main");
    expect(zone!.viewId).toBe("session-list");
    expect(zone!.pluginId).toBe("core");
  });

  it("returns unchanged registry when zone does not exist", () => {
    const registry = createZoneRegistry();
    const updated = setZoneView(registry, "nonexistent", "view", "plugin");
    expect(updated).toEqual(registry);
  });

  it("does not mutate the original registry", () => {
    const registry = createZoneRegistry();
    setZoneView(registry, "main", "session-list", "core");
    expect(getZone(registry, "main")!.viewId).toBeNull();
  });
});
