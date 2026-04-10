/**
 * Unit tests: Optional columns — toggleColumn, getAvailableOptionalColumns, formatCacheHitPct
 *
 * Driving ports tested through public API. Pure function tests.
 * Consolidated per test budget: parametrized input variations.
 */

import { describe, it, expect } from "vitest";
import type { OptionalColumnId } from "../../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";
import {
  getAvailableOptionalColumns,
  toggleColumn,
  formatCacheHitPct,
} from "../../../../../src/plugins/norbert-session/domain/sessionMetricsTable";

// ---------------------------------------------------------------------------
// getAvailableOptionalColumns
// ---------------------------------------------------------------------------

describe("getAvailableOptionalColumns", () => {
  it("returns 7 columns with expected IDs and non-empty labels", () => {
    const columns = getAvailableOptionalColumns();
    expect(columns).toHaveLength(7);
    expect(columns.map((c) => c.id)).toEqual([
      "version", "platform", "inputTokens", "outputTokens",
      "cacheHitPct", "activeAgents", "events",
    ]);
    for (const col of columns) {
      expect(col.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// toggleColumn
// ---------------------------------------------------------------------------

describe("toggleColumn", () => {
  it.each<{ visible: OptionalColumnId[]; toggle: OptionalColumnId; expected: OptionalColumnId[] }>([
    { visible: [], toggle: "version", expected: ["version"] },
    { visible: ["version"], toggle: "events", expected: ["version", "events"] },
  ])("adds $toggle when absent → $expected", ({ visible, toggle, expected }) => {
    expect(toggleColumn(visible, toggle)).toEqual(expected);
  });

  it.each<{ visible: OptionalColumnId[]; toggle: OptionalColumnId; expected: OptionalColumnId[] }>([
    { visible: ["version", "platform"], toggle: "platform", expected: ["version"] },
    { visible: ["version", "platform", "events"], toggle: "platform", expected: ["version", "events"] },
  ])("removes $toggle when present → $expected", ({ visible, toggle, expected }) => {
    expect(toggleColumn(visible, toggle)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// formatCacheHitPct
// ---------------------------------------------------------------------------

describe("formatCacheHitPct", () => {
  it.each([
    [40_000, 100_000, "40%"],
    [0, 0, "0%"],
    [0, 50_000, "0%"],
    [1, 3, "33%"],
    [100_000, 100_000, "100%"],
  ])("formatCacheHitPct(%i, %i) → %s", (cacheRead, total, expected) => {
    expect(formatCacheHitPct(cacheRead, total)).toBe(expected);
  });
});
