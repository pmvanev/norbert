/**
 * Unit tests: UsageDashboardView (Step 06-02)
 *
 * Stateless React component rendering DashboardData + DailyCostEntry[].
 * Tests cover: metric card rendering, burn chart bar rendering,
 * onboarding state, and urgency CSS classes.
 *
 * Behaviors: 4 (metric cards, burn chart bars, onboarding, urgency)
 * Test budget: max 8 tests
 */

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { UsageDashboardView } from "../../../../../src/plugins/norbert-usage/views/UsageDashboardView";
import { computeDashboardData } from "../../../../../src/plugins/norbert-usage/domain/dashboard";
import { createInitialMetrics } from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import type { SessionMetrics } from "../../../../../src/plugins/norbert-usage/domain/types";
import type { DailyCostEntry } from "../../../../../src/plugins/norbert-usage/domain/dashboard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMetrics = (overrides: Partial<SessionMetrics> = {}): SessionMetrics => ({
  ...createInitialMetrics("test-session"),
  ...overrides,
});

const sevenDayCosts: DailyCostEntry[] = [
  { date: "2025-03-07", totalCost: 4.2, sessionCount: 2 },
  { date: "2025-03-08", totalCost: 6.1, sessionCount: 3 },
  { date: "2025-03-09", totalCost: 3.8, sessionCount: 1 },
  { date: "2025-03-10", totalCost: 8.5, sessionCount: 4 },
  { date: "2025-03-11", totalCost: 5.2, sessionCount: 2 },
  { date: "2025-03-12", totalCost: 2.9, sessionCount: 1 },
  { date: "2025-03-13", totalCost: 3.1, sessionCount: 2 },
];

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Metric cards rendering
// ---------------------------------------------------------------------------

describe("UsageDashboardView renders 6 metric cards", () => {
  it("displays all 6 metric card labels with computed values", () => {
    const metrics = createMetrics({
      sessionCost: 2.3,
      totalTokens: 112400,
      inputTokens: 62000,
      outputTokens: 50400,
      activeAgentCount: 1,
      toolCallCount: 89,
      contextWindowPct: 56,
      hookEventCount: 200,
    });
    const dashboard = computeDashboardData(metrics);

    render(React.createElement(UsageDashboardView, {
      dashboard,
      dailyCosts: sevenDayCosts,
    }));

    // All 6 card labels are present
    expect(screen.getByText("Running Cost")).toBeInTheDocument();
    expect(screen.getByText("Token Count")).toBeInTheDocument();
    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    expect(screen.getByText("Tool Calls")).toBeInTheDocument();
    expect(screen.getByText("Context Window")).toBeInTheDocument();
    expect(screen.getByText("Hook Health")).toBeInTheDocument();

    // Values are rendered
    expect(screen.getByText("$2.30")).toBeInTheDocument();
    expect(screen.getByText("112,400")).toBeInTheDocument();
    expect(screen.getByText("89")).toBeInTheDocument();
    expect(screen.getByText("56%")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Burn chart rendering
// ---------------------------------------------------------------------------

describe("UsageDashboardView renders 7-day burn chart", () => {
  it("renders 7 bars in the burn chart region", () => {
    const metrics = createMetrics({ sessionCost: 1.0, totalTokens: 100 });
    const dashboard = computeDashboardData(metrics);

    render(React.createElement(UsageDashboardView, {
      dashboard,
      dailyCosts: sevenDayCosts,
    }));

    const chart = screen.getByRole("img", { name: /burn chart/i });
    const bars = within(chart).getAllByRole("meter");
    expect(bars).toHaveLength(7);
  });

  it("renders bars with proportional heights based on max cost", () => {
    const metrics = createMetrics({ sessionCost: 1.0, totalTokens: 100 });
    const dashboard = computeDashboardData(metrics);

    render(React.createElement(UsageDashboardView, {
      dashboard,
      dailyCosts: sevenDayCosts,
    }));

    const chart = screen.getByRole("img", { name: /burn chart/i });
    const bars = within(chart).getAllByRole("meter");

    // The max cost day ($8.50) should have value 100
    // The min cost day ($2.90) should have proportional value
    const maxBar = bars.find((bar) => bar.getAttribute("aria-valuenow") === "100");
    expect(maxBar).toBeDefined();

    // $2.90 / $8.50 * 100 = ~34.1
    const minBar = bars.find((bar) => {
      const val = Number(bar.getAttribute("aria-valuenow"));
      return val > 33 && val < 36;
    });
    expect(minBar).toBeDefined();
  });

  it("renders empty burn chart when no daily costs exist", () => {
    const metrics = createMetrics({ sessionCost: 1.0, totalTokens: 100 });
    const dashboard = computeDashboardData(metrics);

    render(React.createElement(UsageDashboardView, {
      dashboard,
      dailyCosts: [],
    }));

    const chart = screen.getByRole("img", { name: /burn chart/i });
    const bars = within(chart).queryAllByRole("meter");
    expect(bars).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Onboarding state
// ---------------------------------------------------------------------------

describe("UsageDashboardView shows onboarding state", () => {
  it("shows onboarding message when isOnboarding is true and no daily costs", () => {
    const metrics = createInitialMetrics("empty");
    const dashboard = computeDashboardData(metrics);

    render(React.createElement(UsageDashboardView, {
      dashboard,
      dailyCosts: [],
    }));

    expect(screen.getByText(/start a coding session/i)).toBeInTheDocument();
  });

  it("does not show onboarding message when session has activity", () => {
    const metrics = createMetrics({ sessionCost: 2.3, totalTokens: 1000 });
    const dashboard = computeDashboardData(metrics);

    render(React.createElement(UsageDashboardView, {
      dashboard,
      dailyCosts: sevenDayCosts,
    }));

    expect(screen.queryByText(/start a coding session/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Context window urgency CSS
// ---------------------------------------------------------------------------

describe("UsageDashboardView applies urgency CSS classes", () => {
  it("applies red urgency class to context window card at 90%", () => {
    const metrics = createMetrics({ contextWindowPct: 90, totalTokens: 100 });
    const dashboard = computeDashboardData(metrics);

    render(React.createElement(UsageDashboardView, {
      dashboard,
      dailyCosts: [],
    }));

    // Find the context window card by its label, then check parent for urgency class
    const label = screen.getByText("Context Window");
    const card = label.closest(".metric-card");
    expect(card).not.toBeNull();
    expect(card).toHaveClass("metric-card-urgency-red");
  });
});
