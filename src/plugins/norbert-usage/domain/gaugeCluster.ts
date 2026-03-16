/// Gauge Cluster: pure domain function mapping SessionMetrics to dashboard data.
///
/// SessionMetrics => GaugeClusterData
///
/// No side effects, no IO imports. Each instrument computation is a small
/// pure function composed into the final result.

import type { SessionMetrics, Urgency } from "./types";

// ---------------------------------------------------------------------------
// GaugeClusterData -- output type for the gauge cluster view
// ---------------------------------------------------------------------------

export interface TachometerData {
  readonly value: number;
  readonly unit: "tok/s";
  readonly urgency: Urgency;
}

export interface FuelGaugeData {
  readonly value: number;
  readonly unit: "%";
  readonly urgency: Urgency;
  readonly tokenLabel: string;
}

export interface OdometerData {
  readonly value: number;
  readonly formatted: string;
}

export interface RpmCounterData {
  readonly value: number;
  readonly label: "agents";
}

export interface WarningClusterData {
  readonly hookHealth: "normal" | "degraded" | "error";
}

export interface GaugeClusterData {
  readonly tachometer: TachometerData;
  readonly fuelGauge: FuelGaugeData;
  readonly odometer: OdometerData;
  readonly rpmCounter: RpmCounterData;
  readonly warningCluster: WarningClusterData;
}

// ---------------------------------------------------------------------------
// Threshold configuration
// ---------------------------------------------------------------------------

interface ThresholdConfig {
  readonly fuelAmber: number;
  readonly fuelRed: number;
  readonly tachoAmber: number;
  readonly tachoRed: number;
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  fuelAmber: 70,
  fuelRed: 90,
  tachoAmber: 400,
  tachoRed: 500,
};

// ---------------------------------------------------------------------------
// Urgency classifiers (small pure functions)
// ---------------------------------------------------------------------------

const classifyFuelUrgency = (
  contextWindowPct: number,
  thresholds: ThresholdConfig,
): Urgency => {
  if (contextWindowPct >= thresholds.fuelRed) return "red";
  if (contextWindowPct >= thresholds.fuelAmber) return "amber";
  return "normal";
};

const classifyTachoUrgency = (
  burnRate: number,
  thresholds: ThresholdConfig,
): Urgency => {
  if (burnRate >= thresholds.tachoRed) return "red";
  if (burnRate >= thresholds.tachoAmber) return "amber";
  return "normal";
};

// ---------------------------------------------------------------------------
// Instrument builders (small pure functions)
// ---------------------------------------------------------------------------

const buildTachometer = (
  burnRate: number,
  thresholds: ThresholdConfig,
): TachometerData => ({
  value: burnRate,
  unit: "tok/s",
  urgency: classifyTachoUrgency(burnRate, thresholds),
});

/** Format context token usage as "Xk / Yk tokens", or "" when unknown. */
export const formatContextTokenLabel = (current: number, max: number): string => {
  if (max === 0) return "";
  const currentK = Math.round(current / 1000);
  const maxK = Math.round(max / 1000);
  return `${currentK}k / ${maxK}k tokens`;
};

const buildFuelGauge = (
  contextWindowPct: number,
  contextWindowTokens: number,
  contextWindowMaxTokens: number,
  thresholds: ThresholdConfig,
): FuelGaugeData => ({
  value: contextWindowPct,
  unit: "%",
  urgency: classifyFuelUrgency(contextWindowPct, thresholds),
  tokenLabel: formatContextTokenLabel(contextWindowTokens, contextWindowMaxTokens),
});

const buildOdometer = (sessionCost: number): OdometerData => ({
  value: sessionCost,
  formatted: `$${sessionCost.toFixed(2)}`,
});

const buildRpmCounter = (activeAgentCount: number): RpmCounterData => ({
  value: activeAgentCount,
  label: "agents",
});

/** Determine hook health from event count.
 *  "degraded" when no events received (hooks may not be configured),
 *  "normal" when events are flowing. */
const buildWarningCluster = (hookEventCount: number): WarningClusterData => ({
  hookHealth: hookEventCount === 0 ? "degraded" : "normal",
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute gauge cluster display data from session metrics.
 *
 * Pure function: SessionMetrics => GaugeClusterData.
 * No side effects. All instrument values derived from input metrics.
 */
export const computeGaugeClusterData = (
  metrics: SessionMetrics,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS,
): GaugeClusterData => ({
  tachometer: buildTachometer(metrics.burnRate, thresholds),
  fuelGauge: buildFuelGauge(metrics.contextWindowPct, metrics.contextWindowTokens, metrics.contextWindowMaxTokens, thresholds),
  odometer: buildOdometer(metrics.sessionCost),
  rpmCounter: buildRpmCounter(metrics.activeAgentCount),
  warningCluster: buildWarningCluster(metrics.hookEventCount),
});
