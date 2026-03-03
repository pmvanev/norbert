/**
 * Cost domain types -- per-agent cost attribution and rate table.
 *
 * Provides cost breakdown by agent, cost by MCP server,
 * session comparison, and the cost rate table for known models.
 *
 * All types are readonly to enforce immutability.
 */

// ---------------------------------------------------------------------------
// Cost Rate
// ---------------------------------------------------------------------------

export interface CostRate {
  readonly inputRate: number;  // per 1M tokens
  readonly outputRate: number; // per 1M tokens
}

/**
 * Known model cost rates (per 1M tokens).
 * Based on published Anthropic pricing.
 */
export const COST_RATES: Readonly<Record<string, CostRate>> = {
  'claude-opus-4': { inputRate: 15.0, outputRate: 75.0 },
  'claude-sonnet-4': { inputRate: 3.0, outputRate: 15.0 },
  'claude-haiku-3.5': { inputRate: 0.8, outputRate: 4.0 },
};

const DEFAULT_COST_RATE: CostRate = { inputRate: 3.0, outputRate: 15.0 };

/**
 * Get the cost rate for a model, falling back to the default rate for unknown models.
 */
export const getCostRate = (model: string): CostRate =>
  Object.hasOwn(COST_RATES, model) ? COST_RATES[model] : DEFAULT_COST_RATE;

// ---------------------------------------------------------------------------
// Cost Breakdown
// ---------------------------------------------------------------------------

export interface AgentCostEntry {
  readonly agentId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
}

export interface McpCostEntry {
  readonly serverName: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
}

export interface CostBreakdown {
  readonly sessionId: string;
  readonly agents: readonly AgentCostEntry[];
  readonly totalCost: number;
  readonly costByMcpServer: readonly McpCostEntry[];
}

// ---------------------------------------------------------------------------
// Session Comparison
// ---------------------------------------------------------------------------

export interface SessionDelta {
  readonly tokensDelta: number;
  readonly costDelta: number;
  readonly agentCountDelta: number;
  readonly errorCountDelta: number;
}

export interface ComparisonResult {
  readonly previousSessionId: string;
  readonly currentSessionId: string;
  readonly deltas: SessionDelta;
  readonly projectedMonthlySavings: number;
}
