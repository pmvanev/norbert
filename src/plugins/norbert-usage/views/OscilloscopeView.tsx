/**
 * OscilloscopeView: dual-trace canvas waveform renderer.
 *
 * Renders token rate and cost rate waveforms from TimeSeriesBuffer samples
 * on an HTML Canvas element. Targets approximately 10Hz refresh.
 *
 * Pure rendering logic delegated to domain/oscilloscope.ts.
 * This component handles only canvas drawing and animation frame scheduling.
 */

import { useRef, useEffect, useCallback } from "react";
import type { TimeSeriesBuffer } from "../domain/types";
import {
  prepareWaveformPoints,
  computeGridLines,
  formatRateOverlay,
  type CanvasDimensions,
  type WaveformPoint,
  type GridLine,
} from "../domain/oscilloscope";
import { getSamples, computeStats } from "../domain/timeSeriesSampler";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 200;
const CANVAS_PADDING = 10;
const WINDOW_DURATION_MS = 60_000;
const GRID_INTERVAL_MS = 10_000;
const REFRESH_INTERVAL_MS = 100; // ~10Hz

const TOKEN_RATE_COLOR = "#6366f1"; // brand indigo
const COST_RATE_COLOR = "#f59e0b"; // amber
const GRID_COLOR = "rgba(255, 255, 255, 0.1)";
const GRID_LABEL_COLOR = "rgba(255, 255, 255, 0.4)";
const OVERLAY_COLOR = "#e2e8f0";
const BACKGROUND_COLOR = "#1e1e2e";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OscilloscopeViewProps {
  readonly buffer: TimeSeriesBuffer;
}

// ---------------------------------------------------------------------------
// Canvas drawing functions (pure, no side effects on domain data)
// ---------------------------------------------------------------------------

const dimensions: CanvasDimensions = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  padding: CANVAS_PADDING,
};

const clearCanvas = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
};

const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  gridLines: ReadonlyArray<GridLine>,
): void => {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.font = "10px monospace";
  ctx.fillStyle = GRID_LABEL_COLOR;

  for (const line of gridLines) {
    ctx.beginPath();
    ctx.moveTo(line.x, CANVAS_PADDING);
    ctx.lineTo(line.x, CANVAS_HEIGHT - CANVAS_PADDING);
    ctx.stroke();

    ctx.fillText(line.label, line.x + 3, CANVAS_HEIGHT - 2);
  }
};

const drawTrace = (
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<WaveformPoint>,
  color: string,
): void => {
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.stroke();
};

const drawRateOverlay = (
  ctx: CanvasRenderingContext2D,
  label: string,
): void => {
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = OVERLAY_COLOR;
  ctx.fillText(label, CANVAS_PADDING + 4, CANVAS_PADDING + 16);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OscilloscopeView = ({ buffer }: OscilloscopeViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const samples = getSamples(buffer);
    const gridLines = computeGridLines(
      dimensions,
      WINDOW_DURATION_MS,
      GRID_INTERVAL_MS,
    );

    const tokenRatePoints = prepareWaveformPoints(
      samples,
      dimensions,
      "tokenRate",
    );
    const costRatePoints = prepareWaveformPoints(
      samples,
      dimensions,
      "costRate",
    );

    const stats = computeStats(buffer);
    const rateLabel = formatRateOverlay(stats.peakRate > 0 ? samples[samples.length - 1]?.tokenRate ?? 0 : 0);

    clearCanvas(ctx);
    drawGridLines(ctx, gridLines);
    drawTrace(ctx, tokenRatePoints, TOKEN_RATE_COLOR);
    drawTrace(ctx, costRatePoints, COST_RATE_COLOR);
    drawRateOverlay(ctx, rateLabel);
  }, [buffer]);

  useEffect(() => {
    renderFrame();

    intervalRef.current = setInterval(renderFrame, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [renderFrame]);

  return (
    <div className="oscilloscope" role="img" aria-label="Token burn oscilloscope">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="oscilloscope-canvas"
      />
    </div>
  );
};
