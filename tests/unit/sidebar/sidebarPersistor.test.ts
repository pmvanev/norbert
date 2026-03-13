/**
 * Unit tests: Sidebar Persistor — serialization/deserialization roundtrip
 *
 * The persistor converts SidebarState to/from JSON strings.
 * Persistence to filesystem is an adapter concern (not tested here).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { SidebarItem, SidebarState } from "../../../src/sidebar/types";
import {
  serializeSidebarState,
  deserializeSidebarState,
} from "../../../src/sidebar/sidebarPersistor";
import {
  createDefaultSidebarState,
  toggleVisibility,
  reorderItem,
} from "../../../src/sidebar/sidebarManager";
import type { ViewRegistration } from "../../../src/plugins/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeView = (id: string): ViewRegistration => ({
  id,
  pluginId: `plugin-${id}`,
  label: id.charAt(0).toUpperCase() + id.slice(1),
  icon: id,
  primaryView: false,
  minWidth: 200,
  minHeight: 100,
  floatMetric: null,
});

const testViews: readonly ViewRegistration[] = [
  makeView("dashboard"),
  makeView("sessions"),
  makeView("agents"),
  makeView("notifications"),
  makeView("settings"),
];

const pinnedIds = ["notifications", "settings"];

// ---------------------------------------------------------------------------
// Roundtrip properties
// ---------------------------------------------------------------------------

describe("serializeSidebarState / deserializeSidebarState", () => {
  it("roundtrip preserves default state", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const restored = deserializeSidebarState(serializeSidebarState(state));
    expect(restored).toEqual(state);
  });

  it("roundtrip preserves customized state", () => {
    let state = createDefaultSidebarState(testViews, pinnedIds);
    state = toggleVisibility(state, "agents");
    state = reorderItem(state, "sessions", 0);

    const restored = deserializeSidebarState(serializeSidebarState(state));
    expect(restored).toEqual(state);
  });

  it("serializes to valid JSON string", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const json = serializeSidebarState(state);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
