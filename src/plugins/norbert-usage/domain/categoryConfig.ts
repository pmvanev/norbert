/// Category configuration for the Performance Monitor v2.
///
/// Pure data definitions -- const arrays and lookup functions.
/// No runtime side effects, no IO imports.

import type { MetricCategoryId } from "./types";

// Re-export for consumers that import from this module
export type { MetricCategoryId };

// ---------------------------------------------------------------------------
// StatCellConfig -- configuration for a single cell in the stats grid
// ---------------------------------------------------------------------------

export interface StatCellConfig {
  readonly label: string;
  readonly key: string;
  readonly format: (value: number | string) => string;
}

// ---------------------------------------------------------------------------
// MetricCategory -- configuration for a single metric category
// ---------------------------------------------------------------------------

export interface MetricCategory {
  readonly id: MetricCategoryId;
  readonly label: string;
  readonly color: string;
  readonly yMax: number;
  readonly yLabels: ReadonlyArray<string>;
  readonly aggregateApplicable: boolean;
  readonly aggregateStrategy: "sum" | "none";
  readonly formatValue: (value: number) => string;
  readonly statsConfig: ReadonlyArray<StatCellConfig>;
  readonly sessionColumns: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Pure formatting functions
// ---------------------------------------------------------------------------

/// Formats a token rate value with appropriate suffix.
/// Below 1000: "527 tok/s", at/above 1000: "1.2k tok/s"
const formatTokenRate = (value: number): string => {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k tok/s`;
  }
  return `${Math.round(value)} tok/s`;
};

/// Formats a cost rate ($/s) as dollars per minute.
/// Converts per-second rate to per-minute for display.
/// Very small values use extra precision to avoid showing $0.00/min.
const formatCostRate = (value: number): string => {
  const perMinute = value * 60;
  if (perMinute > 0 && perMinute < 0.01) {
    return `$${perMinute.toFixed(4)}/min`;
  }
  return `$${perMinute.toFixed(2)}/min`;
};

/// Formats an agent count as an integer string.
const formatAgentCount = (value: number): string => `${Math.round(value)}`;

/// Formats a context window percentage.
const formatContextPct = (value: number): string => `${Math.round(value)}%`;

/// Identity formatter for stat cell values.
const formatIdentity = (value: number | string): string => `${value}`;

// ---------------------------------------------------------------------------
// Stats grid configurations per category
// ---------------------------------------------------------------------------

const tokensStatsConfig: ReadonlyArray<StatCellConfig> = [
  { label: "Peak", key: "peak", format: formatIdentity },
  { label: "Sessions", key: "sessions", format: formatIdentity },
  { label: "Average", key: "avg", format: formatIdentity },
  { label: "Total Tokens", key: "totalTokens", format: formatIdentity },
  { label: "Cost Rate", key: "costRate", format: formatIdentity },
  { label: "Tool Calls", key: "toolCalls", format: formatIdentity },
];

const costStatsConfig: ReadonlyArray<StatCellConfig> = [
  { label: "Current", key: "current", format: formatIdentity },
  { label: "Sessions", key: "sessions", format: formatIdentity },
  { label: "Session Total", key: "sessionTotal", format: formatIdentity },
  { label: "Total Cost", key: "totalCost", format: formatIdentity },
  { label: "Avg Cost/Token", key: "avgCostPerToken", format: formatIdentity },
  { label: "Model", key: "model", format: formatIdentity },
];

const agentsStatsConfig: ReadonlyArray<StatCellConfig> = [
  { label: "Active", key: "active", format: formatIdentity },
  { label: "Sessions", key: "sessions", format: formatIdentity },
  { label: "Peak", key: "peak", format: formatIdentity },
  { label: "Total Spawned", key: "totalSpawned", format: formatIdentity },
  { label: "Agents/Session", key: "avgPerSession", format: formatIdentity },
  { label: "Tool Calls", key: "toolCalls", format: formatIdentity },
];

const contextStatsConfig: ReadonlyArray<StatCellConfig> = [
  { label: "Current", key: "current", format: formatIdentity },
  { label: "Remaining", key: "remaining", format: formatIdentity },
  { label: "Max Tokens", key: "maxTokens", format: formatIdentity },
  { label: "Model", key: "model", format: formatIdentity },
  { label: "Urgency", key: "urgency", format: formatIdentity },
  { label: "Compressions", key: "compressions", format: formatIdentity },
];

// ---------------------------------------------------------------------------
// METRIC_CATEGORIES -- const array of 4 category configurations
// ---------------------------------------------------------------------------

export const METRIC_CATEGORIES: ReadonlyArray<MetricCategory> = [
  {
    id: "tokens",
    label: "Tokens/s",
    color: "#00e5cc",
    yMax: 2000,
    yLabels: ["0", "500", "1000", "1500", "2000"],
    aggregateApplicable: true,
    aggregateStrategy: "sum",
    formatValue: formatTokenRate,
    statsConfig: tokensStatsConfig,
    sessionColumns: ["Session ID", "Tokens/s", "Agents", "Cost"],
  },
  {
    id: "cost",
    label: "Cost",
    color: "#f0920a",
    yMax: 0.1,
    yLabels: ["$0", "$0.025", "$0.05", "$0.075", "$0.10"],
    aggregateApplicable: true,
    aggregateStrategy: "sum",
    formatValue: formatCostRate,
    statsConfig: costStatsConfig,
    sessionColumns: ["Session ID", "$/min", "Session Total", "Model"],
  },
  {
    id: "agents",
    label: "Agents",
    color: "#4a9eff",
    yMax: 10,
    yLabels: ["0", "2", "4", "6", "8", "10"],
    aggregateApplicable: true,
    aggregateStrategy: "sum",
    formatValue: formatAgentCount,
    statsConfig: agentsStatsConfig,
    sessionColumns: ["Session ID", "Agents", "Tokens/s", "Status"],
  },
  {
    id: "context",
    label: "Context",
    color: "#7aa89e",
    yMax: 100,
    yLabels: ["0%", "25%", "50%", "75%", "100%"],
    aggregateApplicable: false,
    aggregateStrategy: "none",
    formatValue: formatContextPct,
    statsConfig: contextStatsConfig,
    sessionColumns: ["Session ID", "Context %", "Urgency", "Remaining"],
  },
];

// ---------------------------------------------------------------------------
// getCategoryById -- lookup a category by its ID
// ---------------------------------------------------------------------------

export const getCategoryById = (
  id: MetricCategoryId,
): MetricCategory | undefined =>
  METRIC_CATEGORIES.find((c) => c.id === id);
