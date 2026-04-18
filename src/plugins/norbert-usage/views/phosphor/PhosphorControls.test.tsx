/**
 * @vitest-environment jsdom
 */
/**
 * Unit tests: PhosphorControls (Step 09-01)
 *
 * Segmented control for selecting the scope's Y-axis metric. Renders three
 * buttons (events | tokens | toolcalls) and fires `onMetricChange` with the
 * chosen MetricId when a non-active button is clicked.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhosphorControls } from "./PhosphorControls";
import { METRICS } from "../../domain/phosphor/phosphorMetricConfig";

afterEach(cleanup);

describe("PhosphorControls", () => {
  it("renders one button per metric with the metric's display name", () => {
    render(<PhosphorControls selectedMetric="events" onMetricChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: METRICS.events.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: METRICS.tokens.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: METRICS.toolcalls.name })).toBeInTheDocument();
  });

  it("fires onMetricChange with 'tokens' when the tokens button is clicked", () => {
    const onMetricChange = vi.fn();
    render(<PhosphorControls selectedMetric="events" onMetricChange={onMetricChange} />);

    fireEvent.click(screen.getByRole("button", { name: METRICS.tokens.name }));

    expect(onMetricChange).toHaveBeenCalledTimes(1);
    expect(onMetricChange).toHaveBeenCalledWith("tokens");
  });

  it("marks the selected metric's button as active via aria-pressed", () => {
    render(<PhosphorControls selectedMetric="tokens" onMetricChange={vi.fn()} />);

    const tokensButton = screen.getByRole("button", { name: METRICS.tokens.name });
    const eventsButton = screen.getByRole("button", { name: METRICS.events.name });

    expect(tokensButton).toHaveAttribute("aria-pressed", "true");
    expect(eventsButton).toHaveAttribute("aria-pressed", "false");
  });
});
