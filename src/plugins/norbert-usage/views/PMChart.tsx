/**
 * PMChart: reusable canvas chart cell for the Performance Monitor aggregate grid.
 *
 * Renders a single metric waveform on an HTML Canvas element, reusing the
 * pure rendering functions from domain/oscilloscope.ts (prepareWaveformPoints,
 * computeGridLines, formatRateOverlay).
 *
 * Each PMChart is one cell in the 2x2 aggregate grid. It receives samples,
 * a rate field to display, and a title/color for theming.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import type { RateSample } from "../domain/types";
import {
  prepareWaveformPoints,
  computeGridLines,
  computeCanvasDimensions,
  formatRateOverlay,
  type CanvasDimensions,
  type WaveformPoint,
  type GridLine,
  type RateField,
} from "../domain/oscilloscope";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 120;
const WINDOW_DURATION_MS = 60_000;
const GRID_INTERVAL_MS = 15_000;
const ASPECT_RATIO = 2.5;

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------

const getThemeColor = (prop: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
  return value || fallback;
};

const GRID_COLOR_FALLBACK = "rgba(0, 229, 204, 0.08)";
const GRID_LABEL_COLOR = "rgba(255, 255, 255, 0.4)";

// ---------------------------------------------------------------------------
// Canvas drawing (pure rendering, no domain side effects)
// ---------------------------------------------------------------------------

const clearCanvas = (
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
): void => {
  ctx.clearRect(0, 0, dimensions.width, dimensions.height);
  ctx.fillStyle = "rgba(0, 8, 6, 0.6)";
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);
};

const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  gridLines: ReadonlyArray<GridLine>,
  dimensions: CanvasDimensions,
): void => {
  ctx.strokeStyle = GRID_COLOR_FALLBACK;
  ctx.lineWidth = 1;
  ctx.font = "8px monospace";
  ctx.fillStyle = GRID_LABEL_COLOR;

  for (const line of gridLines) {
    ctx.beginPath();
    ctx.moveTo(line.x, dimensions.padding);
    ctx.lineTo(line.x, dimensions.height - dimensions.padding);
    ctx.stroke();
    ctx.fillText(line.label, line.x + 2, line.labelY);
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

const drawTitle = (
  ctx: CanvasRenderingContext2D,
  title: string,
  dimensions: CanvasDimensions,
): void => {
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = getThemeColor("--text-p", "#c8f0e8");
  ctx.fillText(title, dimensions.padding + 2, dimensions.padding + 12);
};

const drawValue = (
  ctx: CanvasRenderingContext2D,
  value: string,
  color: string,
  dimensions: CanvasDimensions,
): void => {
  ctx.font = "bold 13px monospace";
  ctx.fillStyle = color;
  ctx.fillText(value, dimensions.padding + 2, dimensions.height - dimensions.padding - 4);
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMChartProps {
  readonly title: string;
  readonly samples: ReadonlyArray<RateSample>;
  readonly field: RateField;
  readonly color: string;
  readonly valueLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMChart = ({
  title,
  samples,
  field,
  color,
  valueLabel,
}: PMChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    padding: 8,
  });

  // Responsive resize
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
    return () => observer.disconnect();
  }, []);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gridLines = computeGridLines(
      canvasDimensions,
      WINDOW_DURATION_MS,
      GRID_INTERVAL_MS,
    );

    const points = prepareWaveformPoints(samples, canvasDimensions, field);

    const currentRate = samples.length > 0
      ? samples[samples.length - 1][field]
      : 0;

    clearCanvas(ctx, canvasDimensions);
    drawGridLines(ctx, gridLines, canvasDimensions);
    drawTrace(ctx, points, color);
    drawTitle(ctx, title, canvasDimensions);

    const label = valueLabel ?? formatRateOverlay(currentRate);
    drawValue(ctx, label, color, canvasDimensions);
  }, [samples, canvasDimensions, field, color, title, valueLabel]);

  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  return (
    <div ref={containerRef} className="pm-chart-cell" role="img" aria-label={title}>
      <canvas
        ref={canvasRef}
        width={canvasDimensions.width}
        height={canvasDimensions.height}
        className="pm-chart-canvas"
      />
    </div>
  );
};
