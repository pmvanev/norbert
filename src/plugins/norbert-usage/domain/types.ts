/// Domain algebraic types for the norbert-usage plugin.
///
/// Pure type definitions and const arrays -- no runtime side effects,
/// no IO imports. All interfaces are readonly (immutable data throughout).
///
/// Discriminated unions where domain requires it:
/// - TokenExtractionResult: 'found' | 'absent'
/// - Urgency (via const array): 'normal' | 'amber' | 'red'

// ---------------------------------------------------------------------------
// TokenUsage -- raw token counts extracted from a hook event payload
// ---------------------------------------------------------------------------

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
  readonly model: string;
}

// ---------------------------------------------------------------------------
// TokenExtractionResult -- discriminated union for extraction outcome
// ---------------------------------------------------------------------------

export type TokenExtractionResult =
  | { readonly tag: "found"; readonly usage: TokenUsage }
  | { readonly tag: "absent" };

// ---------------------------------------------------------------------------
// ModelPricing -- per-model rate card (dollars per 1k tokens)
// ---------------------------------------------------------------------------

export interface ModelPricing {
  readonly modelPattern: string;
  readonly inputRate: number;
  readonly outputRate: number;
  readonly cacheReadRate: number;
  readonly cacheCreationRate: number;
}

// ---------------------------------------------------------------------------
// PricingTable -- ordered list of model pricing entries
// ---------------------------------------------------------------------------

export type PricingTable = ReadonlyArray<ModelPricing>;

// ---------------------------------------------------------------------------
// CostResult -- itemized cost breakdown for a single token event
// ---------------------------------------------------------------------------

export interface CostResult {
  readonly totalCost: number;
  readonly inputCost: number;
  readonly outputCost: number;
  readonly cacheCost: number;
  readonly model: string;
}

// ---------------------------------------------------------------------------
// SessionMetrics -- running aggregates for an active session
// ---------------------------------------------------------------------------

export interface SessionMetrics {
  readonly sessionId: string;
  readonly totalTokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly sessionCost: number;
  readonly toolCallCount: number;
  readonly activeAgentCount: number;
  readonly contextWindowPct: number;
  readonly contextWindowModel: string;
  readonly hookEventCount: number;
  readonly sessionStartedAt: string;
  readonly lastEventAt: string;
  readonly burnRate: number;
}

// ---------------------------------------------------------------------------
// RateSample -- a single point in the token/cost rate time series
// ---------------------------------------------------------------------------

export interface RateSample {
  readonly timestamp: number;
  readonly tokenRate: number;
  readonly costRate: number;
}

// ---------------------------------------------------------------------------
// TimeSeriesBuffer -- circular buffer for oscilloscope display
// ---------------------------------------------------------------------------

export interface TimeSeriesBuffer {
  readonly samples: ReadonlyArray<RateSample>;
  readonly capacity: number;
  readonly headIndex: number;
}

// ---------------------------------------------------------------------------
// OscilloscopeStats -- aggregated statistics over the display window
// ---------------------------------------------------------------------------

export interface OscilloscopeStats {
  readonly peakRate: number;
  readonly avgRate: number;
  readonly totalTokens: number;
  readonly windowDuration: number;
}

// ---------------------------------------------------------------------------
// DailyCostEntry -- daily cost aggregation for the cost chart
// ---------------------------------------------------------------------------

export interface DailyCostEntry {
  readonly date: string;
  readonly totalCost: number;
  readonly sessionCount: number;
}

// ---------------------------------------------------------------------------
// Urgency -- metric card urgency levels
// ---------------------------------------------------------------------------

export const URGENCY_LEVELS = ["normal", "amber", "red"] as const;

export type Urgency = (typeof URGENCY_LEVELS)[number];

/// Validates whether a value is a recognized urgency level.
export const isValidUrgency = (value: unknown): value is Urgency =>
  typeof value === "string" &&
  URGENCY_LEVELS.includes(value as Urgency);

// ---------------------------------------------------------------------------
// MetricCardData -- data for a single metric card in the dashboard
// ---------------------------------------------------------------------------

export interface MetricCardData {
  readonly label: string;
  readonly value: string;
  readonly subtitle: string;
  readonly urgency: Urgency;
}
