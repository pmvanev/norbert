/**
 * OscilloscopeView: dual-trace canvas waveform renderer.
 *
 * Renders token rate and cost rate waveforms from TimeSeriesBuffer samples
 * on an HTML Canvas element. Targets approximately 10Hz refresh.
 *
 * Pure rendering logic delegated to domain/oscilloscope.ts.
 * This component handles canvas drawing, animation frame scheduling,
 * store subscription for live updates, and responsive canvas resize.
 */

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import type { TimeSeriesBuffer } from "../domain/types";
import {
  prepareWaveformPoints,
  computeGridLines,
  computeCanvasDimensions,
  formatRateOverlay,
  formatStatsBar,
  type CanvasDimensions,
  type WaveformPoint,
  type GridLine,
} from "../domain/oscilloscope";
import { getSamples, computeStats } from "../domain/timeSeriesSampler";
import type { MetricsStore } from "../adapters/metricsStore";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 200;
const CANVAS_PADDING = 10;
const WINDOW_DURATION_MS = 60_000;
const GRID_INTERVAL_MS = 10_000;
const REFRESH_INTERVAL_MS = 100; // ~10Hz
const ASPECT_RATIO = 3; // width:height

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
  readonly store: MetricsStore;
}

// ---------------------------------------------------------------------------
// Canvas drawing functions (pure, no side effects on domain data)
// ---------------------------------------------------------------------------

const clearCanvas = (
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
): void => {
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);
};

const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  gridLines: ReadonlyArray<GridLine>,
  dimensions: CanvasDimensions,
): void => {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.font = "10px monospace";
  ctx.fillStyle = GRID_LABEL_COLOR;

  for (const line of gridLines) {
    ctx.beginPath();
    ctx.moveTo(line.x, dimensions.padding);
    ctx.lineTo(line.x, dimensions.height - dimensions.padding);
    ctx.stroke();

    ctx.fillText(line.label, line.x + 3, dimensions.height - 2);
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
  dimensions: CanvasDimensions,
): void => {
  ctx.font = "bold 14px monospace";
  ctx.fillStyle = OVERLAY_COLOR;
  ctx.fillText(label, dimensions.padding + 4, dimensions.padding + 16);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OscilloscopeView = ({ store }: OscilloscopeViewProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bufferRef = useRef<TimeSeriesBuffer>(store.getTimeSeries());

  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    padding: CANVAS_PADDING,
  });

  // Subscribe to store for live buffer updates
  useEffect(() => {
    const unsubscribe = store.subscribe((_metrics, timeSeries) => {
      bufferRef.current = timeSeries;
    });

    return unsubscribe;
  }, [store]);

  // ResizeObserver for responsive canvas dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasDimensions(computeCanvasDimensions(width, height, ASPECT_RATIO));
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const stats = useMemo(
    () => computeStats(bufferRef.current),
    [canvasDimensions],
  );
  const statsDisplay = useMemo(() => formatStatsBar(stats), [stats]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const buffer = bufferRef.current;
    const samples = getSamples(buffer);
    const gridLines = computeGridLines(
      canvasDimensions,
      WINDOW_DURATION_MS,
      GRID_INTERVAL_MS,
    );

    const tokenRatePoints = prepareWaveformPoints(
      samples,
      canvasDimensions,
      "tokenRate",
    );
    const costRatePoints = prepareWaveformPoints(
      samples,
      canvasDimensions,
      "costRate",
    );

    const currentStats = computeStats(buffer);
    const rateLabel = formatRateOverlay(
      currentStats.peakRate > 0
        ? samples[samples.length - 1]?.tokenRate ?? 0
        : 0,
    );

    clearCanvas(ctx, canvasDimensions);
    drawGridLines(ctx, gridLines, canvasDimensions);
    drawTrace(ctx, tokenRatePoints, TOKEN_RATE_COLOR);
    drawTrace(ctx, costRatePoints, COST_RATE_COLOR);
    drawRateOverlay(ctx, rateLabel, canvasDimensions);
  }, [canvasDimensions]);

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
    <div
      ref={containerRef}
      className="oscilloscope"
      role="img"
      aria-label="Token burn oscilloscope"
    >
      <canvas
        ref={canvasRef}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        className="oscilloscope-canvas"
      />
      <div
        className="oscilloscope-stats-bar"
        role="status"
        aria-label="Oscilloscope statistics"
      >
        <span className="oscilloscope-stat" data-stat="peak">
          Peak: {statsDisplay.peakRate}
        </span>
        <span className="oscilloscope-stat" data-stat="avg">
          Avg: {statsDisplay.avgRate}
        </span>
        <span className="oscilloscope-stat" data-stat="total">
          Total: {statsDisplay.totalTokens}
        </span>
        <span className="oscilloscope-stat" data-stat="window">
          Window: {statsDisplay.windowDuration}
        </span>
      </div>
    </div>
  );
};
