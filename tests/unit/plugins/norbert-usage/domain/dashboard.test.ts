/**
 * Unit tests for computeDashboardData.
 *
 * Pure domain function: SessionMetrics => DashboardData
 * Tests cover formatting, urgency thresholds, onboarding detection,
 * and daily cost aggregation.
 */

import { describe, it, expect } from "vitest";
import {
  computeDashboardData,
  deriveSessionLabel,
  type DashboardData,
} from "../../../../../src/plugins/norbert-usage/domain/dashboard";
import {
  createInitialMetrics,
  type SessionMetrics,
} from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const createMetrics = (overrides: Partial<SessionMetrics> = {}): SessionMetrics => ({
  ...createInitialMetrics("unit-test"),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Running Cost card
// ---------------------------------------------------------------------------

describe("Running Cost card formatting", () => {
  it("formats cost to two decimal places with dollar sign", () => {
    const dashboard = computeDashboardData(createMetrics({ sessionCost: 1.5 }));
    expect(dashboard.runningCost.label).toBe("Running Cost");
    expect(dashboard.runningCost.value).toBe("$1.50");
  });

  it("formats zero cost as $0.00", () => {
    const dashboard = computeDashboardData(createMetrics({ sessionCost: 0 }));
    expect(dashboard.runningCost.value).toBe("$0.00");
  });

  it("formats large cost with two decimals", () => {
    const dashboard = computeDashboardData(createMetrics({ sessionCost: 123.456 }));
    expect(dashboard.runningCost.value).toBe("$123.46");
  });
});

// ---------------------------------------------------------------------------
// Token Count card
// ---------------------------------------------------------------------------

describe("Token Count card formatting", () => {
  it("formats total tokens with comma separator", () => {
    const dashboard = computeDashboardData(
      createMetrics({ totalTokens: 112400, inputTokens: 62000, outputTokens: 50400 }),
    );
    expect(dashboard.tokenCount.label).toBe("Token Count");
    expect(dashboard.tokenCount.value).toBe("112,400");
  });

  it("shows input/output breakdown in subtitle as Xk in / Xk out", () => {
    const dashboard = computeDashboardData(
      createMetrics({ totalTokens: 112400, inputTokens: 62000, outputTokens: 50400 }),
    );
    expect(dashboard.tokenCount.subtitle).toContain("62k in");
    expect(dashboard.tokenCount.subtitle).toContain("50k out");
  });

  it("formats zero tokens as 0", () => {
    const dashboard = computeDashboardData(createMetrics({ totalTokens: 0 }));
    expect(dashboard.tokenCount.value).toBe("0");
  });
});

// ---------------------------------------------------------------------------
// Active Agents card
// ---------------------------------------------------------------------------

describe("Active Agents card", () => {
  it("shows agent count as string", () => {
    const dashboard = computeDashboardData(createMetrics({ activeAgentCount: 3 }));
    expect(dashboard.activeAgents.label).toBe("Active Agents");
    expect(dashboard.activeAgents.value).toBe("3");
  });
});

// ---------------------------------------------------------------------------
// Tool Calls card
// ---------------------------------------------------------------------------

describe("Tool Calls card", () => {
  it("shows tool call count as string", () => {
    const dashboard = computeDashboardData(createMetrics({ toolCallCount: 42 }));
    expect(dashboard.toolCalls.label).toBe("Tool Calls");
    expect(dashboard.toolCalls.value).toBe("42");
  });
});

// ---------------------------------------------------------------------------
// Context Window card with urgency thresholds
// ---------------------------------------------------------------------------

describe("Context Window card urgency", () => {
  it("shows normal urgency below 70%", () => {
    const dashboard = computeDashboardData(createMetrics({ contextWindowPct: 50 }));
    expect(dashboard.contextWindow.label).toBe("Context Window");
    expect(dashboard.contextWindow.value).toBe("50%");
    expect(dashboard.contextWindow.urgency).toBe("normal");
  });

  it("shows amber urgency at 70%", () => {
    const dashboard = computeDashboardData(createMetrics({ contextWindowPct: 70 }));
    expect(dashboard.contextWindow.urgency).toBe("amber");
  });

  it("shows amber urgency at 89%", () => {
    const dashboard = computeDashboardData(createMetrics({ contextWindowPct: 89 }));
    expect(dashboard.contextWindow.urgency).toBe("amber");
  });

  it("shows red urgency at 90%", () => {
    const dashboard = computeDashboardData(createMetrics({ contextWindowPct: 90 }));
    expect(dashboard.contextWindow.urgency).toBe("red");
  });

  it("shows red urgency at 100%", () => {
    const dashboard = computeDashboardData(createMetrics({ contextWindowPct: 100 }));
    expect(dashboard.contextWindow.urgency).toBe("red");
  });
});

// ---------------------------------------------------------------------------
// Hook Health card
// ---------------------------------------------------------------------------

describe("Hook Health card", () => {
  it("shows OK with normal urgency when events are flowing", () => {
    const dashboard = computeDashboardData(createMetrics({ totalEventCount: 200 }));
    expect(dashboard.hookHealth.label).toBe("Hook Health");
    expect(dashboard.hookHealth.value).toBe("OK");
    expect(dashboard.hookHealth.urgency).toBe("normal");
    expect(dashboard.hookHealth.subtitle).toBe("200 events");
  });

  it("shows 'No Events' with amber urgency when totalEventCount is 0", () => {
    const dashboard = computeDashboardData(createMetrics({ totalEventCount: 0 }));
    expect(dashboard.hookHealth.value).toBe("No Events");
    expect(dashboard.hookHealth.urgency).toBe("amber");
    expect(dashboard.hookHealth.subtitle).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Onboarding detection
// ---------------------------------------------------------------------------

describe("Onboarding detection", () => {
  it("isOnboarding is true when all metrics are zero", () => {
    const dashboard = computeDashboardData(createInitialMetrics("empty"));
    expect(dashboard.isOnboarding).toBe(true);
  });

  it("isOnboarding is false when session has activity", () => {
    const dashboard = computeDashboardData(
      createMetrics({ sessionId: "active", sessionCost: 1, totalTokens: 100 }),
    );
    expect(dashboard.isOnboarding).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Session label
// ---------------------------------------------------------------------------

describe("Session label", () => {
  it("contains session ID when non-default", () => {
    const dashboard = computeDashboardData(createMetrics({ sessionId: "refactor-auth" }));
    expect(dashboard.sessionLabel).toBe("refactor-auth");
  });

  it("is empty for 'default' session ID", () => {
    const dashboard = computeDashboardData(createMetrics({ sessionId: "default" }));
    expect(dashboard.sessionLabel).toBe("");
  });

  it("is empty for empty session ID", () => {
    const dashboard = computeDashboardData(createMetrics({ sessionId: "" }));
    expect(dashboard.sessionLabel).toBe("");
  });

  it("truncates long IDs with ellipsis", () => {
    const longId = "this-is-a-very-long-session-identifier-that-should-be-truncated";
    const label = deriveSessionLabel(longId);
    expect(label).toHaveLength(20);
    expect(label).toMatch(/\.\.\.$/);
  });

  it("passes through IDs of 20 chars or less", () => {
    const label = deriveSessionLabel("exactly-20-chars!!!!"); // 20 chars
    expect(label).toBe("exactly-20-chars!!!!");
  });
});

