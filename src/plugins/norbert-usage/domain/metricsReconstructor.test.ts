import { describe, it, expect } from "vitest";
import { reconstructMetricsFromDb } from "./metricsReconstructor";
import { computeGaugeClusterData } from "./gaugeCluster";
import type { AccumulatedMetric } from "./activeTimeFormatter";

const metric = (
  metricName: string,
  attributeKey: string,
  value: number,
): AccumulatedMetric => ({ metricName, attributeKey, value });

describe("reconstructMetricsFromDb", () => {
  it("returns zeroed metrics for an empty array", () => {
    const result = reconstructMetricsFromDb("s1", []);
    expect(result.sessionId).toBe("s1");
    expect(result.totalTokens).toBe(0);
    expect(result.sessionCost).toBe(0);
  });

  it("sums input tokens across models", () => {
    const dbMetrics = [
      metric("token.usage", "model=claude-opus-4-6,type=input", 500),
      metric("token.usage", "model=claude-sonnet-4-6,type=input", 300),
    ];
    const result = reconstructMetricsFromDb("s1", dbMetrics);
    expect(result.inputTokens).toBe(800);
  });

  it("sums output tokens", () => {
    const dbMetrics = [
      metric("token.usage", "model=claude-opus-4-6,type=output", 200),
    ];
    const result = reconstructMetricsFromDb("s1", dbMetrics);
    expect(result.outputTokens).toBe(200);
  });

  it("sums cache read and creation tokens", () => {
    const dbMetrics = [
      metric("token.usage", "model=claude-opus-4-6,type=cache_read", 1000),
      metric("token.usage", "model=claude-opus-4-6,type=cache_creation", 400),
    ];
    const result = reconstructMetricsFromDb("s1", dbMetrics);
    expect(result.cacheReadTokens).toBe(1000);
    expect(result.cacheCreationTokens).toBe(400);
  });

  it("computes totalTokens as sum of all token types", () => {
    const dbMetrics = [
      metric("token.usage", "model=m,type=input", 100),
      metric("token.usage", "model=m,type=output", 50),
      metric("token.usage", "model=m,type=cache_read", 200),
      metric("token.usage", "model=m,type=cache_creation", 30),
    ];
    const result = reconstructMetricsFromDb("s1", dbMetrics);
    expect(result.totalTokens).toBe(380);
  });

  it("sums cost across models", () => {
    const dbMetrics = [
      metric("cost.usage", "model=claude-opus-4-6", 0.15),
      metric("cost.usage", "model=claude-sonnet-4-6", 0.03),
    ];
    const result = reconstructMetricsFromDb("s1", dbMetrics);
    expect(result.sessionCost).toBeCloseTo(0.18);
  });

  it("ignores unrelated metric names", () => {
    const dbMetrics = [
      metric("active_time.total", "phase=user", 120),
      metric("session.count", "", 1),
      metric("token.usage", "model=m,type=input", 500),
    ];
    const result = reconstructMetricsFromDb("s1", dbMetrics);
    expect(result.inputTokens).toBe(500);
    expect(result.totalTokens).toBe(500);
    expect(result.sessionCost).toBe(0);
  });

  it("preserves default values for non-reconstructable fields", () => {
    const dbMetrics = [
      metric("token.usage", "model=m,type=input", 100),
    ];
    const result = reconstructMetricsFromDb("s1", dbMetrics);
    expect(result.burnRate).toBe(0);
    expect(result.contextWindowPct).toBe(0);
    expect(result.activeAgentCount).toBe(0);
    expect(result.toolCallCount).toBe(0);
  });
});

describe("inactive session gauge pipeline", () => {
  it("reconstructed metrics produce non-zero gauge cost and token data", () => {
    const dbMetrics = [
      metric("token.usage", "model=m,type=input", 5000),
      metric("token.usage", "model=m,type=output", 1200),
      metric("token.usage", "model=m,type=cache_read", 800),
      metric("cost.usage", "model=m", 0.42),
    ];
    const reconstructed = reconstructMetricsFromDb("s1", dbMetrics);
    const gaugeData = computeGaugeClusterData(reconstructed);

    expect(gaugeData.odometer.value).toBeCloseTo(0.42);
    expect(gaugeData.odometer.formatted).toBe("$0.42");
    // Burn rate and context are real-time only, expected zero for inactive
    expect(gaugeData.tachometer.value).toBe(0);
    expect(gaugeData.fuelGauge.value).toBe(0);
  });

  it("produces zero gauges when no DB metrics exist", () => {
    const reconstructed = reconstructMetricsFromDb("s1", []);
    const gaugeData = computeGaugeClusterData(reconstructed);

    expect(gaugeData.odometer.value).toBe(0);
    expect(gaugeData.odometer.formatted).toBe("$0.00");
  });
});
