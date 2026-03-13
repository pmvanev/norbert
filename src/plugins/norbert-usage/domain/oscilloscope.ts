/**
 * Oscilloscope Waveform Data Preparation -- pure functions for canvas rendering.
 *
 * Maps time-series buffer samples to canvas coordinates, computes grid line
 * positions, and formats rate overlays. No side effects, no IO imports.
 *
 * The React component (OscilloscopeView) consumes these prepared data
 * structures to draw on HTML Canvas.
 */

import type { RateSample, OscilloscopeStats } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A point on the canvas waveform. */
export interface WaveformPoint {
  readonly x: number;
  readonly y: number;
}

/** Canvas rendering dimensions. */
export interface CanvasDimensions {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}

/** A vertical grid line on the canvas. */
export interface GridLine {
  readonly x: number;
  readonly label: string;
}

/** Which rate field to extract from a RateSample. */
export type RateField = "tokenRate" | "costRate";

// ---------------------------------------------------------------------------
// prepareWaveformPoints -- map samples to canvas x,y coordinates
// ---------------------------------------------------------------------------

const extractRate = (sample: RateSample, field: RateField): number =>
  sample[field];

const findPeakRate = (
  samples: ReadonlyArray<RateSample>,
  field: RateField,
): number =>
  samples.reduce((max, sample) => Math.max(max, extractRate(sample, field)), 0);

const normalizeY = (
  value: number,
  peakValue: number,
  topY: number,
  bottomY: number,
): number => {
  if (peakValue === 0) return bottomY;
  const ratio = value / peakValue;
  return bottomY - ratio * (bottomY - topY);
};

/**
 * Map an array of RateSamples to canvas WaveformPoints.
 *
 * X coordinates are evenly distributed across the drawable width.
 * Y coordinates are normalized: peak value maps to top padding,
 * zero maps to bottom (height - padding). Canvas y-axis is inverted.
 */
export const prepareWaveformPoints = (
  samples: ReadonlyArray<RateSample>,
  dimensions: CanvasDimensions,
  field: RateField,
): ReadonlyArray<WaveformPoint> => {
  if (samples.length === 0) return [];

  const { width, height, padding } = dimensions;
  const drawableWidth = width - 2 * padding;
  const topY = padding;
  const bottomY = height - padding;
  const peakRate = findPeakRate(samples, field);
  const lastIndex = samples.length - 1;

  return samples.map((sample, index) => {
    const xRatio = lastIndex === 0 ? 0 : index / lastIndex;
    const x = padding + xRatio * drawableWidth;
    const y = normalizeY(extractRate(sample, field), peakRate, topY, bottomY);
    return { x, y };
  });
};

// ---------------------------------------------------------------------------
// computeGridLines -- vertical grid lines at regular time intervals
// ---------------------------------------------------------------------------

/**
 * Compute vertical grid line positions for a scrolling waveform.
 *
 * Grid lines are placed at regular time intervals across the window.
 * Labels show negative time offsets (e.g., "-50s", "-40s").
 * Lines at the exact edges (0 and windowDurationMs) are excluded.
 */
export const computeGridLines = (
  dimensions: CanvasDimensions,
  windowDurationMs: number,
  intervalMs: number,
): ReadonlyArray<GridLine> => {
  if (windowDurationMs <= 0 || intervalMs <= 0) return [];

  const { width, padding } = dimensions;
  const drawableWidth = width - 2 * padding;
  const lines: GridLine[] = [];

  for (let timeOffset = intervalMs; timeOffset < windowDurationMs; timeOffset += intervalMs) {
    const xRatio = timeOffset / windowDurationMs;
    const x = padding + xRatio * drawableWidth;
    const secondsFromEnd = Math.round((windowDurationMs - timeOffset) / 1000);
    lines.push({
      x,
      label: `-${secondsFromEnd}s`,
    });
  }

  return lines;
};

// ---------------------------------------------------------------------------
// formatRateOverlay -- format token rate for text overlay display
// ---------------------------------------------------------------------------

/**
 * Format a token rate for display as a text overlay.
 *
 * Rates >= 1000 use "k" suffix (e.g., "1.5k tok/s").
 * Rates < 1000 display as integers (e.g., "500 tok/s").
 */
export const formatRateOverlay = (rate: number): string => {
  if (rate >= 1000) {
    const kRate = rate / 1000;
    return `${kRate.toFixed(1)}k tok/s`;
  }
  return `${rate} tok/s`;
};

// ---------------------------------------------------------------------------
// Stats bar formatting -- pure functions for stats bar display
// ---------------------------------------------------------------------------

/** Display-ready strings for the stats bar. */
export interface StatsBarDisplay {
  readonly peakRate: string;
  readonly avgRate: string;
  readonly totalTokens: string;
  readonly windowDuration: string;
}

/**
 * Format a token count with comma thousand separators.
 *
 * Example: 87241 -> "87,241"
 */
export const formatTokenCount = (count: number): string =>
  Math.round(count).toLocaleString("en-US");

/**
 * Format a window duration from milliseconds to seconds display.
 *
 * Example: 60000 -> "60s"
 */
export const formatWindowDuration = (durationMs: number): string =>
  `${Math.round(durationMs / 1000)}s`;

/**
 * Compose OscilloscopeStats into display-ready strings for the stats bar.
 *
 * Peak and average rates use "tok/s" suffix (via formatRateOverlay).
 * Total tokens use comma formatting. Window uses seconds.
 */
export const formatStatsBar = (stats: OscilloscopeStats): StatsBarDisplay => ({
  peakRate: formatRateOverlay(stats.peakRate),
  avgRate: formatRateOverlay(stats.avgRate),
  totalTokens: formatTokenCount(stats.totalTokens),
  windowDuration: formatWindowDuration(stats.windowDuration),
});

// ---------------------------------------------------------------------------
// computeCanvasDimensions -- responsive canvas sizing from container
// ---------------------------------------------------------------------------

const DEFAULT_ASPECT_RATIO = 3; // width:height = 3:1
const DEFAULT_PADDING = 10;

/**
 * Compute canvas dimensions to fit within a container.
 *
 * Given a container's width and height, calculates the canvas size
 * that fills the available width while respecting the aspect ratio.
 * If the computed height exceeds the container height, the canvas
 * is constrained to the container height and width is adjusted.
 *
 * Returns a CanvasDimensions value suitable for all rendering functions.
 */
export const computeCanvasDimensions = (
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number = DEFAULT_ASPECT_RATIO,
): CanvasDimensions => {
  const targetHeight = containerWidth / aspectRatio;

  if (targetHeight <= containerHeight) {
    return {
      width: containerWidth,
      height: Math.round(targetHeight),
      padding: DEFAULT_PADDING,
    };
  }

  return {
    width: Math.round(containerHeight * aspectRatio),
    height: containerHeight,
    padding: DEFAULT_PADDING,
  };
};
