/**
 * PMChart: canvas-based time-series chart for the Performance Monitor.
 *
 * Supports two rendering modes:
 * - aggregate: grid lines, filled area, line trace
 * - mini: no axes, session label, filled area
 *
 * Hover: emits sample index, value, and time offset via onHover callback.
 * Renders on HTML Canvas with DPR scaling (no blurry rendering at 125%/150% DPI).
 *
 * Pure rendering logic delegated to domain/chartRenderer.ts and domain/oscilloscope.ts.
 * This component handles canvas drawing, resize observation, and periodic redraw (~1Hz).
 */

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import type { RateSample, ChartMode } from "../domain/types";
import type { RateField, CanvasDimensions } from "../domain/oscilloscope";
import { computeHorizontalGridLines } from "../domain/oscilloscope";
import {
  prepareFilledAreaPoints,
  computeHitTest,
  type FilledAreaPoint,
} from "../domain/chartRenderer";

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
// Color utilities
// ---------------------------------------------------------------------------

const hexToRgba = (color: string, alpha: number): string => {
  const match = color.match(/#([0-9a-f]{6})/i);
  if (match) {
    const r = parseInt(match[1].slice(0, 2), 16);
    const g = parseInt(match[1].slice(2, 4), 16);
    const b = parseInt(match[1].slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(255, 255, 255, ${alpha})`;
};

/** Read a CSS custom property from :root, with fallback. */
const getCssVar = (name: string, fallback: string): string => {
  if (typeof document === "undefined") return fallback;
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return val || fallback;
};

/** Resolve a category color through its CSS var, falling back to the hardcoded hex. */
export const resolveThemeColor = (cssVar: string, fallback: string): string =>
  getCssVar(cssVar, fallback);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMChartProps {
  readonly title: string;
  readonly samples: ReadonlyArray<RateSample>;
  readonly field: RateField;
  readonly color: string;
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
// Constants
// ---------------------------------------------------------------------------

/** How often (ms) the chart redraws to show time progression. */
const CHART_REFRESH_MS = 1000;

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 120;
const CANVAS_PADDING = 10;
const HORIZONTAL_GRID_COUNT = 4;
const VERTICAL_GRID_COUNT = 5;

// ---------------------------------------------------------------------------
// Pure canvas drawing functions
// ---------------------------------------------------------------------------

const clearCanvas = (
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
): void => {
  ctx.clearRect(0, 0, dimensions.width, dimensions.height);
  ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
  ctx.fillRect(0, 0, dimensions.width, dimensions.height);
};

const drawGridLines = (
  ctx: CanvasRenderingContext2D,
  dimensions: CanvasDimensions,
): void => {
  const gridColor = getCssVar("--osc-grid", "rgba(0, 229, 204, 0.18)");
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.setLineDash?.([2, 4]);

  // Horizontal grid lines
  const horizontalLines = computeHorizontalGridLines(dimensions, HORIZONTAL_GRID_COUNT);
  for (const line of horizontalLines) {
    ctx.beginPath();
    ctx.moveTo(dimensions.padding, line.y);
    ctx.lineTo(dimensions.width - dimensions.padding, line.y);
    ctx.stroke();
  }

  // Vertical grid lines (evenly spaced)
  const { width, height, padding } = dimensions;
  const drawableWidth = width - 2 * padding;
  for (let i = 1; i <= VERTICAL_GRID_COUNT; i++) {
    const x = padding + (i / (VERTICAL_GRID_COUNT + 1)) * drawableWidth;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();
  }

  ctx.setLineDash?.([]);
};

const drawFilledArea = (
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<FilledAreaPoint>,
  color: string,
  dimensions: CanvasDimensions,
): void => {
  if (points.length < 2) return;

  const bottomY = dimensions.height - dimensions.padding;

  // Create gradient fill
  const gradient = ctx.createLinearGradient(0, dimensions.padding, 0, bottomY);
  gradient.addColorStop(0, hexToRgba(color, 0.18));
  gradient.addColorStop(1, hexToRgba(color, 0.03));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(points[0].x, bottomY);
  for (const point of points) {
    ctx.lineTo(point.x, point.y);
  }
  ctx.lineTo(points[points.length - 1].x, bottomY);
  ctx.closePath();
  ctx.fill();
};

const drawLineTrace = (
  ctx: CanvasRenderingContext2D,
  points: ReadonlyArray<FilledAreaPoint>,
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

const drawCrosshair = (
  ctx: CanvasRenderingContext2D,
  crosshairX: number,
  dimensions: CanvasDimensions,
  color: string,
): void => {
  const topY = dimensions.padding;
  const bottomY = dimensions.height - dimensions.padding;

  ctx.save();
  ctx.strokeStyle = hexToRgba(color, 0.6);
  ctx.lineWidth = 1;
  ctx.setLineDash?.([]);
  ctx.beginPath();
  ctx.moveTo(crosshairX, topY);
  ctx.lineTo(crosshairX, bottomY);
  ctx.stroke();
  ctx.restore();
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMChart = ({
  title,
  samples,
  field,
  color,
  mode = "aggregate",
  yMax,
  yLabels: _yLabels = [],
  label,
  formatValue: _formatValue,
  hoverIndex: _hoverIndex,
  onHover,
  onHoverEnd,
}: PMChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Store callbacks in refs so redraw always uses the latest version
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const onHoverEndRef = useRef(onHoverEnd);
  onHoverEndRef.current = onHoverEnd;

  // Track CSS-pixel X position for crosshair rendering (null = not hovering)
  const crosshairXRef = useRef<number | null>(null);

  const isAggregate = mode === "aggregate";

  const [canvasDimensions, setCanvasDimensions] = useState<CanvasDimensions>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    padding: CANVAS_PADDING,
  });

  // Autoscale Y-axis from data with 10% headroom
  const effectiveYMax = useMemo(() => {
    if (samples.length === 0) return yMax ?? 1;
    const peak = samples.reduce((max, s) => Math.max(max, s[field]), 0);
    return peak > 0 ? peak * 1.1 : (yMax ?? 1);
  }, [yMax, samples, field]);

  // Convert RateSamples to ChartSample format for prepareFilledAreaPoints
  const chartSamples = useMemo(
    () => samples.map((s) => ({ timestamp: s.timestamp, value: s[field] })),
    [samples, field],
  );

  // ResizeObserver for responsive canvas dimensions
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setCanvasDimensions({
            width: Math.round(width),
            height: Math.round(height),
            padding: CANVAS_PADDING,
          });
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

    // Compute chart points from domain function
    const points = prepareFilledAreaPoints(chartSamples, canvasDimensions, effectiveYMax);

    // Draw pipeline: clear -> grid -> filled area -> line trace
    clearCanvas(ctx, canvasDimensions);

    if (isAggregate) {
      drawGridLines(ctx, canvasDimensions);
    }

    drawFilledArea(ctx, points, color, canvasDimensions);
    drawLineTrace(ctx, points, color);

    // Draw crosshair at hovered position (CSS pixel space, DPR-independent)
    const crosshairX = crosshairXRef.current;
    if (crosshairX !== null) {
      drawCrosshair(ctx, crosshairX, canvasDimensions, color);
    }
  }, [canvasDimensions, chartSamples, effectiveYMax, color, isAggregate]);

  // Mouse interaction: hit-test and hover callbacks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      // Update crosshair position and trigger re-render
      crosshairXRef.current = mouseX;
      renderFrame();

      const hover = onHoverRef.current;
      if (!hover) return;

      const { sampleIndex } = computeHitTest(
        mouseX,
        canvasDimensions.width,
        chartSamples.length,
        canvasDimensions.padding,
      );

      if (sampleIndex < 0) return;

      const value = chartSamples[sampleIndex]?.value ?? 0;
      const timeOffsetMs = (chartSamples.length - 1 - sampleIndex) * 1000;

      hover({
        sampleIndex,
        value,
        timeOffsetMs,
        tooltipX: e.clientX,
        tooltipY: e.clientY,
      });
    };

    const handleMouseLeave = (): void => {
      crosshairXRef.current = null;
      renderFrame();
      onHoverEndRef.current?.();
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [canvasDimensions, chartSamples, renderFrame]);

  // Initial render + periodic redraw at ~1Hz
  useEffect(() => {
    renderFrame();

    intervalRef.current = setInterval(renderFrame, CHART_REFRESH_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [renderFrame]);

  return (
    <div className="pm-chart-wrap" role="img" aria-label={title}>
      {!isAggregate && label && (
        <div className="pm-chart-ext-label" style={{ color }}>
          {label}
        </div>
      )}
      <div ref={containerRef} className="pm-chart-cell">
        <canvas
          ref={canvasRef}
          width={canvasDimensions.width}
          height={canvasDimensions.height}
        />
      </div>
    </div>
  );
};
