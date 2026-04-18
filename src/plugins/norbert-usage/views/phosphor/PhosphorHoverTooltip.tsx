/**
 * PhosphorHoverTooltip — prop-in minimal tooltip.
 *
 * Given a `HoverSelection` (or null), renders either:
 *   - nothing (selection is null), or
 *   - a positioned div showing "session · value unit · age".
 *
 * The tooltip is absolutely positioned at `displayX` / `displayY` supplied
 * by the hit-test result; no internal geometry logic lives here. The
 * component is a pure rendering function — no effects, no state.
 *
 * Edge-flipping (tooltip flips to the left/above when near a canvas edge)
 * will be layered on in a later pass if needed; the initial contract is
 * to render at the supplied position as-is.
 */

import type { HoverSelection } from "../../domain/phosphor/scopeHitTest";

interface PhosphorHoverTooltipProps {
  readonly selection: HoverSelection | null;
  readonly unit: string;
}

/** Format a raw value for tooltip display with the metric's unit. */
const formatValue = (value: number, unit: string): string => {
  const rendered = Number.isInteger(value) ? `${value}` : value.toFixed(2);
  return `${rendered} ${unit}`;
};

/**
 * Format an age in milliseconds as a compact "Ns ago" style string. Ages
 * under a second render as "now"; ages under a minute use one decimal for
 * seconds; ages beyond a minute fall back to whole-second notation.
 */
const formatAge = (ageMs: number): string => {
  if (ageMs < 250) return "now";
  const seconds = ageMs / 1000;
  if (seconds < 10) return `${seconds.toFixed(1)}s ago`;
  return `${Math.round(seconds)}s ago`;
};

export const PhosphorHoverTooltip = ({
  selection,
  unit,
}: PhosphorHoverTooltipProps) => {
  if (selection === null) return null;

  return (
    <div
      className="phosphor-hover-tooltip"
      data-testid="phosphor-hover-tooltip"
      style={{
        position: "absolute",
        left: `${selection.displayX}px`,
        top: `${selection.displayY}px`,
        // The canvas host is the positioning context; the tooltip floats
        // above whatever trace is at (displayX, displayY).
        pointerEvents: "none",
        borderLeft: `2px solid ${selection.color}`,
      }}
    >
      <span className="phosphor-hover-session">{selection.sessionId}</span>
      <span className="phosphor-hover-sep"> · </span>
      <span className="phosphor-hover-value" data-mono="">
        {formatValue(selection.value, unit)}
      </span>
      <span className="phosphor-hover-sep"> · </span>
      <span className="phosphor-hover-age" data-mono="">
        {formatAge(selection.ageMs)}
      </span>
    </div>
  );
};
