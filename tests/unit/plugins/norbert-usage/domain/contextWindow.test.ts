/**
 * Unit tests: contextWindow domain module.
 *
 * Pure-function helpers that map a model identifier to its context window
 * limit and derive a context-fill sample from a single token usage record.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_CONTEXT_WINDOW_TABLE,
  deriveContextWindowSample,
  lookupContextWindowMax,
} from "../../../../../src/plugins/norbert-usage/domain/contextWindow";
import type { TokenUsage } from "../../../../../src/plugins/norbert-usage/domain/types";

const mkUsage = (
  inputTokens: number,
  outputTokens: number,
  model: string,
  cacheRead = 0,
  cacheCreate = 0,
): TokenUsage => ({
  inputTokens,
  outputTokens,
  cacheReadTokens: cacheRead,
  cacheCreationTokens: cacheCreate,
  model,
});

describe("lookupContextWindowMax", () => {
  it("returns 200k for a claude-sonnet-4 model", () => {
    expect(lookupContextWindowMax("claude-sonnet-4-20250514")).toBe(200_000);
  });

  it("returns 200k for a claude-opus-4 model", () => {
    expect(lookupContextWindowMax("claude-opus-4-20250514")).toBe(200_000);
  });

  it("returns 1M for a model explicitly tagged with the [1m] beta window", () => {
    expect(lookupContextWindowMax("claude-opus-4-6[1m]")).toBe(1_000_000);
    expect(lookupContextWindowMax("claude-sonnet-4-6[1m]")).toBe(1_000_000);
  });

  it("returns 200k for haiku", () => {
    expect(lookupContextWindowMax("claude-haiku-4-5")).toBe(200_000);
  });

  it("falls back to 200k for an unrecognized model id", () => {
    expect(lookupContextWindowMax("some-future-model-name")).toBe(200_000);
  });

  it("uses the provided table when one is passed", () => {
    const custom = [
      { modelPattern: "tiny", maxTokens: 4000 },
      { modelPattern: "", maxTokens: 8000 },
    ];
    expect(lookupContextWindowMax("tiny-v1", custom)).toBe(4000);
    expect(lookupContextWindowMax("large-v1", custom)).toBe(8000);
  });
});

describe("deriveContextWindowSample", () => {
  it("computes pct as (input + cache_read + cache_creation) / max * 100", () => {
    const sample = deriveContextWindowSample(
      mkUsage(50_000, 4000, "claude-sonnet-4-20250514", 30_000, 20_000),
    );
    // 50k + 30k + 20k = 100k of 200k = 50%
    expect(sample.currentTokens).toBe(100_000);
    expect(sample.maxTokens).toBe(200_000);
    expect(sample.pct).toBe(50);
    expect(sample.model).toBe("claude-sonnet-4-20250514");
  });

  it("excludes output_tokens from the context budget", () => {
    const sample = deriveContextWindowSample(
      mkUsage(10_000, 100_000, "claude-sonnet-4-20250514"),
    );
    // Only inputTokens counts — outputs are generated after context is consumed.
    expect(sample.currentTokens).toBe(10_000);
    expect(sample.pct).toBe(5);
  });

  it("returns 0% when usage is zero", () => {
    const sample = deriveContextWindowSample(mkUsage(0, 0, "claude-sonnet-4-20250514"));
    expect(sample.pct).toBe(0);
    expect(sample.currentTokens).toBe(0);
  });

  it("a request that exceeds the baseline 200k window is reframed against the 1M tier, not clamped", () => {
    // Historical note: an earlier version of this helper hard-clamped
    // pct to 100 whenever observed > maxTokens. That hid the fact that
    // the session was actually on the 1M context-1m beta header. The
    // helper now promotes the max tier to match the data so the gauge
    // shows the real fill percentage.
    const sample = deriveContextWindowSample(
      mkUsage(250_000, 0, "claude-sonnet-4-20250514"),
    );
    expect(sample.maxTokens).toBe(1_000_000);
    expect(sample.pct).toBe(25);
  });

  it("uses the default table when none is provided", () => {
    const sample = deriveContextWindowSample(mkUsage(1000, 0, "claude-opus-4-20250514"));
    expect(sample.maxTokens).toBe(200_000);
    expect(DEFAULT_CONTEXT_WINDOW_TABLE.length).toBeGreaterThan(0);
  });

  // Sonnet/Opus 4.x on the context-1m-2025-08-07 beta header reports the
  // same model id as the 200k variant. The observed token count is the
  // only reliable signal that the wider window is in use.
  it("promotes baseline to 1M tier when an observed request exceeds 200k", () => {
    const sample = deriveContextWindowSample(
      mkUsage(685_000, 0, "claude-sonnet-4-5-20250929"),
    );
    expect(sample.maxTokens).toBe(1_000_000);
    expect(sample.currentTokens).toBe(685_000);
    expect(sample.pct).toBeCloseTo(68.5, 1);
  });

  it("does not promote when the observed request fits inside 200k", () => {
    const sample = deriveContextWindowSample(
      mkUsage(150_000, 0, "claude-sonnet-4-5-20250929"),
    );
    expect(sample.maxTokens).toBe(200_000);
    expect(sample.pct).toBe(75);
  });

  it("rounds the max up to the next 100k for genuine outliers above 1M", () => {
    const sample = deriveContextWindowSample(
      mkUsage(1_350_000, 0, "claude-sonnet-4-5-20250929"),
    );
    expect(sample.maxTokens).toBe(1_400_000);
    expect(sample.pct).toBeCloseTo((1_350_000 / 1_400_000) * 100, 1);
  });
});
