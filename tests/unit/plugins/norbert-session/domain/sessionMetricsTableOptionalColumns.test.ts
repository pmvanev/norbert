/**
 * Unit tests: Optional columns — toggleColumn, getAvailableOptionalColumns, formatCacheHitPct
 *
 * Driving ports tested through public API. Pure function tests.
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
  it("returns exactly 7 column definitions", () => {
    const columns = getAvailableOptionalColumns();
    expect(columns).toHaveLength(7);
  });

  it("each column has an id and a non-empty label", () => {
    const columns = getAvailableOptionalColumns();
    for (const col of columns) {
      expect(col.id).toBeTruthy();
      expect(col.label).toBeTruthy();
      expect(typeof col.id).toBe("string");
      expect(typeof col.label).toBe("string");
    }
  });

  it("column IDs match the 7 expected optional columns", () => {
    const columns = getAvailableOptionalColumns();
    const ids = columns.map((c) => c.id);
    expect(ids).toEqual([
      "version",
      "platform",
      "inputTokens",
      "outputTokens",
      "cacheHitPct",
      "activeAgents",
      "events",
    ]);
  });
});

// ---------------------------------------------------------------------------
// toggleColumn
// ---------------------------------------------------------------------------

describe("toggleColumn", () => {
  it("adds column when absent from visible set", () => {
    const visible: readonly OptionalColumnId[] = [];
    const result = toggleColumn(visible, "version");
    expect(result).toEqual(["version"]);
  });

  it("removes column when present in visible set", () => {
    const visible: readonly OptionalColumnId[] = ["version", "platform"];
    const result = toggleColumn(visible, "platform");
    expect(result).toEqual(["version"]);
  });

  it("preserves order of other columns when removing", () => {
    const visible: readonly OptionalColumnId[] = ["version", "platform", "events"];
    const result = toggleColumn(visible, "platform");
    expect(result).toEqual(["version", "events"]);
  });

  it("appends new column at end when adding", () => {
    const visible: readonly OptionalColumnId[] = ["version"];
    const result = toggleColumn(visible, "events");
    expect(result).toEqual(["version", "events"]);
  });

  it("does not mutate input array", () => {
    const visible: readonly OptionalColumnId[] = ["version"];
    toggleColumn(visible, "platform");
    expect(visible).toEqual(["version"]);
  });
});

// ---------------------------------------------------------------------------
// formatCacheHitPct
// ---------------------------------------------------------------------------

describe("formatCacheHitPct", () => {
  it("formats cache hit as percentage of total tokens", () => {
    expect(formatCacheHitPct(40_000, 100_000)).toBe("40%");
  });

  it("returns 0% when total tokens is zero", () => {
    expect(formatCacheHitPct(0, 0)).toBe("0%");
  });

  it("returns 0% when cache read is zero but total is positive", () => {
    expect(formatCacheHitPct(0, 50_000)).toBe("0%");
  });

  it("rounds to nearest integer percentage", () => {
    expect(formatCacheHitPct(1, 3)).toBe("33%");
  });

  it("returns 100% when all tokens are cache reads", () => {
    expect(formatCacheHitPct(100_000, 100_000)).toBe("100%");
  });
});
