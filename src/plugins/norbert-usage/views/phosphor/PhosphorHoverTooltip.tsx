/**
 * PhosphorHoverTooltip — prop-in minimal tooltip that tracks the cursor.
 *
 * Given a `HoverSelection` (or null), renders either:
 *   - nothing (selection is null), or
 *   - a positioned div showing "session · value unit · age".
 *
 * Positioning contract (mirrors v1 PM's cf7af6c + 6d5d2f1^ patterns):
 *   - Rendered via `ReactDOM.createPortal(document.body)` so the tooltip
 *     escapes the canvas-wrap's `overflow: hidden` clipping context and
 *     `position: fixed` resolves against the viewport (unaffected by any
 *     transformed/filtered ancestor).
 *   - When `selection.pointerClientX/Y` are present (the view sets them on
 *     every mousemove), positions at the cursor with a small offset so the
 *     tooltip never sits under the pointer tip. Falls back to the trace
 *     sample's canvas-local `displayX/displayY` when client coords are
 *     absent (older callers, tests that do not simulate a mouse event).
 *   - Edge-flips at viewport bounds via the pure `clampTooltipLeft` /
 *     `clampTooltipTop` helpers: below-right when it fits, flipped to the
 *     opposite side when below-right would overflow, hard-clamped to the
 *     viewport as a last-resort safety net.
 *   - Tooltip width/height are MEASURED via `useLayoutEffect + ref` on the
 *     first render, then fed into the pure clamp helpers. This mirrors v1's
 *     PMTooltip pattern (chartViewHelpers.ts @ 6d5d2f1^): a fixed
 *     conservative estimate (the previous 220×30) failed for long session
 *     labels like "norbert-performance-monitor" that push real tooltip
 *     widths well past 300px — the right-edge flip never triggered and the
 *     tooltip clipped off-screen. Accept the one-frame measurement delay.
 *
 * The measure-then-clamp pipeline means the first frame after a selection
 * change uses the previous measurement (or the fallback estimate on the
 * very first render); the useLayoutEffect then synchronously updates the
 * measured width and triggers a re-render before the browser paints. The
 * brief one-frame lag is far less visible than a clipped tooltip.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { HoverSelection } from "../../domain/phosphor/scopeHitTest";
import {
  clampTooltipLeft,
  clampTooltipTop,
} from "../../domain/phosphor/tooltipPositioning";
import {
  HOVER_BEAT_FREQ_HZ,
  computeHoverBeatAlpha,
  computeHoverBeatRadius,
} from "../../domain/phosphor/hoverBeat";

interface PhosphorHoverTooltipProps {
  readonly selection: HoverSelection | null;
  readonly unit: string;
}

// Offset from the cursor so the tooltip never sits beneath the pointer tip.
const TOOLTIP_OFFSET_PX = 12;
// Tooltip pulse parameters — phase-locked to the canvas-drawn hover-beat dot
// via the shared `HOVER_BEAT_FREQ_HZ`. Both sites compute `sin(2π · freq · t)`
// using `Date.now()`, so identical inputs yield identical phase.
//
// Opacity: 0.85 ± 0.15 → [0.70, 1.00]. Text stays readable at the trough
// while still delivering a perceptible "breath" at the peak.
// Glow:    0–12 px halo radius (half-rectified envelope, never negative)
//          painted in the hovered trace's color for the "flash" effect
//          synchronized with the dot's brightest frame.
const TOOLTIP_PULSE_ALPHA_BASE = 0.85;
const TOOLTIP_PULSE_ALPHA_AMPLITUDE = 0.15;
const TOOLTIP_PULSE_GLOW_BASE_PX = 0;
const TOOLTIP_PULSE_GLOW_AMPLITUDE_PX = 12;
// Fallback estimates used on the very first render before useLayoutEffect
// measures the tooltip's actual rendered size. Kept wider than the old
// hardcoded 220×30 so even the pre-measurement placement is unlikely to
// overflow; the real measurement replaces these within one frame.
const TOOLTIP_EST_WIDTH_PX = 320;
const TOOLTIP_EST_HEIGHT_PX = 36;

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
 * Read `document.documentElement.style.zoom` as a strictly positive number,
 * falling back to 1 when absent, unparseable, or non-positive. Mirrors v1
 * PMTooltip's docZoom reader: Ctrl-+/- in main.tsx sets the inline zoom
 * style, which inflates `window.innerWidth` / `window.innerHeight` relative
 * to the normalized coordinate space that `normalizeClientPointer` produces
 * for the pointer.
 */
const readDocZoom = (): number => {
  if (typeof document === "undefined") return 1;
  const raw = parseFloat(document.documentElement.style.zoom || "1");
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
};

/**
 * Viewport dimensions in the SAME coordinate space as the normalized
 * `pointerClientX/Y` arriving from upstream `normalizeClientPointer`.
 *
 * `window.innerWidth/Height` stay in physical-viewport CSS pixels and are
 * unaffected by `document.documentElement.style.zoom`, whereas the pointer
 * coords were already divided by the CSS-zoom factor upstream. To feed both
 * into the pure clamp helpers (which assume a single consistent coord
 * space), divide the viewport dims by the same docZoom. Mirrors v1 PM's
 * `effectiveContainerWidth = containerWidth / docZoom` in
 * chartViewHelpers.ts @ 6d5d2f1^.
 *
 * Defensive: falls back to null during SSR / jsdom envs that do not
 * populate `window`. When window is absent we skip edge-flipping entirely
 * — the tooltip uses the offset-from-cursor position and any overflow is
 * accepted silently.
 */
const viewportSize = (): { width: number; height: number } | null => {
  if (typeof window === "undefined") return null;
  const docZoom = readDocZoom();
  return {
    width: window.innerWidth / docZoom,
    height: window.innerHeight / docZoom,
  };
};

/**
 * Compute the tooltip's viewport left/top given the cursor anchor, the
 * tooltip's measured (or fallback-estimated) dimensions, and the viewport.
 * Delegates flipping + clamping to the pure `clampTooltipLeft` /
 * `clampTooltipTop` helpers in `domain/phosphor/tooltipPositioning`.
 */
const computePosition = (
  anchorX: number,
  anchorY: number,
  tooltipWidth: number,
  tooltipHeight: number,
): { left: number; top: number } => {
  const viewport = viewportSize();
  // Without a viewport (SSR / jsdom edge case), fall back to raw offset —
  // any overflow is accepted silently since we cannot measure bounds.
  if (viewport === null) {
    return {
      left: anchorX + TOOLTIP_OFFSET_PX,
      top: anchorY + TOOLTIP_OFFSET_PX,
    };
  }
  return {
    left: clampTooltipLeft(anchorX, tooltipWidth, viewport.width, TOOLTIP_OFFSET_PX),
    top: clampTooltipTop(anchorY, tooltipHeight, viewport.height, TOOLTIP_OFFSET_PX),
  };
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
  // Measured dimensions — populated by useLayoutEffect after each render.
  // null before the first measurement lands, in which case the clamp uses
  // the conservative fallback estimates.
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // rAF-driven pulse: opacity + colored box-shadow glow modulated at
  // `HOVER_BEAT_FREQ_HZ`, phase-locked to the canvas dot because both use
  // the same `Date.now()` + frequency + math. Writes directly to the DOM
  // style to avoid re-rendering React at 60fps. The loop only runs while a
  // selection is active (the effect's dependency on `selection === null`
  // starts/stops it, and the ref bails out cleanly if the element has been
  // unmounted between frames).
  useEffect(() => {
    if (selection === null || typeof window === "undefined") return;
    let rafId: number | null = null;
    const tick = () => {
      const node = tooltipRef.current;
      if (node !== null) {
        const nowMs = Date.now();
        const alpha = computeHoverBeatAlpha(
          nowMs,
          HOVER_BEAT_FREQ_HZ,
          TOOLTIP_PULSE_ALPHA_BASE,
          TOOLTIP_PULSE_ALPHA_AMPLITUDE,
        );
        // Half-rectified envelope for the glow radius so it never goes
        // negative — `computeHoverBeatRadius` with base 0 gives a [0, amp]
        // bounce that peaks on the same frame as the dot's brightest alpha.
        const glowPx = computeHoverBeatRadius(
          nowMs,
          HOVER_BEAT_FREQ_HZ,
          TOOLTIP_PULSE_GLOW_BASE_PX,
          TOOLTIP_PULSE_GLOW_AMPLITUDE_PX,
        );
        node.style.opacity = `${alpha}`;
        // Two-layer shadow: the pre-existing drop shadow for depth, plus a
        // colored halo that pulses in the hovered trace's color so the
        // tooltip "flashes" to match the dot's color identity.
        node.style.boxShadow = `0 2px 10px rgba(0, 0, 0, 0.45), 0 0 ${glowPx}px ${selection.color}`;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [selection === null, selection?.color]);

  useLayoutEffect(() => {
    if (tooltipRef.current === null) {
      // Tooltip was just unmounted (selection === null) — forget the
      // previous measurement so the NEXT selection re-measures rather than
      // reusing a stale width from a different trace's label.
      if (measured !== null) setMeasured(null);
      return;
    }
    const width = tooltipRef.current.offsetWidth;
    const height = tooltipRef.current.offsetHeight;
    // Zero-dimension measurements (jsdom without CSS, layout race, etc.) are
    // treated as "not yet measured" so the fallback estimate continues to
    // drive edge-flip decisions rather than producing a degenerate 0×0 box
    // that never triggers flipping.
    if (width === 0 || height === 0) return;
    if (
      measured === null ||
      measured.width !== width ||
      measured.height !== height
    ) {
      setMeasured({ width, height });
    }
    // Re-measure whenever the rendered content changes. Including `measured`
    // in deps would cause an infinite loop — the hook compares measurements
    // to the previous value and only calls setMeasured on change, which
    // breaks the loop. eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selection?.displayLabel,
    selection?.value,
    selection?.ageMs,
    selection === null,
  ]);

  if (selection === null) return null;

  const anchor = resolveAnchor(selection);
  const tooltipWidth = measured?.width ?? TOOLTIP_EST_WIDTH_PX;
  const tooltipHeight = measured?.height ?? TOOLTIP_EST_HEIGHT_PX;
  const { left, top } = anchor.fixed
    ? computePosition(anchor.x, anchor.y, tooltipWidth, tooltipHeight)
    : { left: anchor.x, top: anchor.y };

  const tooltip = (
    <div
      ref={tooltipRef}
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
