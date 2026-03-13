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
const GRID_COLOR_FALLBACK = "rgba(0, 229, 204, 0.08)";
const GRID_LABEL_COLOR = "rgba(255, 255, 255, 0.4)";
const OVERLAY_COLOR_PROP = "--text-p";
const OVERLAY_COLOR_FALLBACK = "#c8f0e8";
const BACKGROUND_COLOR_PROP = "--osc-bg";
const BACKGROUND_COLOR_FALLBACK = "rgba(0, 8, 6, 0.85)";

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
  ctx.fillStyle = getThemeColor(BACKGROUND_COLOR_PROP, BACKGROUND_COLOR_FALLBACK);
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);
};

const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  gridLines: ReadonlyArray<GridLine>,
  dimensions: CanvasDimensions,
): void => {
  ctx.strokeStyle = getThemeColor(GRID_COLOR_PROP, GRID_COLOR_FALLBACK);
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
  ctx.fillStyle = getThemeColor(OVERLAY_COLOR_PROP, OVERLAY_COLOR_FALLBACK);
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
    setStatsDisplay(formatStatsBar(currentStats));

    const rateLabel = formatRateOverlay(
      currentStats.peakRate > 0
        ? samples[samples.length - 1]?.tokenRate ?? 0
        : 0,
    );

    const tokenColor = getThemeColor(TOKEN_RATE_COLOR_PROP, TOKEN_RATE_COLOR_FALLBACK);
    const costColor = getThemeColor(COST_RATE_COLOR_PROP, COST_RATE_COLOR_FALLBACK);

    clearCanvas(ctx, canvasDimensions);
    drawGridLines(ctx, gridLines, canvasDimensions);
    drawTrace(ctx, tokenRatePoints, tokenColor);
    drawTrace(ctx, costRatePoints, costColor);
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
    <div className="oscilloscope" role="img" aria-label="Token burn oscilloscope">
      <div className="sec-hdr">
        <span className="sec-t">// token burn rate</span>
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
