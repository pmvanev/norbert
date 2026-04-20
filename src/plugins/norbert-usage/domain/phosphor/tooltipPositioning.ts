/**
 * Tooltip positioning math — pure helpers shared by the phosphor view's
 * pointer handlers. Currently hosts `normalizeClientPointer`, the CSS-zoom
 * compensation used when forwarding `event.clientX/Y` to a portal tooltip
 * positioned via `position: fixed`.
 *
 * Why this exists:
 *   `document.documentElement.style.zoom` (set by Ctrl-+/- in main.tsx)
 *   inflates `getBoundingClientRect()` by the zoom factor relative to the
 *   canvas's unzoomed logical size (what `ResizeObserver.contentRect`
 *   returns). `event.clientX/Y` arrive in that zoomed coordinate space,
 *   but `position: fixed` resolves against unzoomed CSS layout pixels.
 *   The ratio of zoomed rect dimensions to unzoomed logical dimensions
 *   IS the CSS zoom factor; dividing client coords by that ratio returns
 *   them to the coordinate space the portal tooltip expects.
 *
 * Mirrors the v1 PM fix landed in commit cf7af6c (see PMChart.tsx in the
 * pre-deletion history). Extracted here rather than inlined so the math
 * is property-testable in isolation.
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
