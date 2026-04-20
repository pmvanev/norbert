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

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhosphorLegend } from "./PhosphorLegend";
import type { LegendEntry } from "../../domain/phosphor/scopeProjection";

afterEach(cleanup);

// Legend entries are `LegendEntry` objects with the new `hidden` field.
// Tests that predate the field default to `hidden: false` via this helper.
const makeEntry = (partial: Omit<LegendEntry, "hidden"> & { hidden?: boolean }): LegendEntry => ({
  hidden: false,
  ...partial,
});

describe("PhosphorLegend", () => {
  it("renders one row per legend entry showing session display label and latest value", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      makeEntry({ sessionId: "sess-a", displayLabel: "sess-a", color: "#f472b6", latestValue: 7.25 }),
      makeEntry({ sessionId: "sess-b", displayLabel: "sess-b", color: "#a78bfa", latestValue: 3 }),
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" onToggle={() => {}} />);

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
      makeEntry({
        sessionId: "9ea8ff2a-5207-4e3b-9bba-3fffffffffff",
        displayLabel: "norbert",
        color: "#f472b6",
        latestValue: 1,
      }),
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" onToggle={() => {}} />);

    const row = screen.getByTestId(
      "phosphor-legend-row-9ea8ff2a-5207-4e3b-9bba-3fffffffffff",
    );
    expect(within(row).getByText("norbert")).toBeInTheDocument();
    expect(within(row).queryByText(/9ea8ff2a-5207/)).toBeNull();
  });

  it("applies the entry's color to its swatch", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      makeEntry({ sessionId: "sess-a", displayLabel: "sess-a", color: "#f472b6", latestValue: 1 }),
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" onToggle={() => {}} />);

    const swatch = screen.getByTestId("phosphor-legend-swatch-sess-a");
    // Browsers normalize hex to rgb — accept either representation.
    const background = swatch.style.backgroundColor;
    expect(background === "#f472b6" || background === "rgb(244, 114, 182)").toBe(true);
  });

  it("renders an em-dash for sessions with null latest value", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      makeEntry({
        sessionId: "quiet-session",
        displayLabel: "quiet-session",
        color: "#34d399",
        latestValue: null,
      }),
    ];

    render(<PhosphorLegend legend={legend} unit="tok/s" onToggle={() => {}} />);

    const row = screen.getByTestId("phosphor-legend-row-quiet-session");
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("renders an empty container when the legend has no entries", () => {
    render(<PhosphorLegend legend={[]} unit="evt/s" onToggle={() => {}} />);

    const container = screen.getByTestId("phosphor-legend");
    // No rows at all.
    expect(container.querySelectorAll('[data-testid^="phosphor-legend-row-"]')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Toggle-visibility behavior — clicking a legend entry flips the trace's
// visibility. The entry renders as a <button> (full-row click target, space
// / enter keyboard support, `aria-pressed` reflecting visible/hidden).
//
// Hidden entries remain present (so users can click them again to un-hide)
// but are visually deemphasized and the backing entry's `hidden: true` is
// mirrored into `aria-pressed="false"` (pressed = visible).
// ---------------------------------------------------------------------------

describe("PhosphorLegend — toggle-visibility interaction", () => {
  it("fires onToggle with the session id when an entry is clicked", () => {
    const onToggle = vi.fn();
    const legend: ReadonlyArray<LegendEntry> = [
      makeEntry({ sessionId: "sess-a", displayLabel: "sess-a", color: "#f472b6", latestValue: 1 }),
      makeEntry({ sessionId: "sess-b", displayLabel: "sess-b", color: "#a78bfa", latestValue: 2 }),
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" onToggle={onToggle} />);

    fireEvent.click(screen.getByTestId("phosphor-legend-row-sess-a"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("sess-a");

    fireEvent.click(screen.getByTestId("phosphor-legend-row-sess-b"));
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenLastCalledWith("sess-b");
  });

  it("renders each entry as a button so keyboard activation (Enter/Space) works via native semantics", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      makeEntry({ sessionId: "sess-a", displayLabel: "sess-a", color: "#f472b6", latestValue: 1 }),
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" onToggle={() => {}} />);

    const row = screen.getByTestId("phosphor-legend-row-sess-a");
    expect(row.tagName).toBe("BUTTON");
    expect(row).toHaveAttribute("type", "button");
  });

  it("mirrors visibility into aria-pressed — visible entries are pressed=true, hidden pressed=false", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      makeEntry({
        sessionId: "visible",
        displayLabel: "visible",
        color: "#f472b6",
        latestValue: 1,
        hidden: false,
      }),
      makeEntry({
        sessionId: "hidden",
        displayLabel: "hidden",
        color: "#a78bfa",
        latestValue: 2,
        hidden: true,
      }),
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" onToggle={() => {}} />);

    expect(screen.getByTestId("phosphor-legend-row-visible")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("phosphor-legend-row-hidden")).toHaveAttribute("aria-pressed", "false");
  });

  it("applies the -hidden class to hidden entries so they can be visually deemphasized", () => {
    const legend: ReadonlyArray<LegendEntry> = [
      makeEntry({
        sessionId: "hidden",
        displayLabel: "hidden",
        color: "#a78bfa",
        latestValue: 2,
        hidden: true,
      }),
      makeEntry({
        sessionId: "visible",
        displayLabel: "visible",
        color: "#f472b6",
        latestValue: 1,
        hidden: false,
      }),
    ];

    render(<PhosphorLegend legend={legend} unit="evt/s" onToggle={() => {}} />);

    const hiddenRow = screen.getByTestId("phosphor-legend-row-hidden");
    const visibleRow = screen.getByTestId("phosphor-legend-row-visible");
    expect(hiddenRow.className).toMatch(/phosphor-legend-row-hidden/);
    expect(visibleRow.className).not.toMatch(/phosphor-legend-row-hidden/);
  });
});
