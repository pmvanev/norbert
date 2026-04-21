/**
 * @vitest-environment jsdom
 */
/**
 * Unit tests: PhosphorScopeView.
 *
 * The scope view:
 *   - initializes `enabledMetrics` to every supported metric, so every
 *     metric's canvas host renders on first launch.
 *   - subscribes to multiSessionStore and re-renders on notification so each
 *     host's projected frame reflects store changes.
 *   - toggles a metric off when its enabled control button is clicked,
 *     removing that host from the DOM.
 *   - toggles a metric back on when its disabled control button is clicked,
 *     restoring that host to the DOM.
 *   - refuses to toggle off the sole remaining enabled metric.
 *
 * Each PhosphorCanvasHost surfaces `data-metric` / `data-y-max` /
 * `data-trace-count` so the view's wiring is observable without reading the
 * canvas's pixel buffer.
 */

import { describe, it, expect, afterEach } from "vitest";
import { act, render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhosphorScopeView } from "./PhosphorScopeView";
import { createMultiSessionStore } from "../../adapters/multiSessionStore";
import { METRIC_IDS, METRICS } from "../../domain/phosphor/phosphorMetricConfig";

afterEach(cleanup);

describe("PhosphorScopeView", () => {
  it("initializes with a canvas host for every supported metric", () => {
    const store = createMultiSessionStore();
    render(<PhosphorScopeView store={store} />);

    const hosts = screen.getAllByTestId("phosphor-canvas-host");
    expect(hosts).toHaveLength(METRIC_IDS.length);
    const metrics = hosts.map((host) => host.getAttribute("data-metric"));
    for (const id of METRIC_IDS) {
      expect(metrics).toContain(id);
    }
  });

  it("subscribes to multiSessionStore and rebuilds every host's frame when the store notifies", () => {
    const store = createMultiSessionStore();

    render(<PhosphorScopeView store={store} />);

    for (const host of screen.getAllByTestId("phosphor-canvas-host")) {
      expect(host.getAttribute("data-trace-count")).toBe("0");
    }

    act(() => {
      store.addSession("sess-a");
    });

    for (const host of screen.getAllByTestId("phosphor-canvas-host")) {
      expect(host.getAttribute("data-trace-count")).toBe("1");
    }
  });

  it("removes a metric's canvas host when its enabled button is clicked", () => {
    const store = createMultiSessionStore();
    render(<PhosphorScopeView store={store} />);

    fireEvent.click(screen.getByRole("button", { name: METRICS.tokens.name }));

    const hosts = screen.getAllByTestId("phosphor-canvas-host");
    expect(hosts).toHaveLength(METRIC_IDS.length - 1);
    const metrics = hosts.map((host) => host.getAttribute("data-metric"));
    expect(metrics).not.toContain("tokens");
  });

  it("restores a metric's canvas host when its disabled button is clicked again", () => {
    const store = createMultiSessionStore();
    render(<PhosphorScopeView store={store} />);

    fireEvent.click(screen.getByRole("button", { name: METRICS.tokens.name }));
    expect(screen.getAllByTestId("phosphor-canvas-host")).toHaveLength(
      METRIC_IDS.length - 1,
    );

    fireEvent.click(screen.getByRole("button", { name: METRICS.tokens.name }));
    const hosts = screen.getAllByTestId("phosphor-canvas-host");
    expect(hosts).toHaveLength(METRIC_IDS.length);
    const metrics = hosts.map((host) => host.getAttribute("data-metric"));
    expect(metrics).toContain("tokens");
  });

  it("will not disable the sole remaining enabled metric", () => {
    const store = createMultiSessionStore();
    render(<PhosphorScopeView store={store} />);

    // Toggle off every metric except the first: the last remaining button
    // must refuse further disable attempts.
    const [survivor, ...toDisable] = METRIC_IDS;
    for (const metric of toDisable) {
      fireEvent.click(screen.getByRole("button", { name: METRICS[metric].name }));
    }
    expect(screen.getAllByTestId("phosphor-canvas-host")).toHaveLength(1);

    const survivorButton = screen.getByRole("button", {
      name: METRICS[survivor].name,
    });
    expect(survivorButton).toBeDisabled();
    fireEvent.click(survivorButton);
    expect(screen.getAllByTestId("phosphor-canvas-host")).toHaveLength(1);
  });

  it("renders the legend alongside the canvas hosts and controls", () => {
    const store = createMultiSessionStore();
    render(<PhosphorScopeView store={store} />);

    expect(screen.getAllByTestId("phosphor-canvas-host").length).toBeGreaterThan(0);
    expect(screen.getByTestId("phosphor-legend")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: METRICS.events.name }),
    ).toBeInTheDocument();
  });
});
