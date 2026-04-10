/**
 * Unit tests: Session Metrics Table -- Row Grouping (Step 02-03)
 *
 * Pure functions: groupSessionRows, toggleGroupCollapsed
 *
 * Properties tested:
 * - Partition completeness: active + recent = all input rows
 * - Active correctness: every row in active group has isActive=true
 * - Recent correctness: every row in recent group has isActive=false
 * - Count consistency: activeCount matches active.length, recentCount matches recent.length
 * - Toggle involution: toggling twice returns original value
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  groupSessionRows,
  toggleGroupCollapsed,
} from "../../../../../src/plugins/norbert-session/domain/sessionMetricsTable";
import type { TableRow } from "../../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";

// ---------------------------------------------------------------------------
// Generator: arbitrary TableRow
// ---------------------------------------------------------------------------

const arbitraryTableRow: fc.Arbitrary<TableRow> = fc.record({
  sessionId: fc.uuid(),
  name: fc.string({ minLength: 1 }),
  isActive: fc.boolean(),
  cost: fc.float({ min: 0, max: 1000, noNaN: true }),
  totalTokens: fc.nat({ max: 1_000_000 }),
  burnRate: fc.float({ min: 0, max: 500, noNaN: true }),
  contextPercent: fc.float({ min: 0, max: 100, noNaN: true }),
  durationMs: fc.nat({ max: 86_400_000 }),
});

// ---------------------------------------------------------------------------
// groupSessionRows properties
// ---------------------------------------------------------------------------

describe("groupSessionRows", () => {
  it("partition completeness: active + recent = all input rows", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTableRow), (rows) => {
        const grouped = groupSessionRows(rows);
        expect(grouped.active.length + grouped.recent.length).toBe(rows.length);
      }),
    );
  });

  it("active group contains only rows with isActive=true", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTableRow), (rows) => {
        const grouped = groupSessionRows(rows);
        expect(grouped.active.every((r) => r.isActive)).toBe(true);
      }),
    );
  });

  it("recent group contains only rows with isActive=false", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTableRow), (rows) => {
        const grouped = groupSessionRows(rows);
        expect(grouped.recent.every((r) => !r.isActive)).toBe(true);
      }),
    );
  });

  it("counts match array lengths", () => {
    fc.assert(
      fc.property(fc.array(arbitraryTableRow), (rows) => {
        const grouped = groupSessionRows(rows);
        expect(grouped.activeCount).toBe(grouped.active.length);
        expect(grouped.recentCount).toBe(grouped.recent.length);
      }),
    );
  });

  it("empty input produces empty groups with zero counts", () => {
    const grouped = groupSessionRows([]);
    expect(grouped.active).toHaveLength(0);
    expect(grouped.recent).toHaveLength(0);
    expect(grouped.activeCount).toBe(0);
    expect(grouped.recentCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toggleGroupCollapsed properties
// ---------------------------------------------------------------------------

describe("toggleGroupCollapsed", () => {
  it("returns the opposite boolean value", () => {
    fc.assert(
      fc.property(fc.boolean(), (collapsed) => {
        expect(toggleGroupCollapsed(collapsed)).toBe(!collapsed);
      }),
    );
  });

  it("toggling twice is identity (involution)", () => {
    fc.assert(
      fc.property(fc.boolean(), (collapsed) => {
        expect(toggleGroupCollapsed(toggleGroupCollapsed(collapsed))).toBe(
          collapsed,
        );
      }),
    );
  });
});
