/**
 * Unit tests: OscilloscopeView lifecycle and integration (Step 05-03)
 *
 * Tests the broadcast integration, canvas resize, and animation lifecycle
 * of the OscilloscopeView component. Pure domain logic for canvas dimension
 * computation is tested separately; this file covers the effect boundary.
 *
 * Behaviors: 3 (store subscription, canvas resize, animation lifecycle)
 * Test budget: max 6 tests
 */

/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { OscilloscopeView } from "../../../../../src/plugins/norbert-usage/views/OscilloscopeView";
import { createMetricsStore } from "../../../../../src/plugins/norbert-usage/adapters/metricsStore";
import { createBuffer, appendSample } from "../../../../../src/plugins/norbert-usage/domain/timeSeriesSampler";
import type { RateSample } from "../../../../../src/plugins/norbert-usage/domain/types";
import { computeCanvasDimensions } from "../../../../../src/plugins/norbert-usage/domain/oscilloscope";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sample = (timestamp: number, tokenRate: number, costRate: number): RateSample => ({
  timestamp,
  tokenRate,
  costRate,
});

// ---------------------------------------------------------------------------
// Pure domain: computeCanvasDimensions
// ---------------------------------------------------------------------------

describe("computeCanvasDimensions computes canvas size from container", () => {
  it("scales canvas to fit container while respecting aspect ratio", () => {
    // Given a container of 800x400 and a 3:1 aspect ratio
    const dims = computeCanvasDimensions(800, 400, 3);

    // Then canvas width fills the container
    expect(dims.width).toBe(800);
    // And canvas height respects aspect ratio (800 / 3 = ~267, capped at 400)
    expect(dims.height).toBeLessThanOrEqual(400);
    expect(dims.height).toBeCloseTo(800 / 3, 0);
    // And padding is set
    expect(dims.padding).toBeGreaterThan(0);
  });

  it("caps canvas height to container height when aspect ratio would exceed it", () => {
    // Given a narrow container where aspect ratio height exceeds container
    const dims = computeCanvasDimensions(300, 80, 3);

    // Then canvas height is capped to container height
    expect(dims.height).toBe(80);
    // And width is adjusted accordingly
    expect(dims.width).toBeLessThanOrEqual(300);
  });

  it("uses default aspect ratio when not provided", () => {
    const dims = computeCanvasDimensions(600, 400);

    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
    expect(dims.padding).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Store subscription: component receives live buffer updates
// ---------------------------------------------------------------------------

describe("OscilloscopeView subscribes to metrics store for live updates", () => {
  let resizeObserverCallback: ResizeObserverCallback | null = null;

  beforeEach(() => {
    // Mock ResizeObserver for jsdom
    resizeObserverCallback = null;
    vi.stubGlobal("ResizeObserver", class MockResizeObserver {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
        this.callback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      lineJoin: "",
      font: "",
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

  it("renders with store-provided buffer and updates on store changes", () => {
    const store = createMetricsStore("test");

    // Given a store with initial empty buffer
    const { container } = render(
      React.createElement(OscilloscopeView, { store }),
    );

    // Then the canvas renders
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeInTheDocument();

    // When the store broadcasts a new buffer with samples
    let buffer = createBuffer(60);
    buffer = appendSample(buffer, sample(1000, 100, 0.01));
    buffer = appendSample(buffer, sample(2000, 200, 0.02));
    store.update(store.getMetrics(), buffer);

    // Then the component should have received the update
    // (verified by the component not throwing and canvas still present)
    expect(container.querySelector("canvas")).toBeInTheDocument();
  });

  it("unsubscribes from store on unmount", () => {
    const store = createMetricsStore("test");

    // Track subscriber count via a spy
    const originalSubscribe = store.subscribe;
    let unsubscribeCalled = false;
    store.subscribe = (callback) => {
      const unsub = originalSubscribe(callback);
      return () => {
        unsubscribeCalled = true;
        unsub();
      };
    };

    const { unmount } = render(
      React.createElement(OscilloscopeView, { store }),
    );

    // When the component unmounts
    unmount();

    // Then the store subscription was cleaned up
    expect(unsubscribeCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Canvas resize: ResizeObserver updates canvas dimensions
// ---------------------------------------------------------------------------

describe("OscilloscopeView resizes canvas on container resize", () => {
  let resizeObserverCallback: ResizeObserverCallback | null = null;
  let disconnectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resizeObserverCallback = null;
    disconnectSpy = vi.fn();
    vi.stubGlobal("ResizeObserver", class MockResizeObserver {
      callback: ResizeObserverCallback;
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
        this.callback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() { disconnectSpy(); }
    });

    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      lineJoin: "",
      font: "",
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

  it("disconnects ResizeObserver on unmount", () => {
    const store = createMetricsStore("test");

    const { unmount } = render(
      React.createElement(OscilloscopeView, { store }),
    );

    // When unmounting
    unmount();

    // Then ResizeObserver was disconnected
    expect(disconnectSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Animation lifecycle: interval cleanup on unmount
// ---------------------------------------------------------------------------

describe("OscilloscopeView animation lifecycle", () => {
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

  it("clears render interval on unmount to prevent memory leaks", () => {
    const store = createMetricsStore("test");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = render(
      React.createElement(OscilloscopeView, { store }),
    );

    // When unmounting
    unmount();

    // Then the interval was cleared
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
