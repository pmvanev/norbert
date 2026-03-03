/**
 * Session domain types -- aggregated session summary and related types.
 *
 * A Session represents a complete Claude Code session from SessionStart to Stop,
 * with aggregated metrics (token counts, cost estimate, agent count).
 *
 * All types are readonly to enforce immutability.
 */

// ---------------------------------------------------------------------------
// Session Status
// ---------------------------------------------------------------------------

export type SessionStatus = 'active' | 'completed';

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface Session {
  readonly id: string;
  readonly startTime: string;
  readonly endTime: string | undefined;
  readonly model: string;
  readonly agentCount: number;
  readonly eventCount: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly estimatedCost: number;
  readonly mcpErrorCount: number;
  readonly status: SessionStatus;
}

// ---------------------------------------------------------------------------
// Session Filter (Query Parameters)
// ---------------------------------------------------------------------------

export type SortField = 'startTime' | 'estimatedCost' | 'eventCount' | 'agentCount';
export type SortOrder = 'asc' | 'desc';

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export interface NumberRange {
  readonly min: number;
  readonly max: number;
}

export interface SessionFilter {
  readonly dateRange: DateRange | undefined;
  readonly costRange: NumberRange | undefined;
  readonly agentCountRange: NumberRange | undefined;
  readonly sortBy: SortField;
  readonly sortOrder: SortOrder;
  readonly limit: number;
  readonly offset: number;
}

// ---------------------------------------------------------------------------
// Overview Summary (pre-computed aggregate for dashboard)
// ---------------------------------------------------------------------------

export interface OverviewSummary {
  readonly sessionCount: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly mcpServerCount: number;
}
