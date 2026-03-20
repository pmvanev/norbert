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

import { useRef, useEffect, useCallback, useState } from "react";
import type { TimeSeriesBuffer, RateSample } from "../domain/types";
import {
  prepareWaveformPoints,
  computeGridLines,
  computeHorizontalGridLines,
  computeCanvasDimensions,
  formatStatsBar,
  type CanvasDimensions,
  type WaveformPoint,
  type GridLine,
  type HGridLine,
} from "../domain/oscilloscope";
import { getSamples, appendSample, computeStats } from "../domain/timeSeriesSampler";
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

// Use CSS custom properties at runtime for theme-aware colors.
// Fallbacks are the Norbert default theme values.
const getThemeColor = (prop: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  return value || fallback;
};

const TOKEN_RATE_COLOR_PROP = "--brand";
const TOKEN_RATE_COLOR_FALLBACK = "#00e5cc";
const COST_RATE_COLOR_PROP = "--amber";
const COST_RATE_COLOR_FALLBACK = "#f0920a";
const GRID_COLOR_PROP = "--osc-grid";
const GRID_COLOR_FALLBACK = "rgba(0, 229, 204, 0.18)";
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
  ctx.clearRect(0, 0, dimensions.width, dimensions.height);
  // Very light tint — just enough for grid contrast, lets the app
  // background show through like Task Manager performance charts.
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);
};

const HORIZONTAL_GRID_COUNT = 4;

const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  verticalLines: ReadonlyArray<GridLine>,
  horizontalLines: ReadonlyArray<HGridLine>,
  dimensions: CanvasDimensions,
): void => {
  ctx.strokeStyle = getThemeColor(GRID_COLOR_PROP, GRID_COLOR_FALLBACK);
  ctx.lineWidth = 1;
  ctx.setLineDash?.([2, 4]);

  // Vertical lines
  for (const line of verticalLines) {
    ctx.beginPath();
    ctx.moveTo(line.x, dimensions.padding);
    ctx.lineTo(line.x, dimensions.height - dimensions.padding);
    ctx.stroke();
  }

  // Horizontal lines
  for (const line of horizontalLines) {
    ctx.beginPath();
    ctx.moveTo(dimensions.padding, line.y);
    ctx.lineTo(dimensions.width - dimensions.padding, line.y);
    ctx.stroke();
  }

  ctx.setLineDash?.([]);
};

const drawTrace = (
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<WaveformPoint>,
  color: string,
): void => {
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  ctx.stroke();
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

  const [statsDisplay, setStatsDisplay] = useState(() =>
    formatStatsBar(computeStats(bufferRef.current)),
  );

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

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale canvas for HiDPI displays to eliminate blurry rendering
    const dpr = devicePixelRatio || 1;
    const cssW = canvasDimensions.width;
    const cssH = canvasDimensions.height;
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.scale(dpr, dpr);
    }

    // Inject zero-rate heartbeat when no new sample has arrived,
    // keeping the waveform scrolling continuously during idle.
    const now = Date.now();
    const currentSamples = getSamples(bufferRef.current);
    const lastSampleTime = currentSamples.length > 0
      ? currentSamples[currentSamples.length - 1].timestamp
      : 0;

    if (now - lastSampleTime >= REFRESH_INTERVAL_MS) {
      const heartbeat: RateSample = { timestamp: now, tokenRate: 0, costRate: 0 };
      bufferRef.current = appendSample(bufferRef.current, heartbeat);
    }

    const buffer = bufferRef.current;
    const samples = getSamples(buffer);
    const verticalLines = computeGridLines(
      canvasDimensions,
      WINDOW_DURATION_MS,
      GRID_INTERVAL_MS,
    );
    const horizontalLines = computeHorizontalGridLines(
      canvasDimensions,
      HORIZONTAL_GRID_COUNT,
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
    setStatsDisplay(formatStatsBar(currentStats));

    const tokenColor = getThemeColor(TOKEN_RATE_COLOR_PROP, TOKEN_RATE_COLOR_FALLBACK);
    const costColor = getThemeColor(COST_RATE_COLOR_PROP, COST_RATE_COLOR_FALLBACK);

    clearCanvas(ctx, canvasDimensions);
    drawGridLines(ctx, verticalLines, horizontalLines, canvasDimensions);
    drawTrace(ctx, tokenRatePoints, tokenColor);
    drawTrace(ctx, costRatePoints, costColor);
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
    <div className="oscilloscope" role="img" aria-label="Token burn oscilloscope">
      <div className="sec-hdr">
        <span className="sec-t">Token Burn Rate</span>
        <span className="sec-a">60s · 10Hz</span>
      </div>
      <div ref={containerRef} className="osc-main">
        <canvas
          ref={canvasRef}
          width={canvasDimensions.width}
          height={canvasDimensions.height}
          className="oscilloscope-canvas"
        />
        <div className="osc-bottom">
          <div className="osc-legend">
            <div className="osc-legend-dot" style={{ background: "var(--brand)" }} />
            Token rate
          </div>
          <div className="osc-legend">
            <div className="osc-legend-dot" style={{ background: "var(--amber)" }} />
            Cost rate
          </div>
        </div>
      </div>
      <div className="osc-stats" role="status" aria-label="Oscilloscope statistics">
        <div className="osc-stat">
          <div className="osc-stat-l">Peak</div>
          <div className="osc-stat-v" data-mono="" style={{ color: "var(--brand)" }}>
            {statsDisplay.peakRate}
          </div>
        </div>
        <div className="osc-stat">
          <div className="osc-stat-l">Avg</div>
          <div className="osc-stat-v" data-mono="">{statsDisplay.avgRate}</div>
        </div>
        <div className="osc-stat">
          <div className="osc-stat-l">Total</div>
          <div className="osc-stat-v" data-mono="" style={{ color: "var(--amber)" }}>
            {statsDisplay.totalRateSum}
          </div>
        </div>
        <div className="osc-stat">
          <div className="osc-stat-l">Window</div>
          <div className="osc-stat-v" data-mono="">{statsDisplay.windowDuration}</div>
        </div>
      </div>
    </div>
  );
};
