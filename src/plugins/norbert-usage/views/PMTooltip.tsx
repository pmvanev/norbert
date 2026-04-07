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
 * Rendered via React portal into document.body to ensure position: fixed
 * resolves against the viewport, not a transformed/filtered ancestor.
 *
 * Pure presentational component -- all data arrives via HoverState.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (tooltipRef.current) {
      setMeasuredWidth(tooltipRef.current.offsetWidth);
    }
  }, [hoverState.active, hoverState.formattedValue, hoverState.timeOffset]);

  if (!hoverState.active) {
    return null;
  }

  // tooltipX comes from PMChart already divided by the canvas CSS-zoom
  // factor, so compare against the same space by dividing containerWidth
  // by the documentElement zoom (set in main.tsx for Ctrl-+/-).
  const docZoom =
    typeof document !== "undefined"
      ? parseFloat(document.documentElement.style.zoom || "1") || 1
      : 1;
  const effectiveContainerWidth = containerWidth / docZoom;
  const width = measuredWidth ?? 140;
  const EDGE_MARGIN = 8;

  // Flip to the left of cursor when the tooltip would overflow the right
  // edge. Then clamp as a safety net so it can never extend past the
  // viewport regardless of upstream coordinate-space quirks.
  const rightEdge = effectiveContainerWidth - EDGE_MARGIN;
  const preferredLeft =
    hoverState.tooltipX + 8 + width > rightEdge
      ? hoverState.tooltipX - 8 - width
      : hoverState.tooltipX + 8;
  const left = Math.max(
    EDGE_MARGIN,
    Math.min(preferredLeft, rightEdge - width),
  );
  void computeTooltipLeft; // kept exported for existing unit tests
  const top = computeTooltipTop(hoverState.tooltipY);

  const tooltip = (
    <div
      ref={tooltipRef}
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

  // Portal to document.body so position: fixed is always viewport-relative,
  // even if an ancestor has transform/filter/backdrop-filter.
  if (typeof document !== "undefined") {
    return createPortal(tooltip, document.body);
  }

  return tooltip;
};
