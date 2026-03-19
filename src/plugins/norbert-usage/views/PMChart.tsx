/**
 * PMChart: reusable filled-area canvas chart for the Performance Monitor.
 *
 * Supports two rendering modes:
 * - aggregate: Y-axis labels, horizontal grid lines, current value overlay,
 *   gradient fill beneath the line.
 * - mini: no grid lines, session label + value overlay, gradient fill.
 *
 * Hover: emits sample index, value, and time offset to parent via onHover.
 * Crosshair: draws vertical line + dot when hoverIndex is provided.
 * Canvas sizes responsively via ResizeObserver.
 *
 * Pure rendering functions from domain/chartRenderer.ts and
 * domain/oscilloscope.ts handle all coordinate computation.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import type { RateSample, ChartMode } from "../domain/types";
import {
  computeCanvasDimensions,
  formatRateOverlay,
  type CanvasDimensions,
  type RateField,
} from "../domain/oscilloscope";
import {
  computeHitTest,
  computeCrosshairPosition,
  prepareHorizontalGridLines,
  prepareFilledAreaPoints,
  type HorizontalGridLine,
  type FilledAreaPoint,
  type CrosshairPosition,
} from "../domain/chartRenderer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 120;
const ASPECT_RATIO = 2.5;
const CROSSHAIR_COLOR = "rgba(255, 255, 255, 0.3)";
const CROSSHAIR_DOT_RADIUS = 4;
const BACKGROUND_COLOR = "rgba(0, 8, 6, 0.8)";
const GRID_LINE_COLOR = "rgba(255, 255, 255, 0.06)";
const GRID_LABEL_COLOR = "rgba(255, 255, 255, 0.4)";

// ---------------------------------------------------------------------------
// Hover data emitted to parent
// ---------------------------------------------------------------------------

export interface HoverData {
  readonly sampleIndex: number;
  readonly value: number;
  readonly timeOffsetMs: number;
  readonly tooltipX: number;
  readonly tooltipY: number;
}

// ---------------------------------------------------------------------------
// Canvas drawing functions (pure rendering, no domain side effects)
// ---------------------------------------------------------------------------

const clearCanvas = (
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
): void => {
  ctx.clearRect(0, 0, dimensions.width, dimensions.height);
  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);
};

const drawHorizontalGridLines = (
  ctx: CanvasRenderingContext2D,
  gridLines: ReadonlyArray<HorizontalGridLine>,
  dimensions: CanvasDimensions,
): void => {
  ctx.strokeStyle = GRID_LINE_COLOR;
  ctx.lineWidth = 1;
  ctx.font = "9px monospace";
  ctx.fillStyle = GRID_LABEL_COLOR;

  for (const line of gridLines) {
    ctx.beginPath();
    ctx.moveTo(dimensions.padding, line.y);
    ctx.lineTo(dimensions.width - dimensions.padding, line.y);
    ctx.stroke();
    ctx.fillText(line.label, dimensions.width - dimensions.padding + 4, line.y + 3);
  }
};

const drawFilledArea = (
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<FilledAreaPoint>,
  color: string,
  dimensions: CanvasDimensions,
): void => {
  if (points.length < 2) return;

  const bottomY = dimensions.height - dimensions.padding;

  // Draw the gradient fill beneath the line
  const gradient = ctx.createLinearGradient(0, dimensions.padding, 0, bottomY);
  gradient.addColorStop(0, colorWithAlpha(color, 0.15));
  gradient.addColorStop(1, colorWithAlpha(color, 0.05));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(points[0].x, bottomY);
  for (const point of points) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.lineTo(points[points.length - 1].x, bottomY);
  ctx.closePath();
  ctx.fill();

  // Draw the line on top
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

const drawCurrentValueOverlay = (
  ctx: CanvasRenderingContext2D,
  value: string,
  color: string,
  dimensions: CanvasDimensions,
): void => {
  ctx.font = "bold 18px monospace";
  ctx.fillStyle = color;
  ctx.fillText(value, dimensions.padding + 4, dimensions.padding + 22);
};

const drawMiniOverlay = (
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  color: string,
  dimensions: CanvasDimensions,
): void => {
  // Session label at top-left
  ctx.font = "bold 10px monospace";
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillText(label, dimensions.padding + 2, dimensions.padding + 11);

  // Current value at bottom-left
  ctx.font = "bold 12px monospace";
  ctx.fillStyle = color;
  ctx.fillText(value, dimensions.padding + 2, dimensions.height - dimensions.padding - 4);
};

const drawCrosshair = (
  ctx: CanvasRenderingContext2D,
  crosshair: CrosshairPosition,
  color: string,
  dimensions: CanvasDimensions,
): void => {
  // Vertical crosshair line
  ctx.strokeStyle = CROSSHAIR_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(crosshair.x, dimensions.padding);
  ctx.lineTo(crosshair.x, dimensions.height - dimensions.padding);
  ctx.stroke();

  // Dot at the data point
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(crosshair.x, crosshair.dotY, CROSSHAIR_DOT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
};

// ---------------------------------------------------------------------------
// Color utility
// ---------------------------------------------------------------------------

/** Parse a 6-digit hex string into [r, g, b] or return undefined. */
const parseHexToRgb = (hex: string): readonly [number, number, number] | undefined => {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b) ? undefined : [r, g, b];
};

/** Parse a hex or CSS color and return it with a specific alpha. */
const colorWithAlpha = (color: string, alpha: number): string => {
  // Match any 6-digit hex in the string (covers #RRGGBB and CSS var() fallbacks)
  const hexMatch = color.match(/#([0-9a-f]{6})/i);
  if (hexMatch) {
    const rgb = parseHexToRgb(hexMatch[1]);
    if (rgb) {
      return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
    }
  }

  // Fallback: return a semi-transparent white
  return `rgba(255, 255, 255, ${alpha})`;
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
  readonly mode?: ChartMode;
  readonly yMax?: number;
  readonly yLabels?: ReadonlyArray<string>;
  readonly label?: string;
  readonly formatValue?: (value: number) => string;
  readonly hoverIndex?: number;
  readonly onHover?: (data: HoverData) => void;
  readonly onHoverEnd?: () => void;
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
  mode = "aggregate",
  yMax,
  yLabels = [],
  label,
  formatValue,
  hoverIndex,
  onHover,
  onHoverEnd,
}: PMChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    padding: 10,
  });

  // Responsive resize via ResizeObserver
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

  // Hover handler: map mouseX to sample index and emit
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onHover || samples.length === 0) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const result = computeHitTest(
        mouseX,
        canvasDimensions.width,
        samples.length,
        canvasDimensions.padding,
      );

      if (result.sampleIndex < 0) return;

      const sampleValue = samples[result.sampleIndex][field];
      const timeOffsetMs = (samples.length - 1 - result.sampleIndex) * 1000;

      onHover({
        sampleIndex: result.sampleIndex,
        value: sampleValue,
        timeOffsetMs,
        tooltipX: event.clientX,
        tooltipY: event.clientY,
      });
    },
    [onHover, samples, canvasDimensions, field],
  );

  const handleMouseLeave = useCallback(() => {
    onHoverEnd?.();
  }, [onHoverEnd]);

  // Render frame: draws the filled-area chart with mode-specific overlays
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Compute the effective yMax from data or prop
    const effectiveYMax = yMax ?? computePeakFromSamples(samples, field);

    // Prepare filled-area points using chartRenderer (maps samples to canvas coords)
    const chartSamples = samples.map((s) => ({
      timestamp: s.timestamp,
      value: s[field],
    }));
    const points = prepareFilledAreaPoints(chartSamples, canvasDimensions, effectiveYMax);

    // Clear canvas
    clearCanvas(ctx, canvasDimensions);

    // Aggregate mode: draw horizontal grid lines with Y-axis labels
    if (mode === "aggregate" && yLabels.length > 0) {
      const gridLines = prepareHorizontalGridLines(canvasDimensions, yLabels);
      drawHorizontalGridLines(ctx, gridLines, canvasDimensions);
    }

    // Draw filled area with gradient
    drawFilledArea(ctx, points, color, canvasDimensions);

    // Mode-specific overlays
    const currentRate = samples.length > 0 ? samples[samples.length - 1][field] : 0;
    const displayValue = valueLabel ?? formatValue?.(currentRate) ?? formatRateOverlay(currentRate);

    if (mode === "aggregate") {
      drawCurrentValueOverlay(ctx, displayValue, color, canvasDimensions);
    } else {
      drawMiniOverlay(ctx, label ?? title, displayValue, color, canvasDimensions);
    }

    // Draw crosshair when hoverIndex is provided
    if (hoverIndex !== undefined && hoverIndex >= 0 && hoverIndex < samples.length) {
      const sampleValue = samples[hoverIndex][field];
      const crosshair = computeCrosshairPosition(
        hoverIndex,
        sampleValue,
        samples.length,
        effectiveYMax,
        canvasDimensions,
      );
      drawCrosshair(ctx, crosshair, color, canvasDimensions);
    }
  }, [samples, canvasDimensions, field, color, title, valueLabel, mode, yMax, yLabels, label, formatValue, hoverIndex]);

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
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute peak value from samples for auto-scaling when yMax not provided. */
const computePeakFromSamples = (
  samples: ReadonlyArray<RateSample>,
  field: RateField,
): number => {
  if (samples.length === 0) return 1;
  const peak = samples.reduce((max, s) => Math.max(max, s[field]), 0);
  return peak > 0 ? peak : 1;
};
