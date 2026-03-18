/**
 * Acceptance tests: Context Window Pressure Monitoring (US-PM-005)
 *
 * Validates context utilization urgency classification, compaction
 * time estimation, and graceful handling of missing context data.
 *
 * Driving ports: pure domain functions (urgency classification,
 * compaction estimate computation)
 * These tests exercise the domain logic for context pressure,
 * not the chart rendering.
 *
 * Traces to: US-PM-005 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  createInitialMetrics,
  type SessionMetrics,
} from "../../../src/plugins/norbert-usage/domain/metricsAggregator";

import {
  classifyContextUrgency,
  computeCompactionEstimate,
} from "../../../src/plugins/norbert-usage/domain/performanceMonitor";

import {
  CONTEXT_AMBER_THRESHOLD,
  CONTEXT_RED_THRESHOLD,
} from "../../../src/plugins/norbert-usage/domain/urgencyThresholds";

// ---------------------------------------------------------------------------
// Helper: create session metrics with context values
// ---------------------------------------------------------------------------

const createSessionSnapshot = (
  overrides: Partial<SessionMetrics> & { sessionId: string },
): SessionMetrics => ({
  ...createInitialMetrics(overrides.sessionId),
  ...overrides,
});

// ---------------------------------------------------------------------------
// WALKING SKELETON: User sees context pressure with advance warning
// Traces to: US-PM-005, JS-PM-4
// ---------------------------------------------------------------------------

describe("User sees context utilization with urgency zones and compaction estimate", () => {
  it("context at 67% with known consumption rate shows estimated time to compaction", () => {
    // Given Elena is monitoring session "refactor-auth"
    // And context is at 67% (134,000 of 200,000 tokens consumed)
    const metrics = createSessionSnapshot({
      sessionId: "refactor-auth",
      contextWindowPct: 67,
      contextWindowTokens: 134000,
      contextWindowMaxTokens: 200000,
      burnRate: 312,
    });

    // When context pressure data is computed
    const urgency = classifyContextUrgency(metrics.contextWindowPct);
    const estimate = computeCompactionEstimate(metrics);

    // Then context shows normal urgency (below 70%)
    expect(urgency).toBe("normal");
    // And a compaction estimate is provided
    expect(estimate.estimatedMinutes).toBeGreaterThan(0);
    // And the estimate reflects remaining headroom
    expect(estimate.remainingTokens).toBe(66000);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Urgency Zone Classification
// Traces to: US-PM-005 AC "Amber at 70%", "Red at 90%"
// ---------------------------------------------------------------------------

describe("Context below 70% shows normal urgency", () => {
  it("context at 45% is classified as normal", () => {
    // Given session "migrate-db" has context at 45%
    // When urgency is classified
    const urgency = classifyContextUrgency(45);

    // Then the urgency is normal
    expect(urgency).toBe("normal");
  });
});

describe("Context at 70% triggers amber urgency zone", () => {
  it("context at exactly 70% is classified as amber", () => {
    // Given session "test-coverage" has context at 70%
    // When urgency is classified
    const urgency = classifyContextUrgency(70);

    // Then the urgency is amber
    expect(urgency).toBe("amber");
  });
});

describe("Context at 72% is within amber urgency zone", () => {
  it("context between 70% and 90% is classified as amber", () => {
    // Given session "test-coverage" has context at 72%
    // When urgency is classified
    const urgency = classifyContextUrgency(72);

    // Then the urgency is amber
    expect(urgency).toBe("amber");
  });
});

describe("Context at 90% triggers red urgency zone", () => {
  it("context at exactly 90% is classified as red", () => {
    // Given session "refactor-auth" has context at 90%
    // When urgency is classified
    const urgency = classifyContextUrgency(90);

    // Then the urgency is red
    expect(urgency).toBe("red");
  });
});

describe("Context at 93% is deep in red urgency zone", () => {
  it("context above 90% is classified as red", () => {
    // Given session "refactor-auth" has context at 93%
    // When urgency is classified
    const urgency = classifyContextUrgency(93);

    // Then the urgency is red
    expect(urgency).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Compaction Time Estimation
// Traces to: US-PM-005 AC "Time-to-compaction estimate"
// ---------------------------------------------------------------------------

describe("Compaction estimate calculated from remaining headroom and burn rate", () => {
  it("estimates minutes until compaction based on current consumption rate", () => {
    // Given session "refactor-auth" has consumed 134,000 of 200,000 tokens
    // And the current consumption rate is approximately 500 tokens per event
    // And events arrive at approximately 2 per second (1000 tok/s effective)
    const metrics = createSessionSnapshot({
      sessionId: "refactor-auth",
      contextWindowPct: 67,
      contextWindowTokens: 134000,
      contextWindowMaxTokens: 200000,
      burnRate: 1000,
    });

    // When compaction estimate is computed
    const estimate = computeCompactionEstimate(metrics);

    // Then estimated minutes is based on remaining tokens / burn rate
    // remaining: 66,000 tokens, at 1000 tok/s => ~66 seconds => ~1.1 minutes
    expect(estimate.estimatedMinutes).toBeCloseTo(1.1, 0);
    // And confidence is high (sufficient rate data)
    expect(estimate.confidence).toBe("high");
  });
});

describe("Compaction estimate shows low confidence when burn rate near zero", () => {
  it("returns low confidence estimate when session is idle", () => {
    // Given a session with context at 67% but zero burn rate (agent paused)
    const metrics = createSessionSnapshot({
      sessionId: "refactor-auth",
      contextWindowPct: 67,
      contextWindowTokens: 134000,
      contextWindowMaxTokens: 200000,
      burnRate: 0,
    });

    // When compaction estimate is computed
    const estimate = computeCompactionEstimate(metrics);

    // Then confidence is low because rate is near zero
    expect(estimate.confidence).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Context Data Unavailable
// Traces to: US-PM-005 AC "Graceful 'Data unavailable' message"
// ---------------------------------------------------------------------------

describe("Context data unavailable produces safe default values", () => {
  it("zero context values indicate data is not available", () => {
    // Given Marcus has a session where context data is not in event payloads
    const metrics = createSessionSnapshot({
      sessionId: "unknown-context",
      contextWindowPct: 0,
      contextWindowTokens: 0,
      contextWindowMaxTokens: 0,
    });

    // When context pressure is evaluated
    const urgency = classifyContextUrgency(metrics.contextWindowPct);

    // Then urgency is normal (zero is below all thresholds)
    expect(urgency).toBe("normal");
    // And max tokens being zero signals data unavailability to the view
    expect(metrics.contextWindowMaxTokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// BOUNDARY SCENARIOS: Threshold Boundaries
// Traces to: US-PM-005 AC "Thresholds match Gauge Cluster"
// ---------------------------------------------------------------------------

describe("Context at 69% is the last normal level before amber", () => {
  it("69% is classified as normal", () => {
    // Given context at 69% (just below amber threshold)
    // When urgency is classified
    const urgency = classifyContextUrgency(69);

    // Then urgency is normal
    expect(urgency).toBe("normal");
  });
});

describe("Context at 89% is the last amber level before red", () => {
  it("89% is classified as amber", () => {
    // Given context at 89% (just below red threshold)
    // When urgency is classified
    const urgency = classifyContextUrgency(89);

    // Then urgency is amber
    expect(urgency).toBe("amber");
  });
});

describe("Context at 100% is in red urgency zone", () => {
  it("100% is classified as red", () => {
    // Given context at 100% (fully consumed)
    // When urgency is classified
    const urgency = classifyContextUrgency(100);

    // Then urgency is red
    expect(urgency).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// PROPERTY-SHAPED SCENARIOS
// Traces to: Shared Artifacts Registry -- "Urgency thresholds consistent"
// ---------------------------------------------------------------------------

describe("@property: context urgency thresholds match Gauge Cluster thresholds", () => {
  it("amber and red thresholds are identical to Gauge Cluster values", () => {
    // Given the shared urgency threshold configuration
    // When compared to the Gauge Cluster's fuel gauge thresholds
    // Then the amber threshold matches (both 70%)
    expect(CONTEXT_AMBER_THRESHOLD).toBe(70);
    // And the red threshold matches (both 90%)
    expect(CONTEXT_RED_THRESHOLD).toBe(90);
  });
});
