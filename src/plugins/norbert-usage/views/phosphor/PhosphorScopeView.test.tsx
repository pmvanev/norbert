/**
 * @vitest-environment jsdom
 */
/**
 * Unit tests: PhosphorScopeView (Step 09-01)
 *
 * The scope view:
 *   - initializes `selectedMetric` from DEFAULT_METRIC ("events")
 *   - subscribes to multiSessionStore and re-renders on notification
 *   - calls `buildFrame(store, selectedMetric, Date.now())` and passes the
 *     frame down to the (stubbed in 09-01) PhosphorCanvasHost
 *   - updates selectedMetric when PhosphorControls fires onMetricChange
 *
 * The canvas host is stubbed in this step (it lands in 09-02); the stub
 * exposes its received `frame.metric` / `frame.yMax` / trace count via
 * data attributes so the view's wiring is observable.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhosphorScopeView } from "./PhosphorScopeView";
import { createMultiSessionStore } from "../../adapters/multiSessionStore";
import { DEFAULT_METRIC, METRICS } from "../../domain/phosphor/phosphorMetricConfig";

afterEach(cleanup);

describe("PhosphorScopeView", () => {
  it("initializes selected metric from DEFAULT_METRIC on first render", () => {
    const store = createMultiSessionStore();
    render(<PhosphorScopeView store={store} />);

    // The canvas host stub surfaces frame.metric via data-metric.
    const host = screen.getByTestId("phosphor-canvas-host");
    expect(host.getAttribute("data-metric")).toBe(DEFAULT_METRIC);
    expect(host.getAttribute("data-y-max")).toBe(String(METRICS[DEFAULT_METRIC].yMax));
  });

  it("subscribes to multiSessionStore and rebuilds the frame when the store notifies", () => {
    const store = createMultiSessionStore();
    const subscribeSpy = vi.spyOn(store, "subscribe");

    render(<PhosphorScopeView store={store} />);

    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    // Before any session exists, zero traces are projected.
    expect(screen.getByTestId("phosphor-canvas-host").getAttribute("data-trace-count")).toBe("0");

    // Adding a session causes the store to notify. The view must recompute
    // the frame and the trace count surfaced by the host must now be 1.
    act(() => {
      store.addSession("sess-a");
    });

    expect(screen.getByTestId("phosphor-canvas-host").getAttribute("data-trace-count")).toBe("1");
  });

  it("updates selectedMetric when PhosphorControls fires onMetricChange", () => {
    const store = createMultiSessionStore();
    render(<PhosphorScopeView store={store} />);

    // Click the tokens button — the host's data-metric should switch to "tokens".
    fireEvent.click(screen.getByRole("button", { name: METRICS.tokens.name }));

    const host = screen.getByTestId("phosphor-canvas-host");
    expect(host.getAttribute("data-metric")).toBe("tokens");
    expect(host.getAttribute("data-y-max")).toBe(String(METRICS.tokens.yMax));
  });

  it("renders the legend alongside the canvas host and controls", () => {
    const store = createMultiSessionStore();
    render(<PhosphorScopeView store={store} />);

    expect(screen.getByTestId("phosphor-canvas-host")).toBeInTheDocument();
    expect(screen.getByTestId("phosphor-legend")).toBeInTheDocument();
    // Controls button present.
    expect(screen.getByRole("button", { name: METRICS.events.name })).toBeInTheDocument();
  });
});
