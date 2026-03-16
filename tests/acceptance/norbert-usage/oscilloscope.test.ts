/**
 * Acceptance tests: Token Burn Oscilloscope (US-005)
 *
 * Validates the time-series sampling domain: ring buffer operations,
 * rate computation, and oscilloscope stats derivation.
 *
 * Driving ports: pure domain functions (timeSeriesSampler, burnRate,
 * oscilloscope stats)
 * These tests exercise the data pipeline that feeds the canvas waveform,
 * not the canvas rendering itself.
 *
 * Traces to: US-005 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  createBuffer,
  appendSample,
  getSamples,
  computeStats,
  type TimeSeriesBuffer,
  type RateSample,
} from "../../../src/plugins/norbert-usage/domain/timeSeriesSampler";
import {
  calculateBurnRate,
} from "../../../src/plugins/norbert-usage/domain/burnRate";
import {
  computeInstantaneousRates,
  type MetricsSnapshot,
} from "../../../src/plugins/norbert-usage/domain/instantaneousRate";

// ---------------------------------------------------------------------------
// Helper: create a sample at a given time
// ---------------------------------------------------------------------------

const sample = (timestamp: number, tokenRate: number, costRate: number): RateSample => ({
  timestamp,
  tokenRate,
  costRate,
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Ring Buffer Operations
// ---------------------------------------------------------------------------

describe("Oscilloscope maintains 60-second rolling window", () => {
  it("ring buffer holds up to 600 samples and evicts oldest when full", () => {
    // Given a ring buffer with capacity 600 (60s at 10Hz)
    let buffer = createBuffer(600);

    // When 601 samples are appended
    for (let i = 0; i < 601; i++) {
      buffer = appendSample(buffer, sample(i * 100, i, i * 0.001));
    }

    // Then the buffer contains exactly 600 samples
    const samples = getSamples(buffer);
    expect(samples).toHaveLength(600);

    // And the oldest sample (index 0) was evicted
    expect(samples[0].timestamp).toBe(100); // sample at time 0 evicted
    expect(samples[samples.length - 1].timestamp).toBe(60000);
  });
});

describe("Oscilloscope stats show peak, average, and total", () => {
  it("computes summary statistics from time-series buffer", () => {
    // Given a buffer with known rate samples
    let buffer = createBuffer(600);
    const rates = [100, 200, 300, 400, 500]; // 5 samples
    for (let i = 0; i < rates.length; i++) {
      buffer = appendSample(buffer, sample(i * 1000, rates[i], rates[i] * 0.001));
    }

    // When stats are computed
    const stats = computeStats(buffer);

    // Then peak rate is 500 tok/s
    expect(stats.peakRate).toBe(500);
    // And average rate is 300 tok/s
    expect(stats.avgRate).toBe(300);
    // And total tokens reflects sum over the window
    expect(stats.totalRateSum).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// BOUNDARY SCENARIOS: Activity Patterns
// ---------------------------------------------------------------------------

describe("Flat baseline visible during idle period", () => {
  it("zero-rate samples produce flat waveform data", () => {
    // Given an active session where no events arrive for 15 seconds
    let buffer = createBuffer(600);

    // When zero-rate samples are inserted at render ticks (10Hz for 15s)
    for (let i = 0; i < 150; i++) {
      buffer = appendSample(buffer, sample(i * 100, 0, 0));
    }

    // Then all samples show zero rate
    const samples = getSamples(buffer);
    expect(samples.every((s) => s.tokenRate === 0)).toBe(true);

    // And stats reflect zero activity
    const stats = computeStats(buffer);
    expect(stats.peakRate).toBe(0);
    expect(stats.avgRate).toBe(0);
    expect(stats.totalRateSum).toBe(0);
  });
});

describe("Sharp spikes visible during rapid tool calls", () => {
  it("alternating high and zero rates produce spike pattern data", () => {
    // Given tool calls arriving every 200ms with token bursts
    let buffer = createBuffer(600);

    // When samples alternate between spike (500 tok/s) and zero
    for (let i = 0; i < 50; i++) {
      buffer = appendSample(buffer, sample(i * 200, i % 2 === 0 ? 500 : 0, 0));
    }

    // Then the buffer contains alternating high and zero rates
    const samples = getSamples(buffer);
    const highSamples = samples.filter((s) => s.tokenRate === 500);
    const zeroSamples = samples.filter((s) => s.tokenRate === 0);
    expect(highSamples.length).toBe(25);
    expect(zeroSamples.length).toBe(25);

    // And peak rate reflects the spikes
    const stats = computeStats(buffer);
    expect(stats.peakRate).toBe(500);
    // And average is 250 (half of peak, alternating)
    expect(stats.avgRate).toBe(250);
  });
});

describe("Sustained plateau visible during streaming response", () => {
  it("steady rate produces consistent level in buffer data", () => {
    // Given a steady 400 tok/s stream for 15 seconds
    let buffer = createBuffer(600);

    // When 150 samples at 400 tok/s are appended (10Hz * 15s)
    for (let i = 0; i < 150; i++) {
      buffer = appendSample(buffer, sample(i * 100, 400, 0.06));
    }

    // Then the waveform data shows a sustained plateau
    const samples = getSamples(buffer);
    expect(samples.every((s) => s.tokenRate === 400)).toBe(true);

    // And stats reflect the steady state
    const stats = computeStats(buffer);
    expect(stats.peakRate).toBe(400);
    expect(stats.avgRate).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Burn Rate Calculation
// ---------------------------------------------------------------------------

describe("Token burn rate computed from rolling time window", () => {
  it("calculates tokens per second from recent events within window", () => {
    // Given 3 events in the last second totaling 1,500 tokens
    const now = Date.now();
    const recentEvents = [
      { tokens: 500, timestamp: now - 800 },
      { tokens: 600, timestamp: now - 400 },
      { tokens: 400, timestamp: now - 100 },
    ];
    const windowSeconds = 1;

    // When burn rate is calculated
    const rate = calculateBurnRate(recentEvents, windowSeconds, now);

    // Then the rate is approximately 1,500 tokens per second
    expect(rate).toBeCloseTo(1500, 0);
  });

  it("returns zero rate when no events in window", () => {
    // Given no events in the rolling window
    const now = Date.now();
    const rate = calculateBurnRate([], 10, now);

    // Then the burn rate is zero
    expect(rate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Instantaneous Rate Computation
// ---------------------------------------------------------------------------

describe("Instantaneous rate reflects recent activity burst, not session-long average", () => {
  it("rate spikes during a burst then drops to zero when idle", () => {
    // Given a session that has been running for 60 seconds with 60k total tokens
    const baseSnapshot: MetricsSnapshot = {
      totalTokens: 60000,
      sessionCost: 1.0,
      timestamp: 60000,
    };

    // When a burst of 2000 tokens arrives in 1 second
    const burstSnapshot: MetricsSnapshot = {
      totalTokens: 62000,
      sessionCost: 1.03,
      timestamp: 61000,
    };

    const burstRates = computeInstantaneousRates(burstSnapshot, baseSnapshot);

    // Then the instantaneous rate is ~2000 tok/s (not ~1033 from cumulative average)
    expect(burstRates.tokenRate).toBeCloseTo(2000, 0);

    // When no new tokens arrive for the next second
    const idleSnapshot: MetricsSnapshot = {
      totalTokens: 62000,
      sessionCost: 1.03,
      timestamp: 62000,
    };

    const idleRates = computeInstantaneousRates(idleSnapshot, burstSnapshot);

    // Then the rate drops to zero
    expect(idleRates.tokenRate).toBe(0);
  });
});

describe("Idle gaps fill with zero-rate heartbeat samples", () => {
  it("buffer grows with zero-rate samples during idle period", () => {
    // Given a buffer with one real sample
    let buffer = createBuffer(600);
    buffer = appendSample(buffer, sample(1000, 200, 0.02));

    // When 5 heartbeat intervals pass with no new events
    for (let i = 1; i <= 5; i++) {
      buffer = appendSample(buffer, sample(1000 + i * 100, 0, 0));
    }

    // Then the buffer contains 6 samples (1 real + 5 heartbeats)
    const samples = getSamples(buffer);
    expect(samples).toHaveLength(6);

    // And the first is the real sample
    expect(samples[0].tokenRate).toBe(200);

    // And the rest are zero-rate heartbeats
    for (let i = 1; i < 6; i++) {
      expect(samples[i].tokenRate).toBe(0);
      expect(samples[i].costRate).toBe(0);
    }
  });
});
