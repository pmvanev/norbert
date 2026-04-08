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
  readonly sessionLabel: string;
  /** Sum of input + output + cache_read + cache_creation across all
   *  api_request events. Matches the basis Anthropic bills against, so
   *  totalTokens stays consistent with sessionCost. */
  readonly totalTokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
  readonly sessionCost: number;
  readonly toolCallCount: number;
  readonly activeAgentCount: number;
  readonly contextWindowPct: number;
  readonly contextWindowTokens: number;
  readonly contextWindowMaxTokens: number;
  readonly contextWindowModel: string;
  /** Duration of the most recent API request in milliseconds. 0 before first request. */
  readonly lastApiLatencyMs: number;
  readonly totalEventCount: number;
  readonly apiErrorCount: number;
  readonly apiRequestCount: number;
  /** Derived: apiErrorCount / (apiErrorCount + apiRequestCount). 0 when no API interactions.
   *  Always recomputed by applyApiErrorCount/applyApiRequestCount -- never set directly. */
  readonly apiErrorRate: number;
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
  readonly totalRateSum: number;
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

// ---------------------------------------------------------------------------
// SessionSummary -- per-session data for aggregate breakdown panel
// ---------------------------------------------------------------------------

export interface SessionSummary {
  readonly sessionId: string;
  readonly tokenRate: number;
  readonly costRate: number;
  readonly contextWindowPct: number;
  readonly activeAgentCount: number;
  readonly sessionCost: number;
}

// ---------------------------------------------------------------------------
// AggregateMetrics -- cross-session aggregate from all active sessions
// ---------------------------------------------------------------------------

export interface AggregateMetrics {
  readonly totalTokenRate: number;
  readonly totalCostRate: number;
  readonly totalActiveAgents: number;
  readonly sessionCount: number;
  readonly sessions: ReadonlyArray<SessionSummary>;
}

// ---------------------------------------------------------------------------
// TimeWindowConfig -- configuration for time window selection
// ---------------------------------------------------------------------------

export interface TimeWindowConfig {
  readonly durationMs: number;
  readonly label: string;
  readonly sampleIntervalMs: number;
  readonly bufferCapacity: number;
}

// ---------------------------------------------------------------------------
// TimeWindowId -- the only exposed time window. Kept as a type alias (rather
// than inlining `"1m"` everywhere) so bringing back multiple windows later is
// a one-line widening.
// ---------------------------------------------------------------------------

export type TimeWindowId = "1m";

// ---------------------------------------------------------------------------
// MetricCategoryId -- discriminated union for the four metric categories
// ---------------------------------------------------------------------------

export type MetricCategoryId = "tokens" | "cost" | "agents" | "latency";

// ---------------------------------------------------------------------------
// CategorySample -- per-category sample point for multi-category buffers
// ---------------------------------------------------------------------------

export interface CategorySample {
  readonly timestamp: number;
  readonly value: number;
}

// ---------------------------------------------------------------------------
// HoverState -- shared hover state for crosshair + tooltip rendering
// ---------------------------------------------------------------------------

export interface HoverState {
  readonly active: boolean;
  readonly canvasId: string;
  readonly mouseX: number;
  readonly sampleIndex: number;
  readonly value: number;
  readonly formattedValue: string;
  readonly timeOffset: string;
  readonly color: string;
  readonly tooltipX: number;
  readonly tooltipY: number;
}

// ---------------------------------------------------------------------------
// ChartMode -- discriminated union for chart rendering mode
// ---------------------------------------------------------------------------

export type ChartMode = "aggregate" | "mini";

// ---------------------------------------------------------------------------
// CompactionEstimate -- estimated time until context compaction
// ---------------------------------------------------------------------------

export interface CompactionEstimate {
  readonly estimatedMinutes: number;
  readonly confidence: "high" | "low";
  readonly currentPct: number;
  readonly remainingTokens: number;
}

