/**
 * @vitest-environment jsdom
 */
/**
 * Unit tests: PhosphorControls — per-metric toggle control.
 *
 * Renders three buttons (events | tokens | toolcalls); each button reflects
 * whether its metric is enabled via `aria-pressed` and fires
 * `onMetricToggle` with the MetricId when clicked. The sole remaining
 * enabled metric's button is disabled so the user cannot empty the graph.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhosphorControls } from "./PhosphorControls";
import { METRICS } from "../../domain/phosphor/phosphorMetricConfig";

afterEach(cleanup);

describe("PhosphorControls", () => {
  it("renders one button per metric with the metric's display name", () => {
    render(
      <PhosphorControls
        enabledMetrics={new Set(["events"])}
        onMetricToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: METRICS.events.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: METRICS.tokens.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: METRICS.toolcalls.name })).toBeInTheDocument();
  });

  it("fires onMetricToggle with 'tokens' when the tokens button is clicked", () => {
    const onMetricToggle = vi.fn();
    render(
      <PhosphorControls
        enabledMetrics={new Set(["events"])}
        onMetricToggle={onMetricToggle}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: METRICS.tokens.name }));

    expect(onMetricToggle).toHaveBeenCalledTimes(1);
    expect(onMetricToggle).toHaveBeenCalledWith("tokens");
  });

  it("marks each enabled metric's button as aria-pressed=true", () => {
    render(
      <PhosphorControls
        enabledMetrics={new Set(["events", "tokens"])}
        onMetricToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: METRICS.events.name }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: METRICS.tokens.name }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: METRICS.toolcalls.name }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("disables the sole remaining enabled metric's button", () => {
    render(
      <PhosphorControls
        enabledMetrics={new Set(["events"])}
        onMetricToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: METRICS.events.name })).toBeDisabled();
    expect(screen.getByRole("button", { name: METRICS.tokens.name })).not.toBeDisabled();
  });

  it("re-enables all buttons once more than one metric is active", () => {
    render(
      <PhosphorControls
        enabledMetrics={new Set(["events", "tokens"])}
        onMetricToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: METRICS.events.name })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: METRICS.tokens.name })).not.toBeDisabled();
  });
});
