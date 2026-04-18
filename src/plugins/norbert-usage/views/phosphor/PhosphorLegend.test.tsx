/**
 * @vitest-environment jsdom
 */
/**
 * Unit tests: PhosphorLegend (Step 09-01)
 *
 * Reads `frame.legend` (read-only) and renders one row per session with:
 *   - a color dot matching the legend entry color
 *   - the session id
 *   - the session's latest value (formatted) or an em-dash when null
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhosphorLegend } from "./PhosphorLegend";
import type { LegendEntry } from "../../domain/phosphor/scopeProjection";

afterEach(cleanup);

describe("PhosphorLegend", () => {
  it("renders one row per legend entry showing session display label and latest value", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      { sessionId: "sess-a", displayLabel: "sess-a", color: "#f472b6", latestValue: 7.25 },
      { sessionId: "sess-b", displayLabel: "sess-b", color: "#a78bfa", latestValue: 3 },
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" />);

    const rowA = screen.getByTestId("phosphor-legend-row-sess-a");
    const rowB = screen.getByTestId("phosphor-legend-row-sess-b");

    expect(within(rowA).getByText("sess-a")).toBeInTheDocument();
    expect(within(rowA).getByText(/7\.25/)).toBeInTheDocument();
    expect(within(rowB).getByText("sess-b")).toBeInTheDocument();
    expect(within(rowB).getByText(/\b3\b/)).toBeInTheDocument();
  });

  it("renders the display label in preference to the raw sessionId", () => {
    // The visible text is `displayLabel` — the legend shows the friendly
    // name (project cwd) instead of the raw UUID. The raw id remains
    // accessible via the `title` attribute for power-user diagnostics.
    const legend: ReadonlyArray<LegendEntry> = [
      {
        sessionId: "9ea8ff2a-5207-4e3b-9bba-3fffffffffff",
        displayLabel: "norbert",
        color: "#f472b6",
        latestValue: 1,
      },
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" />);

    const row = screen.getByTestId(
      "phosphor-legend-row-9ea8ff2a-5207-4e3b-9bba-3fffffffffff",
    );
    expect(within(row).getByText("norbert")).toBeInTheDocument();
    expect(within(row).queryByText(/9ea8ff2a-5207/)).toBeNull();
  });

  it("applies the entry's color to its swatch", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      { sessionId: "sess-a", displayLabel: "sess-a", color: "#f472b6", latestValue: 1 },
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" />);

    const swatch = screen.getByTestId("phosphor-legend-swatch-sess-a");
    // Browsers normalize hex to rgb — accept either representation.
    const background = swatch.style.backgroundColor;
    expect(background === "#f472b6" || background === "rgb(244, 114, 182)").toBe(true);
  });

  it("renders an em-dash for sessions with null latest value", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      {
        sessionId: "quiet-session",
        displayLabel: "quiet-session",
        color: "#34d399",
        latestValue: null,
      },
    ];

    render(<PhosphorLegend legend={legend} unit="tok/s" />);

    const row = screen.getByTestId("phosphor-legend-row-quiet-session");
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("renders an empty container when the legend has no entries", () => {
    render(<PhosphorLegend legend={[]} unit="evt/s" />);

    const container = screen.getByTestId("phosphor-legend");
    // No rows at all.
    expect(container.querySelectorAll('[data-testid^="phosphor-legend-row-"]')).toHaveLength(0);
  });
});
