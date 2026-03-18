/**
 * Multi-Window Sampler -- maintains ring buffers at multiple time resolutions.
 *
 * Provides 1m/5m/15m/session time windows, each with its own ring buffer
 * at appropriate sample intervals. All functions are pure -- no mutation, no IO.
 *
 * Reuses TimeSeriesBuffer and RateSample from timeSeriesSampler.
 * Downsampling is achieved by tracking last-appended timestamps per window
 * and only appending when the sample interval has elapsed.
 */

import type {
  TimeWindowConfig,
  TimeWindowId,
  TimeSeriesBuffer,
  RateSample,
  OscilloscopeStats,
} from "./types";

import {
  createBuffer,
  appendSample,
  getSamples,
  computeStats,
} from "./timeSeriesSampler";

export type { TimeWindowId } from "./types";

// ---------------------------------------------------------------------------
// TIME_WINDOW_PRESETS -- readonly const array of fixed-duration windows
// ---------------------------------------------------------------------------

export const TIME_WINDOW_PRESETS: ReadonlyArray<TimeWindowConfig> = [
  { durationMs: 60_000, label: "1m", sampleIntervalMs: 100, bufferCapacity: 600 },
  { durationMs: 300_000, label: "5m", sampleIntervalMs: 500, bufferCapacity: 600 },
  { durationMs: 900_000, label: "15m", sampleIntervalMs: 1_000, bufferCapacity: 900 },
] as const;

// ---------------------------------------------------------------------------
// MultiWindowBuffer -- holds a ring buffer per time window
// ---------------------------------------------------------------------------

interface WindowState {
  readonly buffer: TimeSeriesBuffer;
  readonly lastAppendedAt: number;
  readonly sampleIntervalMs: number;
}

export interface MultiWindowBuffer {
  readonly windows: Readonly<Record<string, WindowState>>;
}

// ---------------------------------------------------------------------------
// createMultiWindowBuffer -- initialises empty buffers for all preset windows
// ---------------------------------------------------------------------------

export const createMultiWindowBuffer = (): MultiWindowBuffer => {
  const windows: Record<string, WindowState> = {};
  for (const preset of TIME_WINDOW_PRESETS) {
    windows[preset.label] = {
      buffer: createBuffer(preset.bufferCapacity),
      lastAppendedAt: -Infinity,
      sampleIntervalMs: preset.sampleIntervalMs,
    };
  }
  return { windows };
};

// ---------------------------------------------------------------------------
// appendMultiWindowSample -- appends sample to each window that is due
// ---------------------------------------------------------------------------

const shouldAppendToWindow = (
  windowState: WindowState,
  sampleTimestamp: number,
): boolean =>
  sampleTimestamp - windowState.lastAppendedAt >= windowState.sampleIntervalMs;

const appendToWindow = (
  windowState: WindowState,
  rateSample: RateSample,
): WindowState =>
  shouldAppendToWindow(windowState, rateSample.timestamp)
    ? {
        buffer: appendSample(windowState.buffer, rateSample),
        lastAppendedAt: rateSample.timestamp,
        sampleIntervalMs: windowState.sampleIntervalMs,
      }
    : windowState;

export const appendMultiWindowSample = (
  multiBuffer: MultiWindowBuffer,
  rateSample: RateSample,
): MultiWindowBuffer => {
  const updatedWindows: Record<string, WindowState> = {};
  for (const [key, windowState] of Object.entries(multiBuffer.windows)) {
    updatedWindows[key] = appendToWindow(windowState, rateSample);
  }
  return { windows: updatedWindows };
};

// ---------------------------------------------------------------------------
// getActiveWindowSamples -- retrieves samples for a specific window
// ---------------------------------------------------------------------------

export const getActiveWindowSamples = (
  multiBuffer: MultiWindowBuffer,
  windowId: TimeWindowId,
): ReadonlyArray<RateSample> => {
  const windowState = multiBuffer.windows[windowId];
  if (!windowState) {
    return [];
  }
  return getSamples(windowState.buffer);
};

// ---------------------------------------------------------------------------
// computeMultiWindowStats -- computes stats for a specific window
// ---------------------------------------------------------------------------

export const computeMultiWindowStats = (
  multiBuffer: MultiWindowBuffer,
  windowId: TimeWindowId,
): OscilloscopeStats => {
  const windowState = multiBuffer.windows[windowId];
  if (!windowState) {
    return { peakRate: 0, avgRate: 0, totalRateSum: 0, windowDuration: 0 };
  }
  return computeStats(windowState.buffer);
};

// ---------------------------------------------------------------------------
// resolveSessionWindowConfig -- dynamic resolution for session-length window
// ---------------------------------------------------------------------------

const SESSION_TARGET_MIN_POINTS = 300;
const SESSION_TARGET_MAX_POINTS = 900;
const SESSION_TARGET_POINTS = 600;

export const resolveSessionWindowConfig = (
  sessionDurationMs: number,
): TimeWindowConfig => {
  // Compute ideal interval to hit target point count
  const idealInterval = Math.max(1, Math.floor(sessionDurationMs / SESSION_TARGET_POINTS));

  // Compute actual capacity based on the chosen interval
  const capacity = Math.min(
    SESSION_TARGET_MAX_POINTS,
    Math.max(
      SESSION_TARGET_MIN_POINTS,
      Math.ceil(sessionDurationMs / idealInterval),
    ),
  );

  const sampleIntervalMs = Math.max(1, Math.floor(sessionDurationMs / capacity));

  return {
    durationMs: sessionDurationMs,
    label: "session",
    sampleIntervalMs,
    bufferCapacity: capacity,
  };
};
