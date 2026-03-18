/**
 * Unit tests: PMSessionDetail (Step 03-02)
 *
 * Tests the session detail view component that renders session-scoped
 * charts, agent breakdown panel, operational metrics bar, and back
 * navigation. Covers graceful degradation when agent data is absent
 * and frozen state indicator for ended sessions.
 *
 * Behaviors: 5 (charts, agent breakdown, graceful degradation, frozen indicator, back nav)
 * Test budget: max 10 tests
 */

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, within, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { PMSessionDetail } from "../../../../../src/plugins/norbert-usage/views/PMSessionDetail";
import { computeSessionDetailData } from "../../../../../src/plugins/norbert-usage/domain/performanceMonitor";
import { createInitialMetrics } from "../../../../../src/plugins/norbert-usage/domain/metricsAggregator";
import type { SessionMetrics, AgentMetrics, RateSample } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMetrics = (overrides: Partial<SessionMetrics> = {}): SessionMetrics => ({
  ...createInitialMetrics("test-session"),
  ...overrides,
});

const createAgents = (): ReadonlyArray<AgentMetrics> => [
  { agentId: "agent-1", agentRole: "coordinator", tokenRate: 185, costRate: 0.002, tokenTotal: 15000 },
  { agentId: "agent-2", agentRole: "file-reader", tokenRate: 127, costRate: 0.0015, tokenTotal: 10000 },
];

const emptySamples: ReadonlyArray<RateSample> = [];

// Mock ResizeObserver and canvas for jsdom
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class MockResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  });

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineJoin: "",
    font: "",
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Session-scoped charts
// ---------------------------------------------------------------------------

describe("PMSessionDetail renders session-scoped charts", () => {
  it("renders chart cells for session metrics", () => {
    const metrics = createMetrics({ sessionId: "refactor-auth", burnRate: 312 });
    const detailData = computeSessionDetailData(metrics);

    render(
      React.createElement(PMSessionDetail, {
        detailData,
        tokenRateSamples: emptySamples,
        costRateSamples: emptySamples,
        onBack: vi.fn(),
      }),
    );

    // Session detail should render chart cells
    const region = screen.getByRole("region", { name: /session detail/i });
    expect(region).toBeInTheDocument();

    // Should have chart cells for metrics
    const charts = region.querySelectorAll(".pm-chart-cell");
    expect(charts.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Agent breakdown panel
// ---------------------------------------------------------------------------

describe("PMSessionDetail renders agent breakdown when agents present", () => {
  it("lists agents with their roles and token rates", () => {
    const metrics = createMetrics({ sessionId: "refactor-auth", burnRate: 312, activeAgentCount: 2 });
    const agents = createAgents();
    const detailData = computeSessionDetailData(metrics, agents);

    render(
      React.createElement(PMSessionDetail, {
        detailData,
        tokenRateSamples: emptySamples,
        costRateSamples: emptySamples,
        onBack: vi.fn(),
      }),
    );

    // Agent breakdown panel should be visible
    const breakdown = screen.getByRole("list", { name: /agent breakdown/i });
    expect(breakdown).toBeInTheDocument();

    // Each agent should be listed
    const rows = within(breakdown).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Graceful degradation: no agent data
// ---------------------------------------------------------------------------

describe("PMSessionDetail degrades gracefully when agent data absent", () => {
  it("shows empty state message instead of agent list", () => {
    const metrics = createMetrics({ sessionId: "migrate-db", burnRate: 185 });
    const detailData = computeSessionDetailData(metrics, []);

    render(
      React.createElement(PMSessionDetail, {
        detailData,
        tokenRateSamples: emptySamples,
        costRateSamples: emptySamples,
        onBack: vi.fn(),
      }),
    );

    // Should show graceful degradation message
    expect(screen.getByText(/no agent data/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Frozen state indicator for ended sessions
// ---------------------------------------------------------------------------

describe("PMSessionDetail shows frozen state for ended sessions", () => {
  it("displays session-ended indicator when isEnded is true", () => {
    const metrics = createMetrics({
      sessionId: "quick-fix",
      burnRate: 0,
      lastEventAt: "2025-01-01T14:32:00Z",
    });
    const detailData = computeSessionDetailData(metrics);

    render(
      React.createElement(PMSessionDetail, {
        detailData,
        tokenRateSamples: emptySamples,
        costRateSamples: emptySamples,
        onBack: vi.fn(),
        isEnded: true,
      }),
    );

    // Should show frozen state indicator
    expect(screen.getByText(/session ended/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Back navigation
// ---------------------------------------------------------------------------

describe("PMSessionDetail back button invokes navigation callback", () => {
  it("calls onBack when back button clicked", () => {
    const metrics = createMetrics({ sessionId: "refactor-auth", burnRate: 312 });
    const detailData = computeSessionDetailData(metrics);
    const onBack = vi.fn();

    render(
      React.createElement(PMSessionDetail, {
        detailData,
        tokenRateSamples: emptySamples,
        costRateSamples: emptySamples,
        onBack,
      }),
    );

    const backButton = screen.getByRole("button", { name: /back/i });
    fireEvent.click(backButton);

    expect(onBack).toHaveBeenCalledOnce();
  });
});
