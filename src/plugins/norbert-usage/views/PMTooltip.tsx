/**
 * PMTooltip: floating tooltip for chart hover state.
 *
 * Renders a fixed-position DOM element (not canvas-rendered) showing:
 *   - Formatted value (e.g., "842 tok/s")
 *   - Time offset (e.g., "22s ago")
 *   - Border color matching the category line color
 *
 * Positioned near the cursor. Flips horizontally when near the right
 * edge to stay within viewport bounds.
 *
 * Pure presentational component -- all data arrives via HoverState.
 */

import type { HoverState } from "../domain/types";
import { computeTooltipLeft, computeTooltipTop } from "../domain/chartViewHelpers";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMTooltipProps {
  readonly hoverState: HoverState;
  readonly containerWidth?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMTooltip = ({
  hoverState,
  containerWidth = typeof window !== "undefined" ? window.innerWidth : 800,
}: PMTooltipProps) => {
  if (!hoverState.active) {
    return null;
  }

  const left = computeTooltipLeft(hoverState.tooltipX, containerWidth);
  const top = computeTooltipTop(hoverState.tooltipY);

  return (
    <div
      className="pm-tooltip"
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        borderColor: hoverState.color,
      }}
      data-testid="pm-tooltip"
    >
      <span className="pm-tooltip-value" data-mono="true">
        {hoverState.formattedValue}
      </span>
      <span className="pm-tooltip-time" data-mono="true">
        {hoverState.timeOffset}
      </span>
    </div>
  );
};
