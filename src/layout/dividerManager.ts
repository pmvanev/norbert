/**
 * Divider Manager — pure functions for divider position management.
 *
 * The divider position is stored as a ratio (0.0–1.0) for resolution
 * independence. All clamping and width computation is pure.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ZoneWidths = {
  readonly mainWidth: number;
  readonly secondaryWidth: number;
};

// ---------------------------------------------------------------------------
// clampDividerPosition — enforce minimum zone widths on both sides
// ---------------------------------------------------------------------------

/**
 * Clamps a divider ratio so that both zones meet the minimum pixel width
 * given the current container width.
 *
 * minRatio = minZoneWidth / containerWidth  (left/Main zone minimum)
 * maxRatio = 1 - minZoneWidth / containerWidth  (right/Secondary zone minimum)
 */
export const clampDividerPosition = (
  ratio: number,
  containerWidth: number,
  minZoneWidth: number
): number => {
  const minRatio = minZoneWidth / containerWidth;
  const maxRatio = 1 - minZoneWidth / containerWidth;
  return Math.min(Math.max(ratio, minRatio), maxRatio);
};

// ---------------------------------------------------------------------------
// snapToCenter — double-click handler returns 0.5
// ---------------------------------------------------------------------------

/**
 * Returns the center ratio (0.5) for a 50/50 split.
 */
export const snapToCenter = (): number => 0.5;

// ---------------------------------------------------------------------------
// computeZoneWidths — ratio + container width -> pixel widths
// ---------------------------------------------------------------------------

/**
 * Computes pixel widths for Main (left) and Secondary (right) zones
 * given a divider ratio and container width.
 */
export const computeZoneWidths = (
  ratio: number,
  containerWidth: number
): ZoneWidths => ({
  mainWidth: ratio * containerWidth,
  secondaryWidth: (1 - ratio) * containerWidth,
});
