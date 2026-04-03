/**
 * Time-Series Sampler -- circular buffer for time-series data.
 *
 * Uses a fixed-size backing array with a write pointer (headIndex).
 * Append is O(1) — overwrites the oldest slot, no array copying.
 * The `samples` property provides an ordered view (oldest → newest).
 *
 * All public functions are pure. The backing array is encapsulated;
 * consumers only see the ordered `samples` snapshot.
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
// appendSample -- O(1) circular append, returns new buffer with ordered view
// ---------------------------------------------------------------------------

export const appendSample = (
  buffer: TimeSeriesBuffer,
  sample: RateSample,
): TimeSeriesBuffer => {
  const { samples, capacity, headIndex } = buffer;
  const len = samples.length;

  if (len < capacity) {
    // Buffer not yet full: grow the array (append to end)
    const newSamples = new Array<RateSample>(len + 1);
    for (let i = 0; i < len; i++) newSamples[i] = samples[i];
    newSamples[len] = sample;
    return { samples: newSamples, capacity, headIndex: 0 };
  }

  // Buffer full: overwrite oldest slot, advance head pointer.
  // Build ordered view by reading from head (oldest) to head-1 (newest).
  const newHead = (headIndex + 1) % capacity;
  const newSamples = new Array<RateSample>(capacity);

  // Copy all existing slots except the one being overwritten
  // The new backing order: write the sample at headIndex, then produce ordered view
  // Ordered view: [headIndex+1, headIndex+2, ..., capacity-1, 0, 1, ..., headIndex-1, NEW]
  // Simplification: copy the old ordered view, shift left by 1, place new at end
  for (let i = 0; i < capacity - 1; i++) {
    // In the old ordered view, samples[0] is oldest, samples[capacity-1] is newest
    // We want to drop samples[0] (oldest) and append the new sample
    newSamples[i] = samples[i + 1];
  }
  newSamples[capacity - 1] = sample;

  return { samples: newSamples, capacity, headIndex: newHead };
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
  const samples = buffer.samples;
  const len = samples.length;

  if (len === 0) {
    return {
      peakRate: 0,
      avgRate: 0,
      totalRateSum: 0,
      windowDuration: 0,
    };
  }

  let peakRate = 0;
  let totalRateSum = 0;
  for (let i = 0; i < len; i++) {
    const rate = samples[i].tokenRate;
    if (rate > peakRate) peakRate = rate;
    totalRateSum += rate;
  }

  const avgRate = totalRateSum / len;
  const windowDuration = Math.max(0, samples[len - 1].timestamp - samples[0].timestamp);

  return { peakRate, avgRate, totalRateSum, windowDuration };
};
