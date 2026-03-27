/**
 * Acceptance tests: Gauge Cluster Dashboard View (US-003)
 *
 * Validates that the Gauge Cluster computes correct metric card data
 * from SessionMetrics, including urgency zone transitions for fuel
 * gauge and tachometer.
 *
 * Driving ports: pure domain functions (metrics -> gauge card data)
 * These tests exercise the data transformation that feeds the 5-card
 * gauge cluster, not the React rendering.
 *
 * Traces to: US-003 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  createInitialMetrics,
  type SessionMetrics,
} from "../../../src/plugins/norbert-usage/domain/metricsAggregator";
import {
  computeGaugeClusterData,
  type GaugeClusterData,
} from "../../../src/plugins/norbert-usage/domain/gaugeCluster";

// ---------------------------------------------------------------------------
// Helper: create metrics snapshot with specific values
// ---------------------------------------------------------------------------

const createMetricsSnapshot = (overrides: Partial<SessionMetrics> = {}): SessionMetrics => ({
  ...createInitialMetrics("test-session"),
  sessionId: "refactor-auth",
  sessionStartedAt: "2025-01-01T00:00:00Z",
  ...overrides,
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Gauge Cluster Data Computation
// ---------------------------------------------------------------------------

describe("Gauge Cluster displays all instrument data for active session", () => {
  it("computes tachometer, fuel gauge, odometer, RPM, warning, and clock values", () => {
    // Given an active session with known metrics:
    // 150 tok/s burn rate, 25% context, $0.83 cost, 1 agent, healthy hooks, 12m 30s elapsed
    const metrics = createMetricsSnapshot({
      burnRate: 150,
      contextWindowPct: 25,
      sessionCost: 0.83,
      activeAgentCount: 1,
      totalEventCount: 50,
      lastEventAt: "2025-01-01T00:12:30Z",
    });

    // When gauge cluster data is computed (now is shortly after last event)
    const now = new Date("2025-01-01T00:12:35Z");
    const gaugeData = computeGaugeClusterData(metrics, undefined, now);

    // Then the tachometer shows 150 tok/s
    expect(gaugeData.tachometer.value).toBe(150);
    expect(gaugeData.tachometer.urgency).toBe("normal");

    // And the fuel gauge shows 25% in normal zone
    expect(gaugeData.fuelGauge.value).toBe(25);
    expect(gaugeData.fuelGauge.urgency).toBe("normal");

    // And the odometer shows $0.83
    expect(gaugeData.odometer.value).toBeCloseTo(0.83);

    // And the RPM counter shows 1 agent
    expect(gaugeData.rpmCounter.value).toBe(1);

    // And the warning cluster shows healthy status (events flowing, recent)
    expect(gaugeData.warningCluster.dataHealth).toBe("healthy");
  });
});

describe("Fuel gauge transitions to amber at 70% context utilization", () => {
  it("context at 70% triggers amber urgency zone", () => {
    // Given a session with context utilization climbing
    const metrics = createMetricsSnapshot({
      contextWindowPct: 70,
    });

    // When gauge cluster data is computed
    const gaugeData = computeGaugeClusterData(metrics);

    // Then the fuel gauge is in the amber zone
    expect(gaugeData.fuelGauge.urgency).toBe("amber");
  });
});

describe("Fuel gauge transitions to red at 90% context utilization", () => {
  it("context at 90% triggers red urgency zone", () => {
    // Given a session with context utilization at 90%
    const metrics = createMetricsSnapshot({
      contextWindowPct: 90,
    });

    // When gauge cluster data is computed
    const gaugeData = computeGaugeClusterData(metrics);

    // Then the fuel gauge is in the red zone
    expect(gaugeData.fuelGauge.urgency).toBe("red");
  });
});

describe("Tachometer enters redline at sustained high burn rate", () => {
  it("burn rate above redline threshold triggers red urgency", () => {
    // Given a session with token burn rate at 520 tok/s
    // (above the default redline threshold)
    const metrics = createMetricsSnapshot({
      burnRate: 520,
    });

    // When gauge cluster data is computed
    const gaugeData = computeGaugeClusterData(metrics);

    // Then the tachometer is in the redline zone
    expect(gaugeData.tachometer.urgency).toBe("red");
  });
});

describe("Fuel gauge displays both percentage and token count for active session", () => {
  it("shows token label when context window token counts are known", () => {
    // Given a session with known context usage in tokens
    const metrics = createMetricsSnapshot({
      contextWindowPct: 45,
      contextWindowTokens: 90000,
      contextWindowMaxTokens: 200000,
    });

    // When gauge cluster data is computed
    const gaugeData = computeGaugeClusterData(metrics);

    // Then the fuel gauge shows percentage
    expect(gaugeData.fuelGauge.value).toBe(45);

    // And the token label shows current/max
    expect(gaugeData.fuelGauge.tokenLabel).toBe("90k / 200k tokens");
  });

  it("omits token label when max is unknown", () => {
    // Given a session where context token counts are unavailable
    const metrics = createMetricsSnapshot({
      contextWindowPct: 45,
      contextWindowTokens: 0,
      contextWindowMaxTokens: 0,
    });

    // When gauge cluster data is computed
    const gaugeData = computeGaugeClusterData(metrics);

    // Then no token label is shown
    expect(gaugeData.fuelGauge.tokenLabel).toBe("");
  });
});

describe("Gauge Cluster handles zero metrics for idle session", () => {
  it("all instruments show zero or default values when no events received", () => {
    // Given a newly started session with no events yet
    const metrics = createInitialMetrics("idle-session");

    // When gauge cluster data is computed
    const gaugeData = computeGaugeClusterData(metrics);

    // Then all instruments show safe default values
    expect(gaugeData.tachometer.value).toBe(0);
    expect(gaugeData.fuelGauge.value).toBe(0);
    expect(gaugeData.fuelGauge.urgency).toBe("normal");
    expect(gaugeData.odometer.value).toBe(0);
    expect(gaugeData.rpmCounter.value).toBe(0);
  });
});
