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

// ---------------------------------------------------------------------------
// Pure layout helpers
// ---------------------------------------------------------------------------

/** Tooltip width estimate for edge-flip calculation. */
const TOOLTIP_WIDTH = 140;

/** Offset from cursor position. */
const TOOLTIP_OFFSET_X = 8;
const TOOLTIP_OFFSET_Y = -8;

/**
 * Compute tooltip left position, flipping to the left side of the
 * cursor when the tooltip would overflow the right edge.
 */
const computeTooltipLeft = (
  tooltipX: number,
  containerWidth: number,
): number => {
  const wouldOverflowRight = tooltipX + TOOLTIP_OFFSET_X + TOOLTIP_WIDTH > containerWidth;
  return wouldOverflowRight
    ? tooltipX - TOOLTIP_OFFSET_X - TOOLTIP_WIDTH
    : tooltipX + TOOLTIP_OFFSET_X;
};

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
  containerWidth = 800,
}: PMTooltipProps) => {
  if (!hoverState.active) {
    return null;
  }

  const left = computeTooltipLeft(hoverState.tooltipX, containerWidth);
  const top = hoverState.tooltipY + TOOLTIP_OFFSET_Y;

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
