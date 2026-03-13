/**
 * Unit tests: Gauge Cluster Data Computation (Step 04-01)
 *
 * Pure function: SessionMetrics => GaugeClusterData
 *
 * Properties tested:
 * - Fuel gauge urgency transitions: normal < 70%, amber >= 70%, red >= 90%
 * - Tachometer urgency transitions: normal < 400, amber >= 400, red >= 500
 * - All numeric values are non-negative
 * - Hook health derives from hookEventCount
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
  contextWindowModel: fc.string(),
  hookEventCount: fc.nat({ max: 100_000 }),
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
// Warning cluster
// ---------------------------------------------------------------------------

describe("Warning cluster hook health", () => {
  it("reports normal when hookEventCount > 0", () => {
    const result = computeGaugeClusterData(createSnapshot({ hookEventCount: 50 }));
    expect(result.warningCluster.hookHealth).toBe("normal");
  });

  it("reports normal for zero hookEventCount (idle session)", () => {
    const result = computeGaugeClusterData(createSnapshot({ hookEventCount: 0 }));
    expect(result.warningCluster.hookHealth).toBe("normal");
  });
});
