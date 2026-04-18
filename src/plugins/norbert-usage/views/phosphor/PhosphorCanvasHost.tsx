/**
 * PhosphorCanvasHost — the sole effect component for the phosphor scope.
 *
 * Step 09-02 replaces the 09-01 stub with the real canvas host. This
 * component:
 *
 *   - Owns a primary `<canvas>` (ref) and an offscreen persistence buffer
 *     (ref, managed by `ensurePersistenceBuffer`).
 *   - Tracks its container's size via `ResizeObserver` and the device pixel
 *     ratio via `window.devicePixelRatio`, mirroring the pattern proven in
 *     `OscilloscopeView.tsx`.
 *   - Runs a `requestAnimationFrame` loop that renders the current Frame
 *     every tick. The loop pauses when `document.visibilityState === 'hidden'`
 *     (the scope is a peripheral-glance view; no need to waste GPU when the
 *     window is hidden).
 *   - Handles pointer events: `mousemove` calls the pure `scopeHitTest` and
 *     fires `onHoverChange` with the result; `mouseleave` fires `onHoverChange(null)`.
 *
 * Canvas drawing follows the pure/effect split: `buildFrame` (upstream, pure)
 * produces the Frame; all drawing routines here are effect-only and read the
 * Frame. The drawing itself is intentionally minimal for Step 09-02 (trace
 * polyline + pulse flares + afterglow overlay) — visual polish can be
 * layered on later without changing the prop contract.
 *
 * Test observability: the container div preserves the data attributes used
 * by the 09-01 stub (`data-metric`, `data-y-max`, `data-unit`, `data-trace-count`,
 * `data-pulse-count`) so existing PhosphorScopeView tests continue to pass
 * without canvas-specific test infrastructure.
 *
 * Pure-core boundary: this file is the ONE place inside the phosphor view
 * subtree that touches `requestAnimationFrame`, `document`, `ResizeObserver`,
 * and the CanvasRenderingContext2D. All projection math lives in
 * `domain/phosphor/scopeProjection.ts` and `scopeHitTest.ts`.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Frame, FramePulse, FrameTrace } from "../../domain/phosphor/scopeProjection";
import { scopeHitTest, type HoverSelection } from "../../domain/phosphor/scopeHitTest";
import { WINDOW_MS } from "../../domain/phosphor/phosphorMetricConfig";
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
// Alpha applied to the persistence buffer each frame to produce afterglow
// decay. 0.92 matches the prototype's phosphor falloff: recent traces linger
// ~0.5s, older traces fade into background.
const PERSISTENCE_DECAY_ALPHA = 0.08;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PhosphorCanvasHostProps {
  readonly frame: Frame;
  readonly onHoverChange: (selection: HoverSelection | null) => void;
}

// ---------------------------------------------------------------------------
// Pure geometry helpers — mirror scopeHitTest's projection math exactly so
// hover and render stay coherent (see scopeHitTest.ts for the contract).
// ---------------------------------------------------------------------------

/** Map a sample time `t` to x pixels within `[0, width]` given `now`. */
const timeToX = (t: number, width: number, now: number): number =>
  width * (1 - (now - t) / WINDOW_MS);

/** Map a sample value `v` to y pixels within `[0, height]` given `yMax`. */
const valueToY = (v: number, height: number, yMax: number): number =>
  height * (1 - v / yMax);

// ---------------------------------------------------------------------------
// Canvas drawing (effects-only)
// ---------------------------------------------------------------------------

const drawTrace = (
  ctx: CanvasRenderingContext2D,
  trace: FrameTrace,
  frame: Frame,
  width: number,
  height: number,
): void => {
  if (trace.samples.length < 2) return;
  ctx.strokeStyle = trace.color;
  ctx.lineWidth = TRACE_LINE_WIDTH;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const first = trace.samples[0];
  ctx.moveTo(timeToX(first.t, width, frame.now), valueToY(first.v, height, frame.yMax));
  for (let i = 1; i < trace.samples.length; i++) {
    const sample = trace.samples[i];
    ctx.lineTo(timeToX(sample.t, width, frame.now), valueToY(sample.v, height, frame.yMax));
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

const drawFrame = (
  ctx: CanvasRenderingContext2D,
  bufferCtx: CanvasRenderingContext2D,
  frame: Frame,
  width: number,
  height: number,
): void => {
  // Decay the persistence buffer by erasing a small alpha each frame. This
  // produces the phosphor afterglow: recent strokes remain visible briefly,
  // older strokes fade. The buffer is the source of the visible trail.
  bufferCtx.save();
  bufferCtx.globalCompositeOperation = "destination-out";
  bufferCtx.fillStyle = `rgba(0, 0, 0, ${PERSISTENCE_DECAY_ALPHA})`;
  bufferCtx.fillRect(0, 0, width, height);
  bufferCtx.restore();

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
  frame,
  onHoverChange,
}: PhosphorCanvasHostProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferCellRef = useRef<PersistenceBufferCell<HTMLCanvasElement>>({
    key: null,
    buffer: null,
  });
  const rafIdRef = useRef<number | null>(null);
  const frameRef = useRef<Frame>(frame);

  // Always push the latest frame into the ref so the rAF loop reads fresh
  // state without re-subscribing.
  frameRef.current = frame;

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
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // -----------------------------------------------------------------------
  // rAF render loop. Reads the latest frame via frameRef and renders through
  // the persistence buffer. Pauses when document.visibilityState is hidden.
  // -----------------------------------------------------------------------
  const renderTick = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const activeFrame = frameRef.current;
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

    drawFrame(ctx, bufferCtx, activeFrame, cssW, cssH);
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
      onHoverChange(scopeHitTest(pointer, frameRef.current));
    },
    [onHoverChange],
  );

  const handleMouseLeave = useCallback(() => {
    onHoverChange(null);
  }, [onHoverChange]);

  return (
    <div
      ref={containerRef}
      className="phosphor-canvas-host"
      data-testid="phosphor-canvas-host"
      data-metric={frame.metric}
      data-y-max={frame.yMax}
      data-unit={frame.unit}
      data-trace-count={frame.traces.length}
      data-pulse-count={frame.pulses.length}
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
