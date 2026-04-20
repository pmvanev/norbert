/**
 * @vitest-environment jsdom
 */
/**
 * Unit tests: PhosphorHoverTooltip (Step 09-01 + post-deliver cursor-track fix)
 *
 * Prop-in functional component. Renders a positioned div showing
 * "session · value unit · age" when `selection` is non-null, or nothing
 * when `selection` is null.
 *
 * Positioning contract:
 *   - When `selection.pointerClientX/Y` are present, renders into a
 *     `document.body` portal with `position: fixed` anchored to the cursor
 *     (with a small offset) and edge-flips at viewport bounds.
 *   - When absent, falls back to the canvas-local `displayX/displayY` with
 *     `position: absolute`, inline with the caller's positioning context.
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
    // And nothing was portaled to document.body either.
    expect(
      document.body.querySelector('[data-testid="phosphor-hover-tooltip"]'),
    ).toBeNull();
  });

  it("renders display label, formatted value with unit, and age when selection is present", () => {
    const selection: HoverSelection = {
      sessionId: "sess-a",
      displayLabel: "sess-a",
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

  it("renders the display label in preference to the raw sessionId", () => {
    // The tooltip's visible identity comes from `displayLabel` so users
    // never see a raw UUID when a session has a known cwd label.
    const selection: HoverSelection = {
      sessionId: "9ea8ff2a-5207-4e3b-9bba-3fffffffffff",
      displayLabel: "norbert",
      color: "#f472b6",
      value: 1,
      time: 1_000_000,
      ageMs: 0,
      displayX: 0,
      displayY: 0,
    };

    render(<PhosphorHoverTooltip selection={selection} unit="evt/s" />);

    const tooltip = screen.getByTestId("phosphor-hover-tooltip");
    expect(tooltip).toHaveTextContent("norbert");
    expect(tooltip.textContent ?? "").not.toContain("9ea8ff2a-5207");
  });

  it("falls back to displayX/displayY with position: absolute when no pointer client coords are supplied", () => {
    // Legacy / test path: no mouse event context, so the component positions
    // at the trace sample point exactly as before.
    const selection: HoverSelection = {
      sessionId: "sess-b",
      displayLabel: "sess-b",
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
    expect(tooltip.style.position).toBe("absolute");
  });

  it("positions at the cursor's viewport coords with a small offset and position: fixed when pointer client coords are supplied", () => {
    // Ensure the "below-right" placement is chosen (not edge-flipped) by
    // picking coords well inside the jsdom default viewport (1024x768).
    const selection: HoverSelection = {
      sessionId: "sess-c",
      displayLabel: "sess-c",
      color: "#34d399",
      value: 5,
      time: 1_000_000,
      ageMs: 0,
      displayX: 0, // would place at canvas origin; cursor coords must win
      displayY: 0,
      pointerClientX: 300,
      pointerClientY: 200,
    };

    render(<PhosphorHoverTooltip selection={selection} unit="evt/s" />);

    const tooltip = screen.getByTestId("phosphor-hover-tooltip");
    // Offset is 12px below-right of the cursor.
    expect(tooltip.style.left).toBe("312px");
    expect(tooltip.style.top).toBe("212px");
    expect(tooltip.style.position).toBe("fixed");
  });

  it("portals to document.body when pointer client coords are supplied", () => {
    // The portal is what rescues the tooltip from the canvas-wrap's
    // `overflow: hidden` clipping context. Absence of the tooltip in the
    // rendered container proves the portal is active.
    const selection: HoverSelection = {
      sessionId: "sess-d",
      displayLabel: "sess-d",
      color: "#60a5fa",
      value: 7,
      time: 1_000_000,
      ageMs: 0,
      displayX: 0,
      displayY: 0,
      pointerClientX: 100,
      pointerClientY: 100,
    };

    const { container } = render(
      <PhosphorHoverTooltip selection={selection} unit="evt/s" />,
    );

    // Not in the rendered subtree (it portaled out)...
    expect(
      container.querySelector('[data-testid="phosphor-hover-tooltip"]'),
    ).toBeNull();
    // ...but it IS in document.body.
    expect(
      document.body.querySelector('[data-testid="phosphor-hover-tooltip"]'),
    ).not.toBeNull();
  });

  it("edge-flips left when below-right placement would overflow the viewport's right edge", () => {
    // jsdom defaults window.innerWidth to 1024. Place the cursor close to
    // the right edge so the preferred placement (clientX + 12) + tooltip
    // width would overflow; the component must flip to the left.
    const selection: HoverSelection = {
      sessionId: "edge-r",
      displayLabel: "edge-r",
      color: "#fbbf24",
      value: 3,
      time: 1_000_000,
      ageMs: 0,
      displayX: 0,
      displayY: 0,
      pointerClientX: 1000, // near the right edge (window.innerWidth defaults to 1024)
      pointerClientY: 200,
    };

    render(<PhosphorHoverTooltip selection={selection} unit="evt/s" />);

    const tooltip = screen.getByTestId("phosphor-hover-tooltip");
    const left = parseFloat(tooltip.style.left);
    // Flipped placement: to the left of the cursor → left < clientX.
    expect(left).toBeLessThan(1000);
    // And the tooltip does not overflow the right edge.
    expect(left).toBeLessThanOrEqual(1024);
  });

  it("edge-flips up when below-right placement would overflow the viewport's bottom edge", () => {
    // jsdom defaults window.innerHeight to 768. Place the cursor near the
    // bottom so the preferred placement (clientY + 12) + tooltip height
    // would overflow; the component must flip to above the cursor.
    const selection: HoverSelection = {
      sessionId: "edge-b",
      displayLabel: "edge-b",
      color: "#a78bfa",
      value: 2,
      time: 1_000_000,
      ageMs: 0,
      displayX: 0,
      displayY: 0,
      pointerClientX: 300,
      pointerClientY: 760, // near the bottom edge (window.innerHeight defaults to 768)
    };

    render(<PhosphorHoverTooltip selection={selection} unit="evt/s" />);

    const tooltip = screen.getByTestId("phosphor-hover-tooltip");
    const top = parseFloat(tooltip.style.top);
    // Flipped placement: above the cursor → top < clientY.
    expect(top).toBeLessThan(760);
  });
});
