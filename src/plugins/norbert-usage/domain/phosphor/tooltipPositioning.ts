/**
 * Tooltip positioning math — pure helpers shared by the phosphor view's
 * pointer handlers. Hosts:
 *   - `normalizeClientPointer`: CSS-zoom compensation for portal tooltips.
 *   - `clampTooltipLeft` / `clampTooltipTop`: edge-flip + viewport-clamp
 *     math used by `PhosphorHoverTooltip` so the tooltip never extends
 *     past the viewport (mirrors v1 PM's `computeTooltipLeftClamped`
 *     pattern from chartViewHelpers.ts at 6d5d2f1^).
 *
 * Why normalizeClientPointer exists:
 *   `document.documentElement.style.zoom` (set by Ctrl-+/- in main.tsx)
 *   inflates `getBoundingClientRect()` by the zoom factor relative to the
 *   canvas's unzoomed logical size (what `ResizeObserver.contentRect`
 *   returns). `event.clientX/Y` arrive in that zoomed coordinate space,
 *   but `position: fixed` resolves against unzoomed CSS layout pixels.
 *   The ratio of zoomed rect dimensions to unzoomed logical dimensions
 *   IS the CSS zoom factor; dividing client coords by that ratio returns
 *   them to the coordinate space the portal tooltip expects.
 *   Mirrors the v1 PM fix landed in commit cf7af6c.
 *
 * Why clampTooltipLeft/clampTooltipTop exist:
 *   The previous edge-flip in `PhosphorHoverTooltip` used a hardcoded
 *   220×30 estimate. Real tooltips — with long session labels like
 *   "norbert-performance-monitor" plus value + age — easily exceed 220px,
 *   so the right-edge flip never triggered and the tooltip clipped. The
 *   fix mirrors v1's chartViewHelpers.computeTooltipLeftClamped: the view
 *   measures its actual rendered width via useLayoutEffect + ref, then
 *   feeds the measured width into a pure clamp that both flips AND clamps
 *   to viewport bounds as a last-resort safety net.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`,
 * or any other phosphor domain module.
 */

interface Dimensions {
  readonly width: number;
  readonly height: number;
}

interface NormalizedPointer {
  readonly normalizedClientX: number;
  readonly normalizedClientY: number;
}

/**
 * Normalize a viewport-space pointer coordinate (event.clientX/Y) out of
 * CSS-zoomed coordinates into unzoomed CSS layout pixels.
 *
 * Inputs:
 *   - `clientX`, `clientY`: coordinates as reported by the pointer event.
 *     When `document.documentElement.style.zoom` is non-1, these are in
 *     the ZOOMED coordinate space.
 *   - `rect`: the canvas's `getBoundingClientRect()` width/height — ZOOMED
 *     dimensions (clientRect is affected by CSS zoom).
 *   - `logicalDims`: the canvas's unzoomed logical size, i.e. the
 *     `ResizeObserver.contentRect` width/height. Independent of CSS zoom.
 *
 * Fallback: when `rect.width === 0` or `rect.height === 0` (layout race,
 * measurement anomaly), the axis collapses to identity rather than
 * dividing by zero. This matches the v1 PM behaviour.
 *
 * Axes normalize independently — non-uniform zoom (e.g. parent transform
 * scaling only one dimension) stays correct.
 */
export const normalizeClientPointer = (
  clientX: number,
  clientY: number,
  rect: Dimensions,
  logicalDims: Dimensions,
): NormalizedPointer => {
  const cssZoomX = rect.width > 0 ? rect.width / logicalDims.width : 1;
  const cssZoomY = rect.height > 0 ? rect.height / logicalDims.height : 1;
  return {
    normalizedClientX: cssZoomX === 1 ? clientX : clientX / cssZoomX,
    normalizedClientY: cssZoomY === 1 ? clientY : clientY / cssZoomY,
  };
};

// ---------------------------------------------------------------------------
// clampTooltipLeft / clampTooltipTop — edge-flip + viewport clamp
// ---------------------------------------------------------------------------

/**
 * Compute the tooltip's viewport `left` given the pointer's client x, the
 * tooltip's measured width, the viewport width, and the preferred offset
 * from the pointer (e.g. +12 for "below-right" placement).
 *
 * Algorithm:
 *   1. Preferred placement: `pointerClientX + preferredOffset`.
 *   2. If that would overflow the right edge (preferred + width > viewport),
 *      flip to the left of the pointer: `pointerClientX - preferredOffset - width`.
 *   3. Clamp to `[preferredOffset, viewportWidth - width]` as a safety net so
 *      the tooltip can never extend past the viewport even if the pointer
 *      itself is outside or the tooltip is wider than the viewport allows.
 *
 * Mirrors v1 PM's `computeTooltipLeftClamped` (chartViewHelpers.ts @ 6d5d2f1^).
 *
 * Coordinate-space contract (important):
 *   All four inputs MUST be in the SAME coordinate space. `normalizeClientPointer`
 *   takes care of the POINTER side — dividing `event.clientX/Y` by the CSS-zoom
 *   factor — but the VIEWPORT side needs the same treatment at the caller.
 *   `window.innerWidth/Height` stay in physical CSS pixels regardless of
 *   `document.documentElement.style.zoom`, so the caller must divide them by
 *   the same docZoom before passing `viewportWidth` in. See
 *   `PhosphorHoverTooltip.viewportSize()` and v1's `effectiveContainerWidth =
 *   containerWidth / docZoom`. Skipping the viewport normalization makes the
 *   flip decision fire on the wrong comparison and the tooltip clips at
 *   non-1.0 page zoom.
 *
 * Pure: deterministic in its arguments.
 */
export const clampTooltipLeft = (
  pointerClientX: number,
  tooltipWidth: number,
  viewportWidth: number,
  preferredOffset: number,
): number => {
  const preferredLeft =
    pointerClientX + preferredOffset + tooltipWidth > viewportWidth
      ? pointerClientX - preferredOffset - tooltipWidth
      : pointerClientX + preferredOffset;
  // Safety clamp: never extend past the viewport's right edge, never go
  // negative. When viewportWidth < tooltipWidth (degenerate), the upper
  // bound is negative; Math.min then Math.max yields 0 (never negative).
  const upperBound = Math.max(0, viewportWidth - tooltipWidth);
  return Math.max(0, Math.min(preferredLeft, upperBound));
};

/**
 * Compute the tooltip's viewport `top` given the pointer's client y, the
 * tooltip's measured height, the viewport height, and the preferred offset.
 *
 * Symmetric to clampTooltipLeft: below-preferred, flips above when it would
 * overflow the bottom, clamps to viewport bounds as a last resort.
 */
export const clampTooltipTop = (
  pointerClientY: number,
  tooltipHeight: number,
  viewportHeight: number,
  preferredOffset: number,
): number => {
  const preferredTop =
    pointerClientY + preferredOffset + tooltipHeight > viewportHeight
      ? pointerClientY - preferredOffset - tooltipHeight
      : pointerClientY + preferredOffset;
  const upperBound = Math.max(0, viewportHeight - tooltipHeight);
  return Math.max(0, Math.min(preferredTop, upperBound));
};
