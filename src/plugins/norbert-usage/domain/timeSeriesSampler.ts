/**
 * Time-Series Sampler -- pure functions operating on immutable TimeSeriesBuffer.
 *
 * Ring buffer implementation for oscilloscope display:
 * - createBuffer: creates empty buffer with given capacity
 * - appendSample: returns new buffer with sample appended, evicts oldest if full
 * - getSamples: returns samples in insertion order
 * - computeStats: computes peak rate, average rate, total rate sum, window duration
 *
 * All functions are pure. No mutation, no IO.
 */

import type {
  TimeSeriesBuffer,
  RateSample,
  OscilloscopeStats,
} from "./types";

export type { TimeSeriesBuffer, RateSample } from "./types";

// ---------------------------------------------------------------------------
// createBuffer -- empty ring buffer with given capacity
// ---------------------------------------------------------------------------

export const createBuffer = (capacity: number): TimeSeriesBuffer => ({
  samples: [],
  capacity,
  headIndex: 0,
});

// ---------------------------------------------------------------------------
// appendSample -- immutable append with eviction when full
// ---------------------------------------------------------------------------

export const appendSample = (
  buffer: TimeSeriesBuffer,
  sample: RateSample,
): TimeSeriesBuffer => {
  const currentSamples = buffer.samples;
  const isFull = currentSamples.length >= buffer.capacity;

  const newSamples = isFull
    ? [...currentSamples.slice(1), sample]
    : [...currentSamples, sample];

  return {
    samples: newSamples,
    capacity: buffer.capacity,
    headIndex: 0,
  };
};

// ---------------------------------------------------------------------------
// getSamples -- returns samples in insertion order
// ---------------------------------------------------------------------------

export const getSamples = (
  buffer: TimeSeriesBuffer,
): ReadonlyArray<RateSample> => buffer.samples;

// ---------------------------------------------------------------------------
// computeStats -- aggregate statistics over the buffer window
// ---------------------------------------------------------------------------

export const computeStats = (
  buffer: TimeSeriesBuffer,
): OscilloscopeStats => {
  const samples = getSamples(buffer);

  if (samples.length === 0) {
    return {
      peakRate: 0,
      avgRate: 0,
      totalRateSum: 0,
      windowDuration: 0,
    };
  }

  const peakRate = samples.reduce(
    (max, s) => Math.max(max, s.tokenRate),
    0,
  );

  const totalRateSum = samples.reduce(
    (sum, s) => sum + s.tokenRate,
    0,
  );

  const avgRate = totalRateSum / samples.length;

  const firstTimestamp = samples[0].timestamp;
  const lastTimestamp = samples[samples.length - 1].timestamp;
  const windowDuration = Math.max(0, lastTimestamp - firstTimestamp);

  return {
    peakRate,
    avgRate,
    totalRateSum,
    windowDuration,
  };
};
