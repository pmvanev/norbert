/**
 * PhosphorCanvasHost — the sole effect component for the phosphor scope.
 *
 * Responsibilities:
 *   - Owns a primary `<canvas>` (ref) and an offscreen persistence buffer
 *     (ref, managed by `ensurePersistenceBuffer`).
 *   - Tracks its container's size via `ResizeObserver` and the device pixel
 *     ratio via `window.devicePixelRatio`, mirroring the pattern proven in
 *     `OscilloscopeView.tsx`.
 *   - Runs a `requestAnimationFrame` loop that computes a FRESH Frame on
 *     every tick via `buildFrame(store, selectedMetric, now())` and renders
 *     it. The loop pauses when `document.visibilityState === 'hidden'`
 *     (the scope is a peripheral-glance view; no need to waste GPU when
 *     the window is hidden).
 *   - Handles pointer events: `mousemove` calls the pure `scopeHitTest` and
 *     fires `onHoverChange` with the result; `mouseleave` fires `onHoverChange(null)`.
 *   - Live-tracks the hovered sample across rAF ticks: the last pointer
 *     position is stored in a ref; each tick re-runs `scopeHitTest`
 *     against the fresh frame so the selection tracks the scrolling
 *     trace. A pulsing "heartbeat" dot is drawn on top of the composited
 *     persistence buffer at that sample's canvas coordinates (radius and
 *     alpha via the pure `hoverBeat` helpers). `onHoverChange` is
 *     de-churned by content fingerprint so the parent only re-renders on
 *     meaningful transitions (sample change or age-bucket tick).
 *
 * Why rAF-driven frame computation?
 *   Trace projection depends on `now` (the 60-second window slides against
 *   real time). If the frame is computed on React render only, the canvas
 *   redraws the SAME frozen-`now` frame between store notifications, so
 *   traces stop scrolling — then jump when notifications fire. Running
 *   `buildFrame` per rAF tick ties the window's right edge to real time,
 *   producing smooth 60fps scroll regardless of notification cadence.
 *   Data ingest (pulses, rate samples) remains event-driven in the store;
 *   the renderer picks up fresh store state on every frame.
 *
 * Canvas drawing follows the pure/effect split: `buildFrame` (pure) produces
 * the Frame; all drawing routines here are effect-only and read the Frame.
 * The drawing itself is intentionally minimal (trace polyline + pulse flares
 * + afterglow overlay) — visual polish can be layered on later without
 * changing the prop contract.
 *
 * Test observability: the container div exposes `data-metric`, `data-y-max`,
 * `data-unit`, `data-trace-count`, and `data-pulse-count` attributes so the
 * component is assertable from React Testing Library without reading the
 * canvas's pixel buffer. Those attributes are computed on each React render
 * via `buildFrame(store, selectedMetric, now())` so they refresh whenever
 * the parent (which subscribes to the store) re-renders — preserving the
 * existing observability contract.
 *
 * Pure-core boundary: this file is the ONE place inside the phosphor view
 * subtree that touches `requestAnimationFrame`, `document`, `ResizeObserver`,
 * and the `CanvasRenderingContext2D`. Projection math lives in
 * `domain/phosphor/canvasGeometry.ts`; Frame construction in
 * `domain/phosphor/scopeProjection.ts`; hit-testing in
 * `domain/phosphor/scopeHitTest.ts`.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { MultiSessionStore } from "../../adapters/multiSessionStore";
import type { MetricId } from "../../domain/phosphor/phosphorMetricConfig";
import { buildFrame, type Frame, type FramePulse, type FrameTrace } from "../../domain/phosphor/scopeProjection";
import { scopeHitTest, type HoverSelection } from "../../domain/phosphor/scopeHitTest";
import { timeToX, valueToY } from "../../domain/phosphor/canvasGeometry";
import { stepPolyline } from "../../domain/phosphor/stepPolyline";
import {
  computeHoverBeatAlpha,
  computeHoverBeatRadius,
} from "../../domain/phosphor/hoverBeat";
import { normalizeClientPointer } from "../../domain/phosphor/tooltipPositioning";
import {
  ensurePersistenceBuffer,
  type PersistenceBufferCell,
} from "./ensurePersistenceBuffer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 200;
const TRACE_LINE_WIDTH = 2;
const PULSE_BASE_RADIUS = 10;
/**
 * Shared empty set used when no `hiddenSessions` prop is supplied. A module-
 * level constant avoids allocating a throwaway Set on every render / every
 * rAF tick (the tick runs ~60 times per second).
 */
const EMPTY_HIDDEN_SESSIONS: ReadonlySet<string> = new Set<string>();
// Hover-beat (breathing dot at the hovered sample).
//
// Frequency note: Phil's sketch mentioned "60 Hz". At our 60fps render
// cadence a 60 Hz sinusoid aliases to a static dot — each frame samples the
// same phase. 2 Hz (120 bpm) sits well below Nyquist, gives a clearly
// visible pulse, and feels like a heartbeat. Swap this constant if a
// different tempo is wanted.
const HOVER_BEAT_FREQ_HZ = 2;
const HOVER_BEAT_BASE_RADIUS_PX = 4;
const HOVER_BEAT_AMPLITUDE_PX = 3;
// Alpha modulation: 0.7 ± 0.3 → [0.4, 1.0]. Keeps the dot always visible
// while giving a subtle brightness pulse synchronized with the radius.
const HOVER_BEAT_ALPHA_BASE = 0.7;
const HOVER_BEAT_ALPHA_AMPLITUDE = 0.3;
// Age-display bucket (ms) used to de-churn `onHoverChange` while the cursor
// is stationary. `formatAge` in the tooltip ticks at tenth-of-a-second
// granularity, so emitting at 100ms boundaries suffices for a live age
// readout without flooding React with per-frame selection objects.
const HOVER_EMIT_AGE_BUCKET_MS = 100;
// Alpha applied to the persistence buffer each frame to produce afterglow
// decay. 0.92 matches the prototype's phosphor falloff: recent traces linger
// ~0.5s, older traces fade into background.
const PERSISTENCE_DECAY_ALPHA = 0.08;

// Grid reference — subtle horizontal lines at quarter-scale intervals give
// the eye an anchor for relative magnitude without stealing attention from
// the trace. Vertical tickmarks at 15-second intervals mark the 60-second
// window's four quarters (the newest edge sits at x = width).
//
// Y-axis: labeled ticks at 25%, 50%, 75%, and 100% of yMax so the user can
// read values off the trace. The top tick carries the metric unit; interior
// ticks are bare numbers to stay uncluttered.
// X-axis: labeled ticks at 15s-age intervals from the right edge — "-15s",
// "-30s", "-45s", "-60s" — so the user can read a sample's age directly.
const GRID_Y_FRACTIONS: ReadonlyArray<number> = [0.25, 0.5, 0.75, 1.0];
const GRID_TIME_INTERVAL_MS = 15_000;
const GRID_WINDOW_MS = 60_000;
const GRID_TICK_LENGTH_PX = 5;
const GRID_DASH_PATTERN: ReadonlyArray<number> = [2, 6];
const AXIS_LABEL_FONT = "10px monospace";
const AXIS_LABEL_PAD_PX = 4;
// Fallback colors — theme tokens are preferred, these are used only when
// getComputedStyle cannot resolve the CSS custom properties (tests / SSR).
const GRID_COLOR_PROP = "--phosphor-grid";
const GRID_COLOR_FALLBACK = "rgba(255, 255, 255, 0.06)";
const AXIS_LABEL_COLOR_PROP = "--phosphor-axis-label";
const AXIS_LABEL_COLOR_FALLBACK = "rgba(200, 200, 200, 0.75)";

/** Resolve a CSS custom property from a container, with a safe fallback. */
const resolveThemeColor = (
  container: HTMLElement | null,
  prop: string,
  fallback: string,
): string => {
  if (container === null || typeof window === "undefined") return fallback;
  const value = window.getComputedStyle(container).getPropertyValue(prop).trim();
  return value === "" ? fallback : value;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhosphorCanvasHostProps {
  readonly store: MultiSessionStore;
  readonly selectedMetric: MetricId;
  readonly onHoverChange: (selection: HoverSelection | null) => void;
  /**
   * Time source for `buildFrame`. Defaults to `Date.now` so sample timestamps
   * (written by hookProcessor via `Date.now`) and the frame's `now` share a
   * clock. Tests may inject a deterministic stub.
   */
  readonly nowFn?: () => number;
  /**
   * Sessions the user has hidden via the legend. Passed through to
   * `buildFrame` on every rAF tick so hidden traces and their pulses never
   * reach the canvas. Undefined is treated as an empty set (nothing hidden)
   * — this preserves the historical behavior of callers that predate the
   * feature. Kept as a ReadonlySet so the canvas host cannot mutate it.
   */
  readonly hiddenSessions?: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------
// Canvas drawing (effects-only). Projection math (timeToX / valueToY) is
// imported from `domain/phosphor/canvasGeometry` so hover hit-test and
// render stay structurally coherent — any change to the projection is
// observed by both consumers in lockstep.
// ---------------------------------------------------------------------------

/**
 * Format a Y-axis tick value for display. Integer-friendly values render
 * without a decimal ("15", "10"); fractional values render with up to one
 * decimal ("3.75", "7.5") and strip a trailing `.0` so "10.0" becomes "10".
 * Keeps the label compact regardless of yMax magnitude (dynamic or fixed).
 */
const formatTickValue = (value: number): string => {
  if (Number.isInteger(value)) return `${value}`;
  return value.toFixed(2).replace(/\.?0+$/, "");
};

/**
 * Draw the reference grid and labeled tick marks.
 *
 * Y-axis (left edge, inside the canvas):
 *   - Short horizontal tick marks at 25%, 50%, 75%, and 100% of yMax.
 *   - Numeric value labels just to the right of each tick (top tick shows
 *     unit after the value so the scale's unit is discoverable without a
 *     separate legend).
 *   - Faint dashed horizontal gridlines extend each tick across the canvas
 *     so the eye can trace a trace's magnitude to its Y-axis value.
 *
 * X-axis (bottom edge, inside the canvas):
 *   - Short vertical tick marks at -15s, -30s, -45s, -60s ages from the
 *     right edge.
 *   - Time-ago labels ("-15s" etc.) just above each tick.
 *   - Faint dashed vertical gridlines rising from each tick so a hovered
 *     sample's age is easy to read.
 *
 * Painted into the persistence buffer BEFORE traces/pulses so the signal
 * always reads on top. Because the grid is very faint (~0.06 alpha) the
 * afterglow decay's effect on the grid is imperceptible.
 */
const drawGrid = (
  bufferCtx: CanvasRenderingContext2D,
  frame: Frame,
  width: number,
  height: number,
  gridColor: string,
  axisLabelColor: string,
): void => {
  bufferCtx.save();

  // ---- Gridlines (dashed, faint) ----
  bufferCtx.strokeStyle = gridColor;
  bufferCtx.lineWidth = 1;
  bufferCtx.setLineDash([...GRID_DASH_PATTERN]);

  // Horizontal gridlines at each Y-tick fraction (including 1.0 at the top).
  for (const fraction of GRID_Y_FRACTIONS) {
    const y = height - height * fraction;
    bufferCtx.beginPath();
    bufferCtx.moveTo(0, y);
    bufferCtx.lineTo(width, y);
    bufferCtx.stroke();
  }

  // Vertical gridlines at each 15s X-tick (skip 60s mark — it would paint
  // a line exactly at x=0 which adds visual noise without adding
  // information beyond the canvas edge itself).
  for (
    let ageMs = GRID_TIME_INTERVAL_MS;
    ageMs < GRID_WINDOW_MS;
    ageMs += GRID_TIME_INTERVAL_MS
  ) {
    const x = width * (1 - ageMs / GRID_WINDOW_MS);
    bufferCtx.beginPath();
    bufferCtx.moveTo(x, 0);
    bufferCtx.lineTo(x, height);
    bufferCtx.stroke();
  }

  // ---- Tick marks (solid, from the axis inward) ----
  bufferCtx.setLineDash([]);

  // Y-axis tick marks along the left edge.
  for (const fraction of GRID_Y_FRACTIONS) {
    const y = height - height * fraction;
    bufferCtx.beginPath();
    bufferCtx.moveTo(0, y);
    bufferCtx.lineTo(GRID_TICK_LENGTH_PX, y);
    bufferCtx.stroke();
  }

  // X-axis tick marks along the bottom edge.
  for (
    let ageMs = GRID_TIME_INTERVAL_MS;
    ageMs <= GRID_WINDOW_MS;
    ageMs += GRID_TIME_INTERVAL_MS
  ) {
    const x = width * (1 - ageMs / GRID_WINDOW_MS);
    bufferCtx.beginPath();
    bufferCtx.moveTo(x, height);
    bufferCtx.lineTo(x, height - GRID_TICK_LENGTH_PX);
    bufferCtx.stroke();
  }

  // ---- Axis labels ----
  bufferCtx.fillStyle = axisLabelColor;
  bufferCtx.font = AXIS_LABEL_FONT;

  // Y-axis value labels, positioned just inside each tick.
  bufferCtx.textAlign = "left";
  for (const fraction of GRID_Y_FRACTIONS) {
    const value = frame.yMax * fraction;
    const y = height - height * fraction;
    const label =
      fraction === 1.0
        ? `${formatTickValue(value)} ${frame.unit}`
        : formatTickValue(value);
    // Top tick label sits below its line; other labels are vertically
    // centered on their tick.
    bufferCtx.textBaseline = fraction === 1.0 ? "top" : "middle";
    bufferCtx.fillText(
      label,
      GRID_TICK_LENGTH_PX + AXIS_LABEL_PAD_PX,
      y + (fraction === 1.0 ? AXIS_LABEL_PAD_PX : 0),
    );
  }

  // X-axis time-ago labels, positioned just above each tick.
  bufferCtx.textBaseline = "bottom";
  bufferCtx.textAlign = "center";
  for (
    let ageMs = GRID_TIME_INTERVAL_MS;
    ageMs <= GRID_WINDOW_MS;
    ageMs += GRID_TIME_INTERVAL_MS
  ) {
    const x = width * (1 - ageMs / GRID_WINDOW_MS);
    const ageSeconds = ageMs / 1000;
    const label = `-${ageSeconds}s`;
    // The -60s label would clip off the left edge when centered on x=0;
    // left-align it in that case so it stays fully visible.
    if (ageMs === GRID_WINDOW_MS) {
      bufferCtx.textAlign = "left";
      bufferCtx.fillText(
        label,
        x + AXIS_LABEL_PAD_PX,
        height - GRID_TICK_LENGTH_PX - AXIS_LABEL_PAD_PX,
      );
      bufferCtx.textAlign = "center";
    } else {
      bufferCtx.fillText(
        label,
        x,
        height - GRID_TICK_LENGTH_PX - AXIS_LABEL_PAD_PX,
      );
    }
  }

  bufferCtx.restore();
};

/**
 * Draw a trace as a square-wave (sample-and-hold) step function.
 *
 * Each sample holds its value from its own timestamp until the next sample's
 * timestamp, then the trace steps vertically to the new value. After the
 * last sample, the trace holds its last value out to the right edge of the
 * canvas so the current value is visible at the scope's leading edge —
 * matching `scopeHitTest`'s at-or-before sample-lookup semantics and
 * conventional oscilloscope rendering.
 *
 * Geometry / shape construction is delegated to the pure `stepPolyline`
 * helper. This function is effect-only: walk the point array with a
 * `moveTo` for the first point and `lineTo` for each subsequent point,
 * then stroke.
 */
const drawTrace = (
  ctx: CanvasRenderingContext2D,
  trace: FrameTrace,
  frame: Frame,
  width: number,
  height: number,
): void => {
  const points = stepPolyline(
    trace.samples,
    width,
    frame.now,
    frame.yMax,
    height,
  );
  if (points.length === 0) return;
  ctx.strokeStyle = trace.color;
  ctx.lineWidth = TRACE_LINE_WIDTH;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
};

const drawPulse = (
  ctx: CanvasRenderingContext2D,
  pulse: FramePulse,
  frame: Frame,
  width: number,
  height: number,
): void => {
  const x = timeToX(pulse.t, width, frame.now);
  const y = valueToY(pulse.v, height, frame.yMax);
  const radius = PULSE_BASE_RADIUS * pulse.strength * (0.5 + 0.5 * pulse.decay);
  ctx.fillStyle = pulse.color;
  ctx.globalAlpha = pulse.decay;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
};

/**
 * Draw the beating-heart hover dot at the trace's sample under the cursor.
 *
 * Draws onto the PRIMARY canvas (not the persistence buffer) so no afterglow
 * smear trails the dot as it tracks the scrolling trace — the dot must
 * appear pinned to the sample, not a ghost of where the sample was.
 *
 * Position is recomputed from the frame's `now` and the selection's
 * `time` (sample timestamp) rather than reusing `selection.displayX/Y`
 * captured at last mousemove — those coords would go stale within a frame
 * as the trace scrolls left.
 */
const drawHoverBeat = (
  ctx: CanvasRenderingContext2D,
  selection: HoverSelection,
  frame: Frame,
  width: number,
  height: number,
  nowMs: number,
): void => {
  const x = timeToX(selection.time, width, frame.now);
  const y = valueToY(selection.value, height, frame.yMax);
  const radius = computeHoverBeatRadius(
    nowMs,
    HOVER_BEAT_FREQ_HZ,
    HOVER_BEAT_BASE_RADIUS_PX,
    HOVER_BEAT_AMPLITUDE_PX,
  );
  const alpha = computeHoverBeatAlpha(
    nowMs,
    HOVER_BEAT_FREQ_HZ,
    HOVER_BEAT_ALPHA_BASE,
    HOVER_BEAT_ALPHA_AMPLITUDE,
  );
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = selection.color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  bufferCtx: CanvasRenderingContext2D,
  frame: Frame,
  width: number,
  height: number,
  gridColor: string,
  axisLabelColor: string,
): void => {
  // Decay the persistence buffer by erasing a small alpha each frame. This
  // produces the phosphor afterglow: recent strokes remain visible briefly,
  // older strokes fade. The buffer is the source of the visible trail.
  bufferCtx.save();
  bufferCtx.globalCompositeOperation = "destination-out";
  bufferCtx.fillStyle = `rgba(0, 0, 0, ${PERSISTENCE_DECAY_ALPHA})`;
  bufferCtx.fillRect(0, 0, width, height);
  bufferCtx.restore();

  // Draw the reference grid BEFORE signal so traces and pulses always paint
  // on top. The grid is very faint so afterglow accumulation is imperceptible.
  drawGrid(bufferCtx, frame, width, height, gridColor, axisLabelColor);

  // Draw this frame's traces + pulses INTO the persistence buffer (not the
  // primary canvas). Traces accumulate; older points are erased by the decay
  // pass above.
  for (const trace of frame.traces) {
    drawTrace(bufferCtx, trace, frame, width, height);
  }
  for (const pulse of frame.pulses) {
    drawPulse(bufferCtx, pulse, frame, width, height);
  }

  // Composite the buffer onto the primary canvas. The primary canvas is
  // cleared each frame; the buffer holds the afterglow.
  ctx.clearRect(0, 0, width, height);
  // Draw offscreen → onscreen. The buffer is the same pixel size as the
  // primary canvas, so a 1:1 blit at (0, 0) is correct.
  if (typeof ctx.drawImage === "function") {
    // drawImage accepts HTMLCanvasElement as source. Using `unknown` cast
    // because the OffscreenCanvas vs HTMLCanvasElement union is declared as
    // unknown at this layer; the runtime type is always the element the
    // factory produced.
    ctx.drawImage(bufferCtx.canvas as unknown as CanvasImageSource, 0, 0);
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PhosphorCanvasHost = ({
  store,
  selectedMetric,
  onHoverChange,
  nowFn = Date.now,
  hiddenSessions,
}: PhosphorCanvasHostProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferCellRef = useRef<PersistenceBufferCell<HTMLCanvasElement>>({
    key: null,
    buffer: null,
  });
  const rafIdRef = useRef<number | null>(null);
  // Stable refs so the rAF loop reads fresh dependencies without being
  // re-created on every render. Without these, the `useEffect` that owns
  // the loop would tear down and restart on every parent re-render.
  const storeRef = useRef<MultiSessionStore>(store);
  const selectedMetricRef = useRef<MetricId>(selectedMetric);
  const nowFnRef = useRef<() => number>(nowFn);
  const onHoverChangeRef = useRef<(s: HoverSelection | null) => void>(onHoverChange);
  // Mirror `hiddenSessions` into a ref so the rAF loop can read the current
  // value without being torn down and restarted on every toggle. Undefined
  // is normalized to an empty set here so the render path never needs the
  // `?? EMPTY` dance.
  const hiddenSessionsRef = useRef<ReadonlySet<string>>(hiddenSessions ?? EMPTY_HIDDEN_SESSIONS);
  storeRef.current = store;
  selectedMetricRef.current = selectedMetric;
  nowFnRef.current = nowFn;
  onHoverChangeRef.current = onHoverChange;
  hiddenSessionsRef.current = hiddenSessions ?? EMPTY_HIDDEN_SESSIONS;

  // Live-tracking hover state owned by the canvas host:
  //
  //   - `lastPointerRef` holds the pointer coords in CSS pixels (canvas-local)
  //     plus the cursor's viewport coords for tooltip positioning. Set by
  //     `mousemove`, cleared by `mouseleave`.
  //   - `lastEmittedHoverKeyRef` stores a content fingerprint of the most
  //     recently-emitted `onHoverChange` payload so the rAF tick only
  //     notifies the parent when a meaningful transition happens
  //     (sample changed OR displayed age bucket advanced). Reference-only
  //     equality would not suffice because the hit-test produces a fresh
  //     selection object every tick.
  const lastPointerRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const lastEmittedHoverKeyRef = useRef<string | null>(null);

  // Render-time frame: powers the DOM data attributes (test observability)
  // AND seeds `frameRef.current` so the very first hover hit-test (before
  // any rAF tick has landed) has a valid frame to query. Cheap — `buildFrame`
  // is pure and O(sessions × samples); the parent subscribes to the store
  // so this recomputes exactly when the store notifies.
  //
  // `yMaxMode: "dynamic"` lets quiet signals fill more of the canvas while
  // still clamping to the per-metric cap. When no samples are present the
  // resolved yMax falls back to `METRICS[metric].yMax`, preserving the
  // pre-existing `data-y-max === METRICS.*.yMax` observable exercised by
  // the scope-view suite.
  const renderFrame = buildFrame(store, selectedMetric, nowFn(), {
    yMaxMode: "dynamic",
    hiddenSessions: hiddenSessions ?? EMPTY_HIDDEN_SESSIONS,
  });
  const frameRef = useRef<Frame>(renderFrame);
  frameRef.current = renderFrame;
  // Theme colors cached per resize — resolved via getComputedStyle once per
  // dimension change rather than every rAF tick. The resize-coupled cadence
  // matches the OscilloscopeView pattern and keeps the render loop allocation-free.
  const gridColorRef = useRef<string>(GRID_COLOR_FALLBACK);
  const axisLabelColorRef = useRef<string>(AXIS_LABEL_COLOR_FALLBACK);

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  });

  // -----------------------------------------------------------------------
  // ResizeObserver: track the container's size and refresh on change.
  // -----------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Resolve theme tokens on mount so the first render already has
    // container-derived colors rather than fallbacks.
    gridColorRef.current = resolveThemeColor(
      container,
      GRID_COLOR_PROP,
      GRID_COLOR_FALLBACK,
    );
    axisLabelColorRef.current = resolveThemeColor(
      container,
      AXIS_LABEL_COLOR_PROP,
      AXIS_LABEL_COLOR_FALLBACK,
    );
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Refresh theme tokens alongside dimensions — a theme change
          // without a resize is rare enough to skip dedicated tracking.
          gridColorRef.current = resolveThemeColor(
            container,
            GRID_COLOR_PROP,
            GRID_COLOR_FALLBACK,
          );
          axisLabelColorRef.current = resolveThemeColor(
            container,
            AXIS_LABEL_COLOR_PROP,
            AXIS_LABEL_COLOR_FALLBACK,
          );
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // rAF render loop. Computes a FRESH frame each tick via `buildFrame` so
  // the 60-second window's right edge tracks real time regardless of store-
  // notification cadence. Also refreshes `frameRef.current` so the hover
  // hit-test always queries the most recently rendered frame.
  // Pauses when document.visibilityState is hidden.
  // -----------------------------------------------------------------------
  const renderTick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Compute a FRESH frame for this tick. This is the key change from the
    // previous architecture: `now` advances every rAF tick so traces scroll
    // smoothly even between store notifications. Dynamic yMax keeps the
    // scope filling vertical space when real peaks are well below the cap.
    const activeFrame = buildFrame(
      storeRef.current,
      selectedMetricRef.current,
      nowFnRef.current(),
      {
        yMaxMode: "dynamic",
        hiddenSessions: hiddenSessionsRef.current,
      },
    );
    // Refresh the ref so a pointer event arriving mid-tick hits against the
    // same frame that was just rendered.
    frameRef.current = activeFrame;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssW = dimensions.width;
    const cssH = dimensions.height;

    // Resize canvas to DPR-scaled backing store when dimensions change.
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.scale(dpr, dpr);
    }

    // Ensure the persistence buffer tracks the current (w, h, metric, dpr).
    const { buffer } = ensurePersistenceBuffer<HTMLCanvasElement>(
      bufferCellRef.current,
      cssW * dpr,
      cssH * dpr,
      activeFrame.metric,
      dpr,
      (width, height) => {
        const off = document.createElement("canvas");
        off.width = width;
        off.height = height;
        return off;
      },
    );
    const bufferCtx = buffer.getContext("2d");
    if (!bufferCtx) return;
    // Keep the buffer's transform aligned with the primary canvas so our
    // CSS-pixel math draws correctly onto the DPR-backed pixel grid.
    bufferCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawFrame(
      ctx,
      bufferCtx,
      activeFrame,
      cssW,
      cssH,
      gridColorRef.current,
      axisLabelColorRef.current,
    );

    // --- Live hover: re-run hit-test against the freshly-built frame so the
    // selection tracks the scrolling trace. The pointer position is held in
    // `lastPointerRef` (written by mousemove, cleared by mouseleave). When
    // the pointer is absent we both skip drawing the beating dot and ensure
    // the parent's hover state is null (cleared by mouseleave already —
    // this branch is a no-op guard).
    const pointer = lastPointerRef.current;
    if (pointer !== null) {
      const livePointer = {
        x: pointer.x,
        y: pointer.y,
        width: pointer.width,
        height: pointer.height,
      };
      const liveSelection = scopeHitTest(livePointer, activeFrame);
      if (liveSelection !== null) {
        // Draw the beating dot AFTER drawFrame composites the persistence
        // buffer onto the primary canvas, so the dot sits on top of
        // everything and leaves no afterglow trail as the trace scrolls.
        drawHoverBeat(
          ctx,
          liveSelection,
          activeFrame,
          cssW,
          cssH,
          nowFnRef.current(),
        );

        // De-churned emit: only notify the parent when the meaningful
        // content has changed. Sample identity (sessionId + time + value)
        // changes when a new sample appears under the cursor; the bucketed
        // age advances every HOVER_EMIT_AGE_BUCKET_MS so the tooltip's
        // "Ns ago" readout updates at tooltip-display granularity without
        // flooding React with per-frame selections.
        const ageBucket = Math.floor(liveSelection.ageMs / HOVER_EMIT_AGE_BUCKET_MS);
        const key = `${liveSelection.sessionId}|${liveSelection.time}|${liveSelection.value}|${ageBucket}`;
        if (key !== lastEmittedHoverKeyRef.current) {
          lastEmittedHoverKeyRef.current = key;
          onHoverChangeRef.current({
            ...liveSelection,
            pointerClientX: pointer.clientX,
            pointerClientY: pointer.clientY,
          });
        }
      } else if (lastEmittedHoverKeyRef.current !== null) {
        // Pointer still inside canvas but hit-test returned null (no traces
        // with samples). Clear any stale selection so the tooltip hides.
        lastEmittedHoverKeyRef.current = null;
        onHoverChangeRef.current(null);
      }
    }
  }, [dimensions]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const tick = () => {
      renderTick();
      rafIdRef.current = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = window.requestAnimationFrame(tick);
    };
    const stop = () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        start();
      }
    };

    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      // Start paused if the document is hidden at mount time.
    } else {
      start();
    }

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [renderTick]);

  // -----------------------------------------------------------------------
  // Pointer handlers: pure hit-test → onHoverChange.
  // -----------------------------------------------------------------------
  const handleMouseMove = useCallback(
    (event: ReactMouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
      // Compensate for CSS zoom: `getBoundingClientRect()` returns ZOOMED
      // dimensions, `ResizeObserver.contentRect` (our `dimensions` state)
      // returns UNZOOMED logical dimensions. Their ratio IS the CSS zoom
      // factor set by Ctrl-+/- on `documentElement.style.zoom`. `clientX/Y`
      // arrive in zoomed space; the portal tooltip's `position: fixed`
      // expects unzoomed CSS layout pixels. Divide to normalize. Mirrors
      // the v1 PM fix (cf7af6c).
      const { normalizedClientX, normalizedClientY } = normalizeClientPointer(
        event.clientX,
        event.clientY,
        { width: rect.width, height: rect.height },
        { width: dimensions.width, height: dimensions.height },
      );
      // Persist the pointer for the rAF tick's live hit-test so the beating
      // dot + tooltip keep tracking the scrolling trace even when the
      // cursor is perfectly still.
      lastPointerRef.current = {
        x: pointer.x,
        y: pointer.y,
        width: pointer.width,
        height: pointer.height,
        clientX: normalizedClientX,
        clientY: normalizedClientY,
      };
      // Eagerly fire once on the pointer event so the tooltip shows up on
      // the same frame as the mousemove rather than waiting for the next
      // rAF tick. The rAF-tick de-churn continues from here using the
      // emitted key.
      const selection = scopeHitTest(pointer, frameRef.current);
      if (selection === null) {
        lastEmittedHoverKeyRef.current = null;
        onHoverChange(null);
        return;
      }
      const ageBucket = Math.floor(selection.ageMs / HOVER_EMIT_AGE_BUCKET_MS);
      lastEmittedHoverKeyRef.current = `${selection.sessionId}|${selection.time}|${selection.value}|${ageBucket}`;
      onHoverChange({
        ...selection,
        pointerClientX: normalizedClientX,
        pointerClientY: normalizedClientY,
      });
    },
    [onHoverChange, dimensions],
  );

  const handleMouseLeave = useCallback(() => {
    lastPointerRef.current = null;
    lastEmittedHoverKeyRef.current = null;
    onHoverChange(null);
  }, [onHoverChange]);

  return (
    <div
      ref={containerRef}
      className="phosphor-canvas-host"
      data-testid="phosphor-canvas-host"
      data-metric={renderFrame.metric}
      data-y-max={renderFrame.yMax}
      data-unit={renderFrame.unit}
      data-trace-count={renderFrame.traces.length}
      data-pulse-count={renderFrame.pulses.length}
    >
      <canvas
        ref={canvasRef}
        className="phosphor-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};
