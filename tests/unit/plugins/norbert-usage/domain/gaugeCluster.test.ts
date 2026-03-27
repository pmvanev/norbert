/**
 * Unit tests: Gauge Cluster Data Computation (Step 04-01)
 *
 * Pure function: SessionMetrics => GaugeClusterData
 *
 * Properties tested:
 * - Fuel gauge urgency transitions: normal < 70%, amber >= 70%, red >= 90%
 * - Tachometer urgency transitions: normal < 400, amber >= 400, red >= 500
 * - All numeric values are non-negative
 * - Hook health derives from totalEventCount
 * - Zero metrics produce safe defaults
 *
 * Behaviors: 6 (fuel zones, tacho zones, odometer passthrough, rpm passthrough,
 *              warning cluster, zero defaults)
 * Test budget: max 12 tests
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createInitialMetrics } from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import type { SessionMetrics } from "../../../../../src/plugins/norbert-usage/domain/types";
import {
  computeGaugeClusterData,
  formatContextTokenLabel,
} from "../../../../../src/plugins/norbert-usage/domain/gaugeCluster";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const sessionMetricsArb = fc.record({
  sessionId: fc.string({ minLength: 1, maxLength: 20 }),
  totalTokens: fc.nat({ max: 1_000_000 }),
  inputTokens: fc.nat({ max: 500_000 }),
  outputTokens: fc.nat({ max: 500_000 }),
  sessionCost: fc.integer({ min: 0, max: 1000 }).map((n) => n / 100),
  toolCallCount: fc.nat({ max: 10_000 }),
  activeAgentCount: fc.nat({ max: 20 }),
  contextWindowPct: fc.integer({ min: 0, max: 100 }),
  contextWindowTokens: fc.nat({ max: 1_000_000 }),
  contextWindowMaxTokens: fc.nat({ max: 1_000_000 }),
  contextWindowModel: fc.string(),
  totalEventCount: fc.nat({ max: 100_000 }),
  sessionStartedAt: fc.constant("2025-01-01T00:00:00Z"),
  lastEventAt: fc.constant("2025-01-01T00:10:00Z"),
  burnRate: fc.integer({ min: 0, max: 2000 }),
});

const createSnapshot = (overrides: Partial<SessionMetrics> = {}): SessionMetrics => ({
  ...createInitialMetrics("test-session"),
  sessionStartedAt: "2025-01-01T00:00:00Z",
  ...overrides,
});

// ---------------------------------------------------------------------------
// Fuel gauge urgency zone transitions
// ---------------------------------------------------------------------------

describe("Fuel gauge urgency zones", () => {
  it("is normal when contextWindowPct < 70", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 69 }),
        (pct) => {
          const result = computeGaugeClusterData(createSnapshot({ contextWindowPct: pct }));
          expect(result.fuelGauge.urgency).toBe("normal");
        },
      ),
    );
  });

  it("is amber when contextWindowPct >= 70 and < 90", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 70, max: 89 }),
        (pct) => {
          const result = computeGaugeClusterData(createSnapshot({ contextWindowPct: pct }));
          expect(result.fuelGauge.urgency).toBe("amber");
        },
      ),
    );
  });

  it("is red when contextWindowPct >= 90", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 90, max: 100 }),
        (pct) => {
          const result = computeGaugeClusterData(createSnapshot({ contextWindowPct: pct }));
          expect(result.fuelGauge.urgency).toBe("red");
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Tachometer urgency zone transitions
// ---------------------------------------------------------------------------

describe("Tachometer urgency zones", () => {
  it("is normal when burnRate < 400", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 399 }),
        (rate) => {
          const result = computeGaugeClusterData(createSnapshot({ burnRate: rate }));
          expect(result.tachometer.urgency).toBe("normal");
        },
      ),
    );
  });

  it("is amber when burnRate >= 400 and < 500", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 400, max: 499 }),
        (rate) => {
          const result = computeGaugeClusterData(createSnapshot({ burnRate: rate }));
          expect(result.tachometer.urgency).toBe("amber");
        },
      ),
    );
  });

  it("is red when burnRate >= 500", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 2000 }),
        (rate) => {
          const result = computeGaugeClusterData(createSnapshot({ burnRate: rate }));
          expect(result.tachometer.urgency).toBe("red");
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Value passthrough properties
// ---------------------------------------------------------------------------

describe("Gauge values are passed through from metrics", () => {
  it("all numeric gauge values are non-negative", () => {
    fc.assert(
      fc.property(sessionMetricsArb, (metrics) => {
        const result = computeGaugeClusterData(metrics);
        expect(result.tachometer.value).toBeGreaterThanOrEqual(0);
        expect(result.fuelGauge.value).toBeGreaterThanOrEqual(0);
        expect(result.odometer.value).toBeGreaterThanOrEqual(0);
        expect(result.rpmCounter.value).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("passes burnRate to tachometer value", () => {
    const result = computeGaugeClusterData(createSnapshot({ burnRate: 250 }));
    expect(result.tachometer.value).toBe(250);
  });

  it("passes contextWindowPct to fuel gauge value", () => {
    const result = computeGaugeClusterData(createSnapshot({ contextWindowPct: 45 }));
    expect(result.fuelGauge.value).toBe(45);
  });

  it("passes sessionCost to odometer value", () => {
    const result = computeGaugeClusterData(createSnapshot({ sessionCost: 1.23 }));
    expect(result.odometer.value).toBeCloseTo(1.23);
  });

  it("passes activeAgentCount to rpmCounter value", () => {
    const result = computeGaugeClusterData(createSnapshot({ activeAgentCount: 3 }));
    expect(result.rpmCounter.value).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Fuel gauge token label
// ---------------------------------------------------------------------------

describe("Fuel gauge token label", () => {
  it("shows 'Xk / Yk tokens' when maxTokens > 0", () => {
    const label = formatContextTokenLabel(50000, 200000);
    expect(label).toBe("50k / 200k tokens");
  });

  it("is empty when maxTokens is 0", () => {
    const label = formatContextTokenLabel(50000, 0);
    expect(label).toBe("");
  });

  it("rounds to nearest thousand", () => {
    const label = formatContextTokenLabel(50500, 199500);
    expect(label).toBe("51k / 200k tokens");
  });

  it("fuel gauge data includes tokenLabel from metrics", () => {
    const result = computeGaugeClusterData(createSnapshot({
      contextWindowPct: 45,
      contextWindowTokens: 90000,
      contextWindowMaxTokens: 200000,
    }));
    expect(result.fuelGauge.tokenLabel).toBe("90k / 200k tokens");
  });

  it("fuel gauge tokenLabel is empty when max is unknown", () => {
    const result = computeGaugeClusterData(createSnapshot({
      contextWindowPct: 45,
      contextWindowTokens: 0,
      contextWindowMaxTokens: 0,
    }));
    expect(result.fuelGauge.tokenLabel).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Warning cluster
// ---------------------------------------------------------------------------

describe("Warning cluster data health", () => {
  const recentTime = "2026-03-27T10:00:50Z";
  const now = new Date("2026-03-27T10:01:00Z"); // 10s after recentTime

  it("reports healthy when events are flowing and recent", () => {
    const result = computeGaugeClusterData(
      createSnapshot({ totalEventCount: 50, lastEventAt: recentTime }),
      undefined,
      now,
    );
    expect(result.warningCluster.dataHealth).toBe("healthy");
  });

  it("reports degraded when events exist but are stale (beyond 60s threshold)", () => {
    const staleTime = "2026-03-27T09:59:50Z"; // 70s before now
    const result = computeGaugeClusterData(
      createSnapshot({ totalEventCount: 15, lastEventAt: staleTime }),
      undefined,
      now,
    );
    expect(result.warningCluster.dataHealth).toBe("degraded");
  });

  it("reports no-data when totalEventCount is 0", () => {
    const result = computeGaugeClusterData(
      createSnapshot({ totalEventCount: 0 }),
      undefined,
      now,
    );
    expect(result.warningCluster.dataHealth).toBe("no-data");
  });

  it("healthy at exactly the staleness threshold boundary (60s)", () => {
    // lastEventAt = now - 60s exactly => elapsed = 60000ms <= 60000ms threshold => healthy
    const boundaryTime = "2026-03-27T10:00:00Z";
    const result = computeGaugeClusterData(
      createSnapshot({ totalEventCount: 10, lastEventAt: boundaryTime }),
      undefined,
      now,
    );
    expect(result.warningCluster.dataHealth).toBe("healthy");
  });

  it("degraded at one millisecond beyond staleness threshold", () => {
    // 60001ms before now
    const justBeyond = "2026-03-27T09:59:59.999Z";
    const result = computeGaugeClusterData(
      createSnapshot({ totalEventCount: 10, lastEventAt: justBeyond }),
      undefined,
      now,
    );
    expect(result.warningCluster.dataHealth).toBe("degraded");
  });

  it("property: dataHealth is always one of the three valid states", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100_000 }),
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
        (eventCount, lastEvent, nowDate) => {
          const result = computeGaugeClusterData(
            createSnapshot({ totalEventCount: eventCount, lastEventAt: lastEvent.toISOString() }),
            undefined,
            nowDate,
          );
          expect(["healthy", "degraded", "no-data"]).toContain(result.warningCluster.dataHealth);
        },
      ),
    );
  });
});
