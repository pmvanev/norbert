/**
 * Chart Renderer Pure Functions -- coordinate computation for filled-area
 * line charts, sparklines, hit-test, crosshair, and grid lines.
 *
 * All functions are pure: they receive data and return computed results.
 * No canvas context mutation -- the view layer uses these data structures
 * to draw on HTML Canvas.
 *
 * Composes with oscilloscope (CanvasDimensions type).
 */

import type { CanvasDimensions } from "./oscilloscope";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a hit-test: maps a mouseX position to the nearest sample index. */
export interface HitTestResult {
  readonly sampleIndex: number;
}

/** A horizontal grid line with Y position and label text. */
export interface HorizontalGridLine {
  readonly y: number;
  readonly label: string;
}

/** A point in the filled-area chart, representing canvas coordinates. */
export interface FilledAreaPoint {
  readonly x: number;
  readonly y: number;
}

/** Crosshair position: vertical line X and dot Y for the hovered sample. */
export interface CrosshairPosition {
  readonly x: number;
  readonly dotY: number;
}

/** A sample with timestamp and value, used by chart rendering functions. */
interface ChartSample {
  readonly timestamp: number;
  readonly value: number;
}

// ---------------------------------------------------------------------------
// computeHitTest -- map mouseX to nearest sample index (O(1) lookup)
// ---------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * Map a mouse X position on the canvas to the nearest sample index.
 *
 * Uses the drawable width (canvas width minus padding on both sides)
 * to compute a ratio, then scales to the buffer length.
 *
 * Returns sampleIndex = -1 when the buffer is empty.
 */
export const computeHitTest = (
  mouseX: number,
  canvasWidth: number,
  bufferLength: number,
  padding: number,
): HitTestResult => {
  if (bufferLength <= 0) {
    return { sampleIndex: -1 };
  }

  if (bufferLength === 1) {
    return { sampleIndex: 0 };
  }

  const drawableWidth = canvasWidth - 2 * padding;
  const clampedX = clamp(mouseX - padding, 0, drawableWidth);
  const ratio = clampedX / drawableWidth;
  const rawIndex = ratio * (bufferLength - 1);
  const sampleIndex = clamp(Math.round(rawIndex), 0, bufferLength - 1);

  return { sampleIndex };
};

// ---------------------------------------------------------------------------
// formatTimeOffset -- format millisecond offset as "Ns ago"
// ---------------------------------------------------------------------------

/**
 * Format a time offset in milliseconds as a human-readable "Ns ago" string.
 *
 * Always displays in seconds (no minute conversion).
 */
export const formatTimeOffset = (offsetMs: number): string => {
  const seconds = Math.floor(offsetMs / 1000);
  return `${seconds}s ago`;
};

// ---------------------------------------------------------------------------
// prepareHorizontalGridLines -- Y-axis grid lines at label intervals
// ---------------------------------------------------------------------------

/**
 * Compute horizontal grid line positions for Y-axis labels.
 *
 * Each label maps to an evenly-spaced Y position within the drawable height.
 * The first label (index 0) maps to the bottom, the last to the top.
 * Returns empty array when there are no labels.
 */
export const prepareHorizontalGridLines = (
  dimensions: CanvasDimensions,
  yLabels: ReadonlyArray<string>,
): ReadonlyArray<HorizontalGridLine> => {
  if (yLabels.length === 0) {
    return [];
  }

  const { height, padding } = dimensions;
  const topY = padding;
  const bottomY = height - padding;
  const drawableHeight = bottomY - topY;
  const lastIndex = yLabels.length - 1;

  return yLabels.map((label, index) => {
    const ratio = lastIndex === 0 ? 0 : index / lastIndex;
    const y = bottomY - ratio * drawableHeight;
    return { y, label };
  });
};

// ---------------------------------------------------------------------------
// mapValueToCanvasY -- shared helper for value-to-Y mapping
// ---------------------------------------------------------------------------

const mapValueToCanvasY = (
  value: number,
  yMax: number,
  topY: number,
  bottomY: number,
): number => {
  if (yMax === 0) return bottomY;
  const ratio = value / yMax;
  return bottomY - ratio * (bottomY - topY);
};

// ---------------------------------------------------------------------------
// prepareFilledAreaPoints -- map samples to canvas coordinates for filled chart
// ---------------------------------------------------------------------------

/**
 * Map an array of samples to canvas coordinates for a filled-area line chart.
 *
 * X coordinates are evenly distributed across the drawable width.
 * Y coordinates are normalized against yMax: yMax maps to the top padding,
 * zero maps to the bottom (height - padding). Canvas Y-axis is inverted.
 */
export const prepareFilledAreaPoints = (
  samples: ReadonlyArray<ChartSample>,
  dimensions: CanvasDimensions,
  yMax: number,
): ReadonlyArray<FilledAreaPoint> => {
  if (samples.length === 0) return [];

  const { width, height, padding } = dimensions;
  const drawableWidth = width - 2 * padding;
  const topY = padding;
  const bottomY = height - padding;
  const lastIndex = samples.length - 1;

  return samples.map((sample, index) => {
    const xRatio = lastIndex === 0 ? 0 : index / lastIndex;
    const x = padding + xRatio * drawableWidth;
    const y = mapValueToCanvasY(sample.value, yMax, topY, bottomY);
    return { x, y };
  });
};

// ---------------------------------------------------------------------------
// prepareSparklinePoints -- compact line-only points for sidebar sparklines
// ---------------------------------------------------------------------------

/**
 * Map samples to canvas coordinates for a sparkline rendering.
 *
 * Unlike filled-area points, sparkline X coordinates span the full width
 * (no padding). This produces a compact line suited for 80x20px canvases.
 */
export const prepareSparklinePoints = (
  samples: ReadonlyArray<ChartSample>,
  dimensions: CanvasDimensions,
  yMax: number,
): ReadonlyArray<FilledAreaPoint> => {
  if (samples.length === 0) return [];

  const { width, height, padding } = dimensions;
  const topY = padding;
  const bottomY = height - padding;
  const lastIndex = samples.length - 1;

  return samples.map((sample, index) => {
    const xRatio = lastIndex === 0 ? 0 : index / lastIndex;
    const x = xRatio * width;
    const y = mapValueToCanvasY(sample.value, yMax, topY, bottomY);
    return { x, y };
  });
};

// ---------------------------------------------------------------------------
// computeCrosshairPosition -- crosshair line X and dot Y for hovered sample
// ---------------------------------------------------------------------------

/**
 * Compute the crosshair vertical line X position and dot Y position
 * for a hovered sample in the chart.
 *
 * X is computed from the sample index within the drawable width.
 * dotY is computed from the sample value within the drawable height.
 */
export const computeCrosshairPosition = (
  sampleIndex: number,
  sampleValue: number,
  bufferLength: number,
  yMax: number,
  dimensions: CanvasDimensions,
): CrosshairPosition => {
  const { width, height, padding } = dimensions;
  const drawableWidth = width - 2 * padding;
  const topY = padding;
  const bottomY = height - padding;

  const lastIndex = bufferLength <= 1 ? 1 : bufferLength - 1;
  const xRatio = sampleIndex / lastIndex;
  const x = padding + xRatio * drawableWidth;
  const dotY = mapValueToCanvasY(sampleValue, yMax, topY, bottomY);

  return { x, dotY };
};
