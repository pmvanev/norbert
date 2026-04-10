/**
 * Unit tests: Session Metrics Table Sorting (Step 02-01)
 *
 * Pure functions: sortTableRows, applySortToggle
 *
 * Properties tested:
 * - sortTableRows preserves array length (no rows added/removed)
 * - sortTableRows is idempotent (sorting twice = sorting once)
 * - sortTableRows sorts numerically for numeric columns
 * - sortTableRows places active sessions above completed when column values equal
 * - applySortToggle flips direction when clicking same column
 * - applySortToggle resets to ascending when clicking different column
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type {
  TableRow,
  SortState,
  ColumnId,
  SortDirection,
} from "../../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";
import {
  sortTableRows,
  applySortToggle,
} from "../../../../../src/plugins/norbert-session/domain/sessionMetricsTable";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const columnIdArb: fc.Arbitrary<ColumnId> = fc.constantFrom(
  "name",
  "cost",
  "totalTokens",
  "burnRate",
  "contextPercent",
  "durationMs",
);

const sortDirectionArb: fc.Arbitrary<SortDirection> = fc.constantFrom("asc", "desc");

const tableRowArb: fc.Arbitrary<TableRow> = fc.record({
  sessionId: fc.string({ minLength: 1, maxLength: 20 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  isActive: fc.boolean(),
  cost: fc.double({ min: 0, max: 1000, noNaN: true }),
  totalTokens: fc.integer({ min: 0, max: 10_000_000 }),
  burnRate: fc.double({ min: 0, max: 500, noNaN: true }),
  contextPercent: fc.double({ min: 0, max: 100, noNaN: true }),
  durationMs: fc.integer({ min: 0, max: 24 * 60 * 60_000 }),
});

function makeRow(overrides: Partial<TableRow> & { sessionId: string }): TableRow {
  return {
    name: overrides.sessionId,
    isActive: false,
    cost: 0,
    totalTokens: 0,
    burnRate: 0,
    contextPercent: 0,
    durationMs: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sortTableRows: PROPERTY -- preserves array length
// ---------------------------------------------------------------------------

describe("sortTableRows", () => {
  it("preserves array length for any column and direction", () => {
    fc.assert(
      fc.property(
        fc.array(tableRowArb, { minLength: 0, maxLength: 10 }),
        columnIdArb,
        sortDirectionArb,
        (rows, columnId, direction) => {
          const sorted = sortTableRows(rows, columnId, direction);
          expect(sorted).toHaveLength(rows.length);
        },
      ),
    );
  });

  // ---------------------------------------------------------------------------
  // PROPERTY -- idempotent (sorting twice = sorting once)
  // ---------------------------------------------------------------------------

  it("is idempotent: sorting twice yields same result as sorting once", () => {
    fc.assert(
      fc.property(
        fc.array(tableRowArb, { minLength: 0, maxLength: 10 }),
        columnIdArb,
        sortDirectionArb,
        (rows, columnId, direction) => {
          const once = sortTableRows(rows, columnId, direction);
          const twice = sortTableRows(once, columnId, direction);
          expect(twice).toEqual(once);
        },
      ),
    );
  });

  // ---------------------------------------------------------------------------
  // PROPERTY -- does not mutate input
  // ---------------------------------------------------------------------------

  it("does not mutate the input array", () => {
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "b", cost: 2 }),
      makeRow({ sessionId: "a", cost: 1 }),
    ];
    const original = [...rows];
    sortTableRows(rows, "cost", "asc");
    expect(rows).toEqual(original);
  });

  // ---------------------------------------------------------------------------
  // EXAMPLE -- numeric sort for cost ascending
  // ---------------------------------------------------------------------------

  it("sorts cost numerically ascending", () => {
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s1", cost: 1.24 }),
      makeRow({ sessionId: "s2", cost: 0.08 }),
      makeRow({ sessionId: "s3", cost: 0.52 }),
    ];
    const sorted = sortTableRows(rows, "cost", "asc");
    expect(sorted.map((r) => r.cost)).toEqual([0.08, 0.52, 1.24]);
  });

  // ---------------------------------------------------------------------------
  // EXAMPLE -- numeric sort for cost descending
  // ---------------------------------------------------------------------------

  it("sorts cost numerically descending", () => {
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s1", cost: 0.08 }),
      makeRow({ sessionId: "s2", cost: 1.24 }),
      makeRow({ sessionId: "s3", cost: 0.52 }),
    ];
    const sorted = sortTableRows(rows, "cost", "desc");
    expect(sorted.map((r) => r.cost)).toEqual([1.24, 0.52, 0.08]);
  });

  // ---------------------------------------------------------------------------
  // EXAMPLE -- name sorts lexicographically
  // ---------------------------------------------------------------------------

  it("sorts name column lexicographically", () => {
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s3", name: "norbert" }),
      makeRow({ sessionId: "s1", name: "api-server" }),
      makeRow({ sessionId: "s2", name: "docs-site" }),
    ];
    const sorted = sortTableRows(rows, "name", "asc");
    expect(sorted.map((r) => r.name)).toEqual(["api-server", "docs-site", "norbert"]);
  });

  // ---------------------------------------------------------------------------
  // EXAMPLE -- active sessions sort above completed when sorting by numeric column
  // ---------------------------------------------------------------------------

  it("active sessions sort above completed, each group ordered by column value", () => {
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "completed-cheap", isActive: false, cost: 0.10 }),
      makeRow({ sessionId: "active-expensive", isActive: true, cost: 2.00 }),
      makeRow({ sessionId: "active-cheap", isActive: true, cost: 0.50 }),
      makeRow({ sessionId: "completed-expensive", isActive: false, cost: 5.00 }),
    ];
    const sorted = sortTableRows(rows, "cost", "asc");

    // Active group first, sorted ascending by cost
    expect(sorted[0].sessionId).toBe("active-cheap");
    expect(sorted[1].sessionId).toBe("active-expensive");
    // Completed group second, sorted ascending by cost
    expect(sorted[2].sessionId).toBe("completed-cheap");
    expect(sorted[3].sessionId).toBe("completed-expensive");
  });

  // ---------------------------------------------------------------------------
  // EXAMPLE -- zero values handled correctly
  // ---------------------------------------------------------------------------

  it("zero values sort correctly among positive values", () => {
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s1", burnRate: 150 }),
      makeRow({ sessionId: "s2", burnRate: 0 }),
      makeRow({ sessionId: "s3", burnRate: 12 }),
    ];
    const sorted = sortTableRows(rows, "burnRate", "asc");
    expect(sorted.map((r) => r.burnRate)).toEqual([0, 12, 150]);
  });
});

// ---------------------------------------------------------------------------
// applySortToggle
// ---------------------------------------------------------------------------

describe("applySortToggle", () => {
  // ---------------------------------------------------------------------------
  // PROPERTY -- clicking same column always flips direction
  // ---------------------------------------------------------------------------

  it("flips direction when clicking same column", () => {
    fc.assert(
      fc.property(columnIdArb, sortDirectionArb, (columnId, direction) => {
        const current: SortState = { columnId, direction };
        const next = applySortToggle(current, columnId);
        expect(next.columnId).toBe(columnId);
        expect(next.direction).toBe(direction === "asc" ? "desc" : "asc");
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // PROPERTY -- clicking different column resets to ascending
  // ---------------------------------------------------------------------------

  it("resets to ascending when clicking different column", () => {
    fc.assert(
      fc.property(
        columnIdArb,
        sortDirectionArb,
        columnIdArb.filter((c) => true), // will filter in the check
        (currentColumn, direction, newColumn) => {
          fc.pre(currentColumn !== newColumn);
          const current: SortState = { columnId: currentColumn, direction };
          const next = applySortToggle(current, newColumn);
          expect(next.columnId).toBe(newColumn);
          expect(next.direction).toBe("asc");
        },
      ),
    );
  });

  // ---------------------------------------------------------------------------
  // PROPERTY -- double toggle returns to original state
  // ---------------------------------------------------------------------------

  it("double toggle on same column returns to original direction", () => {
    fc.assert(
      fc.property(columnIdArb, sortDirectionArb, (columnId, direction) => {
        const original: SortState = { columnId, direction };
        const toggled = applySortToggle(original, columnId);
        const doubleToggled = applySortToggle(toggled, columnId);
        expect(doubleToggled).toEqual(original);
      }),
    );
  });
});
