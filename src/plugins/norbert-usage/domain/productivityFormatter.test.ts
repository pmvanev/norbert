import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  formatProductivity,
  EMPTY_PRODUCTIVITY,
  type AccumulatedMetric,
} from "./productivityFormatter";

// ---------------------------------------------------------------------------
// Helpers: metric builders
// ---------------------------------------------------------------------------

const buildMetric = (
  metricName: string,
  attributeKey: string,
  value: number,
): AccumulatedMetric => ({
  metricName,
  attributeKey,
  value,
});

const buildProductivityMetrics = (opts: {
  linesAdded?: number;
  linesRemoved?: number;
  commits?: number;
  pullRequests?: number;
}): ReadonlyArray<AccumulatedMetric> => {
  const metrics: AccumulatedMetric[] = [];
  if (opts.linesAdded !== undefined) {
    metrics.push(buildMetric("lines_of_code.count", "type=added", opts.linesAdded));
  }
  if (opts.linesRemoved !== undefined) {
    metrics.push(buildMetric("lines_of_code.count", "type=removed", opts.linesRemoved));
  }
  if (opts.commits !== undefined) {
    metrics.push(buildMetric("commit.count", "", opts.commits));
  }
  if (opts.pullRequests !== undefined) {
    metrics.push(buildMetric("pull_request.count", "", opts.pullRequests));
  }
  return metrics;
};

// ---------------------------------------------------------------------------
// Arbitrary: productivity metrics
// ---------------------------------------------------------------------------

const productivityMetricsArb = fc
  .record({
    linesAdded: fc.integer({ min: 0, max: 100000 }),
    linesRemoved: fc.integer({ min: 0, max: 100000 }),
    commits: fc.integer({ min: 0, max: 1000 }),
    pullRequests: fc.integer({ min: 0, max: 100 }),
  })
  .map(buildProductivityMetrics);

// ---------------------------------------------------------------------------
// Acceptance: known productivity values
// ---------------------------------------------------------------------------

describe("formatProductivity", () => {
  it("returns correct values for lines=247/89, commits=2, prs=0", () => {
    const metrics = buildProductivityMetrics({
      linesAdded: 247,
      linesRemoved: 89,
      commits: 2,
      pullRequests: 0,
    });
    const result = formatProductivity(metrics);

    expect(result.linesAdded).toBe(247);
    expect(result.linesRemoved).toBe(89);
    expect(result.netLines).toBe(158);
    expect(result.commits).toBe(2);
    expect(result.pullRequests).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it("returns empty summary for empty metrics array", () => {
    const result = formatProductivity([]);
    expect(result).toEqual(EMPTY_PRODUCTIVITY);
  });

  it("returns empty summary when no productivity metrics present", () => {
    const metrics = [buildMetric("active_time.total", "type=user", 3600)];
    const result = formatProductivity(metrics);
    expect(result).toEqual(EMPTY_PRODUCTIVITY);
  });

  // -------------------------------------------------------------------------
  // Partial data
  // -------------------------------------------------------------------------

  it("handles only commit metrics (no lines, no PRs)", () => {
    const metrics = buildProductivityMetrics({ commits: 5 });
    const result = formatProductivity(metrics);

    expect(result.commits).toBe(5);
    expect(result.linesAdded).toBe(0);
    expect(result.linesRemoved).toBe(0);
    expect(result.netLines).toBe(0);
    expect(result.pullRequests).toBe(0);
  });

  it("handles negative net lines (more removed than added)", () => {
    const metrics = buildProductivityMetrics({
      linesAdded: 10,
      linesRemoved: 50,
    });
    const result = formatProductivity(metrics);

    expect(result.netLines).toBe(-40);
  });

  // -------------------------------------------------------------------------
  // Property: netLines equals linesAdded - linesRemoved
  // -------------------------------------------------------------------------

  it("property: netLines equals linesAdded - linesRemoved", () => {
    fc.assert(
      fc.property(productivityMetricsArb, (metrics) => {
        const result = formatProductivity(metrics);
        expect(result.netLines).toBe(result.linesAdded - result.linesRemoved);
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Property: all count values are non-negative
  // -------------------------------------------------------------------------

  it("property: linesAdded, linesRemoved, commits, pullRequests are non-negative", () => {
    fc.assert(
      fc.property(productivityMetricsArb, (metrics) => {
        const result = formatProductivity(metrics);
        expect(result.linesAdded).toBeGreaterThanOrEqual(0);
        expect(result.linesRemoved).toBeGreaterThanOrEqual(0);
        expect(result.commits).toBeGreaterThanOrEqual(0);
        expect(result.pullRequests).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});
