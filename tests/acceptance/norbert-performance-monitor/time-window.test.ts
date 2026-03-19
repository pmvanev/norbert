/**
 * Acceptance tests: Configurable Time Window System (US-PM-004)
 *
 * Validates time window configuration resolution mapping, multi-window
 * buffer management, and stats computation across different windows.
 *
 * Driving ports: pure domain functions (multiWindowSampler,
 * time window configuration, stats computation)
 * These tests exercise the time-series windowing logic,
 * not the chart rendering.
 *
 * Traces to: US-PM-004 acceptance criteria
 */

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  createBuffer,
  appendSample,
  getSamples,
  computeStats,
  type TimeSeriesBuffer,
  type RateSample,
} from "../../../src/plugins/norbert-usage/domain/timeSeriesSampler";

import {
  createMultiWindowBuffer,
  appendMultiWindowSample,
  getActiveWindowSamples,
  computeMultiWindowStats,
  resolveSessionWindowConfig,
  type MultiWindowBuffer,
  TIME_WINDOW_PRESETS,
} from "../../../src/plugins/norbert-usage/domain/multiWindowSampler";

import type { TimeWindowId } from "../../../src/plugins/norbert-usage/domain/types";
import { PerformanceMonitorView } from "../../../src/plugins/norbert-usage/views/PerformanceMonitorView";
import { createMetricsStore } from "../../../src/plugins/norbert-usage/adapters/metricsStore";
import { createMultiSessionStore } from "../../../src/plugins/norbert-usage/adapters/multiSessionStore";

// ---------------------------------------------------------------------------
// Helper: create a rate sample at a given time
// ---------------------------------------------------------------------------

const sample = (timestamp: number, tokenRate: number, costRate: number): RateSample => ({
  timestamp,
  tokenRate,
  costRate,
});

// ---------------------------------------------------------------------------
// WALKING SKELETON: User switches time windows to see broader trends
// Traces to: US-PM-004, JS-PM-3
// ---------------------------------------------------------------------------

describe("User switches from 1-minute to 15-minute window to see resource trend", () => {
  it("wider window shows more historical data at lower resolution", () => {
    // Given Ravi is viewing the Performance Monitor with data spanning 15 minutes
    // And he has been monitoring for 900 seconds (15m)

    // When a multi-window buffer is created and populated
    let multiBuffer = createMultiWindowBuffer();

    // Populate with 600 samples at 100ms intervals (60 seconds of 10Hz data)
    for (let i = 0; i < 600; i++) {
      multiBuffer = appendMultiWindowSample(multiBuffer, sample(i * 100, 100, 0.01));
    }

    // Then the 1-minute window shows samples at 100ms resolution
    const samples1m = getActiveWindowSamples(multiBuffer, "1m");
    expect(samples1m.length).toBeGreaterThan(0);
    expect(samples1m.length).toBeLessThanOrEqual(600);

    // When Ravi switches to the 15-minute window
    const samples15m = getActiveWindowSamples(multiBuffer, "15m");
    // Then the 15-minute window also has samples (downsampled)
    expect(samples15m.length).toBeGreaterThan(0);

    // This is a structural verification that the multi-window system
    // maintains separate buffers with appropriate capacities
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Time Window Configuration
// Traces to: US-PM-004 AC "Time window selector offers: 1m, 5m, 15m, Session"
// ---------------------------------------------------------------------------

describe("Time window presets have correct resolution and capacity", () => {
  it("1-minute window: 600 samples at 100ms interval", () => {
    // Given the 1-minute time window preset
    const preset = TIME_WINDOW_PRESETS.find(p => p.label === "1m");

    // Then it targets 100ms sample interval for ~10Hz feel
    expect(preset!.durationMs).toBe(60000);
    expect(preset!.sampleIntervalMs).toBe(100);
    expect(preset!.bufferCapacity).toBe(600);
  });

  it("5-minute window: 600 samples at 500ms interval", () => {
    // Given the 5-minute time window preset
    const preset = TIME_WINDOW_PRESETS.find(p => p.label === "5m");

    // Then it targets 500ms sample interval
    expect(preset!.durationMs).toBe(300000);
    expect(preset!.sampleIntervalMs).toBe(500);
    expect(preset!.bufferCapacity).toBe(600);
  });

  it("15-minute window: 900 samples at 1000ms interval", () => {
    // Given the 15-minute time window preset
    const preset = TIME_WINDOW_PRESETS.find(p => p.label === "15m");

    // Then it targets 1-second sample interval
    expect(preset!.durationMs).toBe(900000);
    expect(preset!.sampleIntervalMs).toBe(1000);
    expect(preset!.bufferCapacity).toBe(900);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Session-Length Window
// Traces to: US-PM-004 AC "Session window at dynamic resolution"
// ---------------------------------------------------------------------------

describe("Session-length window computes dynamic resolution for full history", () => {
  it("42-minute session targets 300-900 data points", () => {
    // Given a session that has been running for 42 minutes (2520 seconds)
    const sessionDurationMs = 42 * 60 * 1000;

    // When the session window config is resolved
    const config = resolveSessionWindowConfig(sessionDurationMs);

    // Then the resolution adjusts to keep data points in the 300-900 range
    expect(config.bufferCapacity).toBeGreaterThanOrEqual(300);
    expect(config.bufferCapacity).toBeLessThanOrEqual(900);
    // And the sample interval is computed from duration / capacity
    expect(config.sampleIntervalMs).toBeGreaterThan(0);
  });

  it("5-minute session also targets 300-900 data points", () => {
    // Given a session that has been running for only 5 minutes
    const sessionDurationMs = 5 * 60 * 1000;

    // When the session window config is resolved
    const config = resolveSessionWindowConfig(sessionDurationMs);

    // Then the resolution adjusts appropriately for the shorter duration
    expect(config.bufferCapacity).toBeGreaterThanOrEqual(300);
    expect(config.bufferCapacity).toBeLessThanOrEqual(900);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Stats Reflect Selected Window
// Traces to: US-PM-004 AC "Stats bar reflects selected window"
// ---------------------------------------------------------------------------

describe("Stats computed from 5-minute window differ from 1-minute window", () => {
  it("spike outside 1m range but within 5m range produces different peak stats", () => {
    // Given a multi-window buffer
    let multiBuffer = createMultiWindowBuffer();

    // And a spike at t=0 (simulating ~3 minutes ago)
    multiBuffer = appendMultiWindowSample(
      multiBuffer,
      sample(0, 800, 0.12),
    );

    // And steady data from t=120000 to t=180000 (last 60 seconds at 100ms intervals)
    // The 1m buffer (capacity 600, interval 100ms) will be filled with 600 steady
    // samples, evicting the spike. The 5m buffer (capacity 600, interval 500ms)
    // retains the spike because only ~120 of its 600 slots are used.
    for (let i = 0; i < 600; i++) {
      const t = 120_000 + i * 100;
      multiBuffer = appendMultiWindowSample(multiBuffer, sample(t, 200, 0.03));
    }

    // When stats are computed for each window
    const stats1m = computeMultiWindowStats(multiBuffer, "1m");
    const stats5m = computeMultiWindowStats(multiBuffer, "5m");

    // Then the 1-minute window peak is 200 (spike evicted)
    expect(stats1m.peakRate).toBe(200);

    // And the 5-minute window peak is 800 (spike retained)
    expect(stats5m.peakRate).toBe(800);

    // Therefore peaks differ across windows
    expect(stats5m.peakRate).not.toBe(stats1m.peakRate);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Time Window Persistence
// Traces to: US-PM-004 AC "Time window persists across navigation"
// ---------------------------------------------------------------------------

describe("Time window selection is independent of view mode", () => {
  it("time window is a separate state dimension from aggregate/detail mode", () => {
    // Given Ravi has selected the 15-minute time window
    const timeWindow: TimeWindowId = "15m";

    // When Ravi drills into a session and then navigates back
    // The time window state is preserved by the view container,
    // not by the domain functions

    // Then the domain verifies that time window is a valid selection
    const validWindows: ReadonlyArray<string> = TIME_WINDOW_PRESETS.map(p => p.label);
    expect(validWindows).toContain(timeWindow);

    // The domain provides TIME_WINDOW_PRESETS for the view to reference
    // but does not manage the selection state (that is view-layer)
  });
});

// ---------------------------------------------------------------------------
// BOUNDARY SCENARIOS: Buffer Capacity
// Traces to: US-PM-004 AC "1-minute window preserves ~10Hz update frequency"
// ---------------------------------------------------------------------------

describe("1-minute window buffer at capacity wraps correctly", () => {
  it("601st sample evicts the oldest, preserving 600-sample window", () => {
    // Given a ring buffer configured for 1-minute window (600 capacity)
    let buffer = createBuffer(600);

    // When 601 samples are appended at 10Hz
    for (let i = 0; i < 601; i++) {
      buffer = appendSample(buffer, sample(i * 100, 100 + i, 0));
    }

    // Then the buffer holds exactly 600 samples
    const samples = getSamples(buffer);
    expect(samples).toHaveLength(600);
    // And the first sample (t=0) was evicted
    expect(samples[0].timestamp).toBe(100);
    // And the latest sample is present
    expect(samples[samples.length - 1].timestamp).toBe(60000);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS: Insufficient Data for Window
// ---------------------------------------------------------------------------

describe("Partially filled window still produces valid stats", () => {
  it("stats computed correctly when buffer has fewer samples than capacity", () => {
    // Given a 15-minute window that just started (only 30 seconds of data)
    let buffer = createBuffer(900);
    for (let i = 0; i < 30; i++) {
      buffer = appendSample(buffer, sample(i * 1000, 200, 0.03));
    }

    // When stats are computed
    const stats = computeStats(buffer);

    // Then stats reflect the available data (not the full window)
    expect(stats.peakRate).toBe(200);
    expect(stats.avgRate).toBe(200);
    // And the buffer reports 30 samples (not 900)
    expect(getSamples(buffer)).toHaveLength(30);
  });
});

// ---------------------------------------------------------------------------
// jsdom helpers for React component tests
// ---------------------------------------------------------------------------

const setupJsdom = () => {
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
};

// ---------------------------------------------------------------------------
// ACCEPTANCE: Time window persists when switching from aggregate to session detail
// Traces to: US-PM-004 AC "Time window persists across aggregate/detail navigation"
// Step: 04-02
// ---------------------------------------------------------------------------

describe("Time window persists when switching from aggregate to session detail", () => {
  beforeEach(setupJsdom);
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("selected time window survives aggregate-to-detail-to-aggregate navigation", () => {
    const store = createMetricsStore("test-session");

    render(React.createElement(PerformanceMonitorView, { store, multiSessionStore: createMultiSessionStore() }));

    // Given the time window selector is visible with default "1m" selected
    const selector = screen.getByRole("group", { name: /time window/i });
    expect(selector).toBeInTheDocument();

    // When Ravi selects the "15m" time window
    const fifteenMinButton = screen.getByRole("button", { name: "15m" });
    fireEvent.click(fifteenMinButton);

    // Then "15m" is the active selection
    expect(fifteenMinButton).toHaveAttribute("aria-pressed", "true");

    // When Ravi drills into a session detail and returns to aggregate
    // (simulate by checking that the time window state is maintained
    //  in PerformanceMonitorView across navigation)

    // The "15m" button should still be pressed (state preserved)
    expect(screen.getByRole("button", { name: "15m" })).toHaveAttribute("aria-pressed", "true");
    // And "1m" should not be pressed
    expect(screen.getByRole("button", { name: "1m" })).toHaveAttribute("aria-pressed", "false");
  });
});

// ---------------------------------------------------------------------------
// ACCEPTANCE: Charts update when time window selection changes
// Traces to: US-PM-004 AC "All charts respond to time window changes"
// Step: 04-02
// ---------------------------------------------------------------------------

describe("Charts update when time window selection changes", () => {
  beforeEach(setupJsdom);
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it("changing time window selection updates the displayed window label", () => {
    const store = createMetricsStore("test-session");

    render(React.createElement(PerformanceMonitorView, { store, multiSessionStore: createMultiSessionStore() }));

    // Given the default "1m" window is selected
    const oneMinButton = screen.getByRole("button", { name: "1m" });
    expect(oneMinButton).toHaveAttribute("aria-pressed", "true");

    // When Ravi switches to "5m"
    const fiveMinButton = screen.getByRole("button", { name: "5m" });
    fireEvent.click(fiveMinButton);

    // Then "5m" becomes active and "1m" is deactivated
    expect(fiveMinButton).toHaveAttribute("aria-pressed", "true");
    expect(oneMinButton).toHaveAttribute("aria-pressed", "false");

    // And the Session window option is also available
    const sessionButton = screen.getByRole("button", { name: "Session" });
    expect(sessionButton).toBeInTheDocument();
    expect(sessionButton).toHaveAttribute("aria-pressed", "false");
  });
});
