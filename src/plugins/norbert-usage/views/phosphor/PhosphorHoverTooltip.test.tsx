/**
 * @vitest-environment jsdom
 */
/**
 * Unit tests: PhosphorHoverTooltip (Step 09-01)
 *
 * Prop-in functional component. Renders a positioned div showing
 * "session · value unit · age" when `selection` is non-null, or nothing
 * when `selection` is null.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhosphorHoverTooltip } from "./PhosphorHoverTooltip";
import type { HoverSelection } from "../../domain/phosphor/scopeHitTest";

afterEach(cleanup);

describe("PhosphorHoverTooltip", () => {
  it("renders nothing when selection is null", () => {
    const { container } = render(
      <PhosphorHoverTooltip selection={null} unit="evt/s" />,
    );

    // No tooltip element at all.
    expect(container.querySelector('[data-testid="phosphor-hover-tooltip"]')).toBeNull();
  });

  it("renders session id, formatted value with unit, and age when selection is present", () => {
    const selection: HoverSelection = {
      sessionId: "sess-a",
      color: "#f472b6",
      value: 12.5,
      time: 1_000_000,
      ageMs: 3_500,
      displayX: 120,
      displayY: 40,
    };

    render(<PhosphorHoverTooltip selection={selection} unit="evt/s" />);

    const tooltip = screen.getByTestId("phosphor-hover-tooltip");
    expect(tooltip).toHaveTextContent("sess-a");
    expect(tooltip).toHaveTextContent(/12\.5/);
    expect(tooltip).toHaveTextContent(/evt\/s/);
    // Age rendered as seconds (3.5s) — any representation that includes 3 and s is acceptable.
    expect(tooltip).toHaveTextContent(/3/);
    expect(tooltip).toHaveTextContent(/s/);
  });

  it("positions the tooltip at the selection's displayX/displayY", () => {
    const selection: HoverSelection = {
      sessionId: "sess-b",
      color: "#a78bfa",
      value: 1,
      time: 1_000_000,
      ageMs: 0,
      displayX: 240,
      displayY: 80,
    };

    render(<PhosphorHoverTooltip selection={selection} unit="calls/s" />);

    const tooltip = screen.getByTestId("phosphor-hover-tooltip");
    expect(tooltip.style.left).toBe("240px");
    expect(tooltip.style.top).toBe("80px");
  });
});
