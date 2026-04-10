/**
 * Acceptance tests: Session Metrics Table -- Status Bar
 *
 * Validates the aggregate status bar showing total session count,
 * total cost, and total tokens across all visible sessions.
 *
 * Driving ports:
 *   - computeStatusBarData(visibleRows) -> StatusBarData
 *   - formatCostColumn(cost) -> string (from step 01-01)
 *   - formatTokenColumn(tokens) -> string (from step 01-01)
 *
 * Traces to: Milestone 4 -- Status Bar
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeStatusBarData,
  formatCostColumn,
  formatTokenColumn,
} from "../../../../src/plugins/norbert-session/domain/sessionMetricsTable";
import type { TableRow } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";
import { makeTableRow as makeRow } from "./fixtures";

// ---------------------------------------------------------------------------
// AGGREGATE TOTALS
// ---------------------------------------------------------------------------

describe("Status bar shows totals across visible sessions", () => {
  it("session count, total cost, and total tokens computed from visible rows", () => {
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s-1", cost: 1.24, totalTokens: 142500 }),
      makeRow({ sessionId: "s-2", cost: 0.08, totalTokens: 9300 }),
      makeRow({ sessionId: "s-3", cost: 0.52, totalTokens: 61000 }),
      makeRow({ sessionId: "s-4", cost: 0.83, totalTokens: 42000 }),
      makeRow({ sessionId: "s-5", cost: 0.80, totalTokens: 30200 }),
    ];

    const result = computeStatusBarData(rows);

    expect(result.sessionCount).toBe(5);
    expect(result.totalCost).toBeCloseTo(3.47, 2);
    expect(result.totalTokens).toBe(285000);
    expect(formatCostColumn(result.totalCost)).toBe("$3.47");
    expect(formatTokenColumn(result.totalTokens)).toBe("285.0K");
  });
});

// ---------------------------------------------------------------------------
// FILTER INTERACTION
// ---------------------------------------------------------------------------

describe("Status bar updates when time filter changes", () => {
  it("aggregates recompute for new set of visible rows", () => {
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "f-1", cost: 1.24 }),
      makeRow({ sessionId: "f-2", cost: 0.08 }),
      makeRow({ sessionId: "f-3", cost: 0.78 }),
    ];

    const result = computeStatusBarData(rows);

    expect(result.sessionCount).toBe(3);
    expect(result.totalCost).toBeCloseTo(2.10, 2);
  });
});

// ---------------------------------------------------------------------------
// REAL-TIME UPDATE
// ---------------------------------------------------------------------------

describe("Status bar updates as session costs change", () => {
  it("recomputing after cost increase reflects new total", () => {
    const originalRows: readonly TableRow[] = [
      makeRow({ sessionId: "s-1", cost: 1.24, totalTokens: 142500 }),
      makeRow({ sessionId: "s-2", cost: 0.08, totalTokens: 9300 }),
      makeRow({ sessionId: "s-3", cost: 0.52, totalTokens: 61000 }),
      makeRow({ sessionId: "s-4", cost: 0.83, totalTokens: 42000 }),
      makeRow({ sessionId: "s-5", cost: 0.80, totalTokens: 30200 }),
    ];

    // One session's cost increases by $0.15
    const updatedRows: readonly TableRow[] = [
      makeRow({ sessionId: "s-1", cost: 1.39, totalTokens: 142500 }),
      makeRow({ sessionId: "s-2", cost: 0.08, totalTokens: 9300 }),
      makeRow({ sessionId: "s-3", cost: 0.52, totalTokens: 61000 }),
      makeRow({ sessionId: "s-4", cost: 0.83, totalTokens: 42000 }),
      makeRow({ sessionId: "s-5", cost: 0.80, totalTokens: 30200 }),
    ];

    const result = computeStatusBarData(updatedRows);

    expect(result.totalCost).toBeCloseTo(3.62, 2);
  });
});

// ---------------------------------------------------------------------------
// ERROR PATH: Empty state
// ---------------------------------------------------------------------------

describe("Status bar shows zeros when no sessions are visible", () => {
  it("empty visible rows produce zero aggregates", () => {
    const result = computeStatusBarData([]);

    expect(result.sessionCount).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.totalTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: Sum consistency
// ---------------------------------------------------------------------------

// @property
describe("Status bar total cost equals sum of individual session costs", () => {
  it("for any set of rows, aggregate cost === sum of row costs", () => {
    const tableRowArb = fc.record({
      sessionId: fc.string({ minLength: 1, maxLength: 10 }),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      isActive: fc.boolean(),
      cost: fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
      totalTokens: fc.nat({ max: 10_000_000 }),
      burnRate: fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
      contextPercent: fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
      durationMs: fc.nat({ max: 86_400_000 }),
      inputTokens: fc.nat({ max: 1_000_000 }),
      outputTokens: fc.nat({ max: 1_000_000 }),
      cacheReadTokens: fc.nat({ max: 1_000_000 }),
      activeAgents: fc.nat({ max: 10 }),
      totalEventCount: fc.nat({ max: 10_000 }),
      version: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 10 })),
      platform: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 10 })),
    });

    fc.assert(
      fc.property(fc.array(tableRowArb, { maxLength: 50 }), (rows) => {
        const result = computeStatusBarData(rows);
        const expectedCost = rows.reduce((sum, row) => sum + row.cost, 0);
        const expectedTokens = rows.reduce((sum, row) => sum + row.totalTokens, 0);

        expect(result.sessionCount).toBe(rows.length);
        // Cents-based rounding guarantees 2dp display accuracy, not 5dp float precision
        expect(result.totalCost).toBeCloseTo(expectedCost, 2);
        expect(result.totalTokens).toBe(expectedTokens);
      }),
      { numRuns: 200 },
    );
  });
});
