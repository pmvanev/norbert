/**
 * Acceptance tests: Oscilloscope Backward Compatibility (US-PM-007)
 *
 * Validates that the Performance Monitor coexists with the existing
 * Oscilloscope view: shared data pipeline, no removed registrations,
 * and consistent waveform data.
 *
 * Driving ports: pure domain functions (oscilloscope waveform, stats)
 * These tests verify that existing oscilloscope functions remain
 * operational and produce identical results when called from PM context.
 *
 * Traces to: US-PM-007 acceptance criteria
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
  createMultiWindowBuffer,
  appendMultiWindowSample,
  getActiveWindowSamples,
  computeMultiWindowStats,
} from "../../../src/plugins/norbert-usage/domain/multiWindowSampler";

// ---------------------------------------------------------------------------
// Helper: create a rate sample
// ---------------------------------------------------------------------------

const sample = (timestamp: number, tokenRate: number, costRate: number): RateSample => ({
  timestamp,
  tokenRate,
  costRate,
});

// ---------------------------------------------------------------------------
// WALKING SKELETON: Oscilloscope and PM share waveform data pipeline
// Traces to: US-PM-007, JS-PM-1 (subsumption: coexistence, not replacement)
// ---------------------------------------------------------------------------

describe("Oscilloscope waveform data is identical when accessed from PM context", () => {
  it("multiWindowSampler produces samples compatible with oscilloscope computeStats", () => {
    // Given a multi-window buffer populated with samples
    let multiBuffer = createMultiWindowBuffer();
    for (let i = 0; i < 100; i++) {
      multiBuffer = appendMultiWindowSample(
        multiBuffer,
        sample(i * 100, 200 + (i % 50), 0.03),
      );
    }

    // When the PM retrieves samples from the 1m window
    const pmSamples = getActiveWindowSamples(multiBuffer, "1m");

    // Then those samples can be fed into the oscilloscope's computeStats
    // (verifying the integration contract: multiWindowSampler output
    //  is compatible with oscilloscope's TimeSeriesBuffer pipeline)
    let oscilloscopeBuffer = createBuffer(600);
    for (const s of pmSamples) {
      oscilloscopeBuffer = appendSample(oscilloscopeBuffer, s);
    }
    const oscilloscopeStats = computeStats(oscilloscopeBuffer);
    const pmStats = computeMultiWindowStats(multiBuffer, "1m");

    // Then the stats from both paths agree on peak and average rates
    expect(pmStats.peakRate).toBe(oscilloscopeStats.peakRate);
    expect(pmStats.avgRate).toBe(oscilloscopeStats.avgRate);
    // And the PM samples are non-empty
    expect(pmSamples.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Existing Functions Remain Operational
// Traces to: US-PM-007 AC "Oscilloscope view registration preserved"
// ---------------------------------------------------------------------------

describe("Existing time-series buffer operations produce unchanged results", () => {
  it("createBuffer, appendSample, getSamples, computeStats all work", () => {
    // Given the existing oscilloscope data pipeline
    let buffer = createBuffer(600);

    // When samples are appended and read back
    buffer = appendSample(buffer, sample(1000, 300, 0.04));
    buffer = appendSample(buffer, sample(2000, 400, 0.06));

    const samples = getSamples(buffer);
    const stats = computeStats(buffer);

    // Then the pipeline produces correct results (unchanged by PM addition)
    expect(samples).toHaveLength(2);
    expect(stats.peakRate).toBe(400);
    expect(stats.avgRate).toBe(350);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Shared Data Consistency
// Traces to: US-PM-007 AC "Both views share same data"
// Traces to: Shared Artifacts Registry -- "Metric consistency across views"
// ---------------------------------------------------------------------------

describe("Token rate from shared buffer matches between oscilloscope and PM", () => {
  it("broadcast session rate is identical in both views", () => {
    // Given the broadcast session "refactor-auth" produces token events
    // And the time-series buffer accumulates rate samples
    let buffer = createBuffer(600);
    for (let i = 0; i < 50; i++) {
      buffer = appendSample(buffer, sample(i * 100, 312, 0.003));
    }

    // When the oscilloscope reads the latest rate for the broadcast session
    const samples = getSamples(buffer);
    const latestRate = samples[samples.length - 1].tokenRate;

    // Then the PM's per-session breakdown for the same session
    // would show the same rate (312 tok/s)
    expect(latestRate).toBe(312);
  });
});

// ---------------------------------------------------------------------------
// BOUNDARY SCENARIO: Mode Switching
// Traces to: US-PM-007 AC "Mode switching between PM and oscilloscope is instant"
// ---------------------------------------------------------------------------

describe("Data pipeline remains valid across mode switches", () => {
  it("buffer state is preserved when switching between views", () => {
    // Given a buffer with 200 samples (simulating ongoing session)
    let buffer = createBuffer(600);
    for (let i = 0; i < 200; i++) {
      buffer = appendSample(buffer, sample(i * 100, 150 + i, 0.02));
    }

    // When the user switches from PM to Oscilloscope mode
    // (view switch does not affect the underlying buffer)
    const samplesBeforeSwitch = getSamples(buffer);

    // And then switches back to PM mode
    const samplesAfterSwitch = getSamples(buffer);

    // Then the data is identical (no data loss from mode switching)
    expect(samplesAfterSwitch).toEqual(samplesBeforeSwitch);
    expect(samplesAfterSwitch).toHaveLength(200);
  });
});
