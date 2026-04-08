/**
 * Chart View Helpers -- pure functions extracted from view components.
 *
 * These functions compute layout, scaling, and formatting values that
 * were previously embedded in React component bodies. Extracting them
 * to the domain layer makes them testable without mounting components.
 *
 * No IO, no React imports, no side effects.
 */

import type { MetricCategory } from "./categoryConfig";
import type { TimeWindowId, RateSample } from "./types";
import type { RateField } from "./oscilloscope";

// ---------------------------------------------------------------------------
// effectiveYMax -- autoscale Y-axis from data with 10% headroom
// ---------------------------------------------------------------------------

/**
 * Compute the effective Y-axis maximum for a chart.
 *
 * When samples exist and have a positive peak, adds 10% headroom.
 * Falls back to the provided yMax (or 1 if undefined) when:
 *   - samples are empty
 *   - peak is zero (all values are zero)
 */
export const computeEffectiveYMax = (
  samples: ReadonlyArray<RateSample>,
  field: RateField,
  yMax: number | undefined,
): number => {
  if (samples.length === 0) return yMax ?? 1;
  const peak = samples.reduce((max, s) => Math.max(max, s[field]), 0);
  return peak > 0 ? peak * 1.1 : (yMax ?? 1);
};

// ---------------------------------------------------------------------------
// hexToRgba -- parse hex color to rgba string
// ---------------------------------------------------------------------------

/**
 * Convert a hex color string (#rrggbb) to an rgba() CSS string.
 * Returns white with the given alpha if the hex format is invalid.
 */
export const hexToRgba = (color: string, alpha: number): string => {
  const match = color.match(/#([0-9a-f]{6})/i);
  if (match) {
    const r = parseInt(match[1].slice(0, 2), 16);
    const g = parseInt(match[1].slice(2, 4), 16);
    const b = parseInt(match[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(255, 255, 255, ${alpha})`;
};

// ---------------------------------------------------------------------------
// Tooltip positioning
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
export const computeTooltipLeft = (
  tooltipX: number,
  containerWidth: number,
): number => {
  const wouldOverflowRight = tooltipX + TOOLTIP_OFFSET_X + TOOLTIP_WIDTH > containerWidth;
  return wouldOverflowRight
    ? tooltipX - TOOLTIP_OFFSET_X - TOOLTIP_WIDTH
    : tooltipX + TOOLTIP_OFFSET_X;
};

/**
 * Compute tooltip top position from cursor Y.
 */
export const computeTooltipTop = (tooltipY: number): number =>
  tooltipY + TOOLTIP_OFFSET_Y;

/**
 * Compute tooltip left position with measured width and viewport clamp.
 *
 * - tooltipX comes from PMChart already divided by the canvas CSS-zoom
 *   factor, so we normalize containerWidth by docZoom (set on
 *   documentElement for Ctrl-+/-) to compare in the same space.
 * - Flips to the left of cursor when the tooltip would overflow.
 * - Clamps the result to [margin, rightEdge - width] as a safety net so
 *   the tooltip can never extend past the viewport regardless of any
 *   upstream coordinate-space quirks.
 */
export const computeTooltipLeftClamped = (
  tooltipX: number,
  tooltipWidth: number,
  containerWidth: number,
  docZoom: number,
): number => {
  const effectiveContainerWidth = containerWidth / docZoom;
  const rightEdge = effectiveContainerWidth - TOOLTIP_OFFSET_X;
  const preferredLeft =
    tooltipX + TOOLTIP_OFFSET_X + tooltipWidth > rightEdge
      ? tooltipX - TOOLTIP_OFFSET_X - tooltipWidth
      : tooltipX + TOOLTIP_OFFSET_X;
  return Math.max(
    TOOLTIP_OFFSET_X,
    Math.min(preferredLeft, rightEdge - tooltipWidth),
  );
};

// ---------------------------------------------------------------------------
// Layout helpers (from PMDetailPane)
// ---------------------------------------------------------------------------

/** Determine grid column count based on session count. */
export const computeGridColumns = (sessionCount: number): number =>
  sessionCount <= 4 ? 2 : 3;

/** Determine whether to show the per-session grid. */
export const shouldShowPerSessionGrid = (sessionCount: number): boolean =>
  sessionCount > 1;

/** Determine whether to show the aggregate graph. */
export const shouldShowAggregateGraph = (category: MetricCategory): boolean =>
  category.aggregateApplicable;

/** Format a session display label from sessionLabel (project name from cwd). */
export const formatSessionLabel = (
  session: { readonly sessionId: string; readonly sessionLabel: string },
): string =>
  session.sessionLabel || session.sessionId.slice(0, 8);

/** Map a TimeWindowId to a human-readable duration label. */
export const formatDurationLabel = (windowId: TimeWindowId): string => {
  switch (windowId) {
    case "1m": return "60 seconds";
  }
};
