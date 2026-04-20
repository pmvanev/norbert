/**
 * PhosphorHoverTooltip — prop-in minimal tooltip that tracks the cursor.
 *
 * Given a `HoverSelection` (or null), renders either:
 *   - nothing (selection is null), or
 *   - a positioned div showing "session · value unit · age".
 *
 * Positioning contract (mirrors v1 PM's cf7af6c pattern):
 *   - Rendered via `ReactDOM.createPortal(document.body)` so the tooltip
 *     escapes the canvas-wrap's `overflow: hidden` clipping context and
 *     `position: fixed` resolves against the viewport (unaffected by any
 *     transformed/filtered ancestor).
 *   - When `selection.pointerClientX/Y` are present (the view sets them on
 *     every mousemove), positions at the cursor with a small offset so the
 *     tooltip never sits under the pointer tip. Falls back to the trace
 *     sample's canvas-local `displayX/displayY` when client coords are
 *     absent (older callers, tests that do not simulate a mouse event).
 *   - Edge-flips at viewport bounds (mirrors v1 dbd6592): when the tooltip
 *     would overflow the right edge it shifts to the left of the cursor;
 *     when it would overflow the bottom it shifts above. Uses conservative
 *     hardcoded bounds — measuring via useLayoutEffect would force a second
 *     render per hover.
 *
 * Pure rendering function — no effects, no state. The portal is the only
 * DOM-aware call and is guarded for SSR.
 */

import { createPortal } from "react-dom";
import type { HoverSelection } from "../../domain/phosphor/scopeHitTest";

interface PhosphorHoverTooltipProps {
  readonly selection: HoverSelection | null;
  readonly unit: string;
}

// Offset from the cursor so the tooltip never sits beneath the pointer tip.
const TOOLTIP_OFFSET_PX = 12;
// Conservative bounds used for viewport edge-flip decisions. The tooltip's
// actual size is small (one line of text, ~200x30). Measuring would force
// a second render per hover; these are generous enough to avoid clipping
// and tight enough that the tooltip rarely overlaps the cursor after a flip.
const TOOLTIP_EST_WIDTH_PX = 220;
const TOOLTIP_EST_HEIGHT_PX = 30;

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

/**
 * Viewport dimensions (defensive: fall back to reasonable values during
 * SSR / jsdom envs that do not populate window). When window is absent we
 * skip edge-flipping entirely — the tooltip uses the offset-from-cursor
 * position and any overflow is accepted silently.
 */
const viewportSize = (): { width: number; height: number } | null => {
  if (typeof window === "undefined") return null;
  return { width: window.innerWidth, height: window.innerHeight };
};

/**
 * Compute the tooltip's viewport left/top given an anchor point (the
 * cursor), flipping to the opposite side when the preferred below-right
 * placement would overflow the viewport.
 */
const computePosition = (
  anchorX: number,
  anchorY: number,
): { left: number; top: number } => {
  const viewport = viewportSize();
  // Preferred placement: below-right of the anchor by TOOLTIP_OFFSET_PX.
  let left = anchorX + TOOLTIP_OFFSET_PX;
  let top = anchorY + TOOLTIP_OFFSET_PX;
  if (viewport === null) return { left, top };
  // Right-edge flip: place to the left of the cursor instead.
  if (left + TOOLTIP_EST_WIDTH_PX > viewport.width) {
    left = anchorX - TOOLTIP_OFFSET_PX - TOOLTIP_EST_WIDTH_PX;
  }
  // Bottom-edge flip: place above the cursor instead.
  if (top + TOOLTIP_EST_HEIGHT_PX > viewport.height) {
    top = anchorY - TOOLTIP_OFFSET_PX - TOOLTIP_EST_HEIGHT_PX;
  }
  return { left, top };
};

/**
 * Resolve the anchor point for positioning. Prefers the cursor's viewport
 * coordinates (`pointerClientX/Y`) so the tooltip tracks the mouse. Falls
 * back to the trace sample's canvas-local coords when cursor coords are
 * absent — callers without a pointer event (older integration paths,
 * tests) still see a positioned tooltip at the sample point.
 */
const resolveAnchor = (
  selection: HoverSelection,
): { x: number; y: number; fixed: boolean } => {
  if (
    typeof selection.pointerClientX === "number" &&
    typeof selection.pointerClientY === "number"
  ) {
    return {
      x: selection.pointerClientX,
      y: selection.pointerClientY,
      fixed: true,
    };
  }
  return { x: selection.displayX, y: selection.displayY, fixed: false };
};

export const PhosphorHoverTooltip = ({
  selection,
  unit,
}: PhosphorHoverTooltipProps) => {
  if (selection === null) return null;

  const anchor = resolveAnchor(selection);
  const { left, top } = anchor.fixed
    ? computePosition(anchor.x, anchor.y)
    : { left: anchor.x, top: anchor.y };

  const tooltip = (
    <div
      className="phosphor-hover-tooltip"
      data-testid="phosphor-hover-tooltip"
      style={{
        // Cursor-tracked tooltips render via a document.body portal with
        // position: fixed. Fallback (no pointer coords) keeps the legacy
        // absolute-in-canvas-wrap behavior so existing tests / paths do
        // not regress.
        position: anchor.fixed ? "fixed" : "absolute",
        left: `${left}px`,
        top: `${top}px`,
        pointerEvents: "none",
        borderLeft: `2px solid ${selection.color}`,
      }}
    >
      <span className="phosphor-hover-session" title={selection.sessionId}>
        {selection.displayLabel}
      </span>
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

  // Portal to document.body so position: fixed is viewport-relative and
  // the canvas-wrap's `overflow: hidden` never clips the tooltip. SSR
  // environments without `document` fall back to inline rendering — the
  // portal path is the production path.
  if (anchor.fixed && typeof document !== "undefined") {
    return createPortal(tooltip, document.body);
  }
  return tooltip;
};
