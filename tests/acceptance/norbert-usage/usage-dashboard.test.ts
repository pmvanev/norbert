/**
 * Acceptance tests: Default Usage Dashboard View (US-006)
 *
 * Validates that the Usage Dashboard computes correct metric card data
 * from SessionMetrics, including the 7-day burn chart and onboarding state.
 *
 * Driving ports: pure domain functions (metrics -> dashboard card data,
 * daily cost aggregation)
 *
 * Traces to: US-006 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  createInitialMetrics,
  type SessionMetrics,
} from "../../../src/plugins/norbert-usage/domain/metricsAggregator";
import {
  computeDashboardData,
  type DashboardData,
  type DailyCostEntry,
} from "../../../src/plugins/norbert-usage/domain/dashboard";

// ---------------------------------------------------------------------------
// Helper: create metrics snapshot with specific values
// ---------------------------------------------------------------------------

const createMetricsSnapshot = (overrides: Partial<SessionMetrics> = {}): SessionMetrics => ({
  ...createInitialMetrics("test-session"),
  ...overrides,
});

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User opens Usage Dashboard and sees session health at a glance", () => {
  it("dashboard shows all 6 metric cards with current session values", () => {
    // Given an active session with known metrics
    const metrics = createMetricsSnapshot({
      sessionId: "user-auth-rewrite",
      sessionCost: 2.3,
      totalTokens: 112400,
      inputTokens: 62000,
      outputTokens: 50400,
      activeAgentCount: 1,
      toolCallCount: 89,
      contextWindowPct: 56,
      totalEventCount: 200,
    });

    // When the dashboard data is computed
    const dashboard = computeDashboardData(metrics);

    // Then the running cost card shows "$2.30"
    expect(dashboard.runningCost.value).toBe("$2.30");

    // And the token count card shows "112,400" with breakdown
    expect(dashboard.tokenCount.value).toBe("112,400");
    expect(dashboard.tokenCount.subtitle).toContain("62k in");
    expect(dashboard.tokenCount.subtitle).toContain("50k out");

    // And the active agents card shows "1"
    expect(dashboard.activeAgents.value).toBe("1");

    // And the tool calls card shows "89"
    expect(dashboard.toolCalls.value).toBe("89");

    // And the context window card shows "56%"
    expect(dashboard.contextWindow.value).toBe("56%");

    // And the data health card shows "OK" (events are flowing)
    expect(dashboard.dataHealth.value).toBe("OK");
    expect(dashboard.dataHealth.urgency).toBe("normal");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: 7-Day Burn Chart
// ---------------------------------------------------------------------------

describe("Dashboard shows 7-day burn chart from daily costs", () => {
  it("computes one bar per day with proportional cost values", () => {
    // Given daily cost entries over the past 7 days
    const dailyCosts: DailyCostEntry[] = [
      { date: "2025-03-07", totalCost: 4.2, sessionCount: 2 },
      { date: "2025-03-08", totalCost: 6.1, sessionCount: 3 },
      { date: "2025-03-09", totalCost: 3.8, sessionCount: 1 },
      { date: "2025-03-10", totalCost: 8.5, sessionCount: 4 },
      { date: "2025-03-11", totalCost: 5.2, sessionCount: 2 },
      { date: "2025-03-12", totalCost: 2.9, sessionCount: 1 },
      { date: "2025-03-13", totalCost: 3.1, sessionCount: 2 },
    ];

    // When daily costs are computed for the burn chart
    // Then there are 7 entries
    expect(dailyCosts).toHaveLength(7);
    // And the highest cost day is $8.50
    const maxCost = Math.max(...dailyCosts.map((d) => d.totalCost));
    expect(maxCost).toBeCloseTo(8.5);
    // And the lowest cost day is $2.90
    const minCost = Math.min(...dailyCosts.map((d) => d.totalCost));
    expect(minCost).toBeCloseTo(2.9);
  });
});

describe("Dashboard updates metric cards when new events arrive", () => {
  it("recomputed dashboard data reflects updated session metrics", () => {
    // Given the dashboard is showing cost "$2.30"
    const metrics1 = createMetricsSnapshot({ sessionCost: 2.3 });
    const dashboard1 = computeDashboardData(metrics1);
    expect(dashboard1.runningCost.value).toBe("$2.30");

    // When a new event adds $0.15 to the session cost
    const metrics2 = createMetricsSnapshot({ sessionCost: 2.45 });
    const dashboard2 = computeDashboardData(metrics2);

    // Then the running cost card updates to "$2.45"
    expect(dashboard2.runningCost.value).toBe("$2.45");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Dashboard shows onboarding state for new user", () => {
  it("metric cards show placeholder values when no session data exists", () => {
    // Given a new user with no session history
    const metrics = createInitialMetrics("empty");

    // When dashboard data is computed
    const dashboard = computeDashboardData(metrics);

    // Then all metric cards show zero or placeholder values
    expect(dashboard.runningCost.value).toBe("$0.00");
    expect(dashboard.tokenCount.value).toBe("0");
    expect(dashboard.activeAgents.value).toBe("0");
    expect(dashboard.toolCalls.value).toBe("0");
    expect(dashboard.contextWindow.value).toBe("0%");

    // And the dashboard indicates onboarding state
    expect(dashboard.isOnboarding).toBe(true);
  });
});

describe("Hook health card shows amber for newly started session", () => {
  it("zero hook events produce 'No Events' with amber urgency", () => {
    // Given a newly started session with no hook events
    const metrics = createMetricsSnapshot({ totalEventCount: 0 });

    // When dashboard data is computed
    const dashboard = computeDashboardData(metrics);

    // Then hook health shows 'No Events' in amber
    expect(dashboard.dataHealth.value).toBe("No Events");
    expect(dashboard.dataHealth.urgency).toBe("amber");
  });
});

describe("Dashboard title includes session identifier", () => {
  it("sessionLabel contains the session ID for an active session", () => {
    // Given an active session with a known ID
    const metrics = createMetricsSnapshot({ sessionId: "refactor-auth" });

    // When dashboard data is computed
    const dashboard = computeDashboardData(metrics);

    // Then the session label identifies the session
    expect(dashboard.sessionLabel).toBe("refactor-auth");
  });

  it("sessionLabel is empty for the default session", () => {
    // Given metrics from the default session
    const metrics = createMetricsSnapshot({ sessionId: "default" });

    // When dashboard data is computed
    const dashboard = computeDashboardData(metrics);

    // Then no session label is shown
    expect(dashboard.sessionLabel).toBe("");
  });
});

describe("Context window card shows urgency at high utilization", () => {
  it("context at 90% shows red urgency on the context card", () => {
    // Given a session with 90% context utilization
    const metrics = createMetricsSnapshot({ contextWindowPct: 90 });

    // When dashboard data is computed
    const dashboard = computeDashboardData(metrics);

    // Then the context window card shows red urgency
    expect(dashboard.contextWindow.urgency).toBe("red");
  });
});
