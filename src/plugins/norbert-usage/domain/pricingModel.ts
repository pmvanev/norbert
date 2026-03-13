/// Pricing model: pure function to compute dollar cost from token usage.
///
/// (usage: TokenUsage, table: PricingTable) => CostResult
///
/// No side effects, no IO imports. All rates are per 1,000 tokens.
/// Unknown models fall back to the most expensive (Opus) rates as safety margin.

import type {
  TokenUsage,
  ModelPricing,
  PricingTable,
  CostResult,
} from "./types";

// ---------------------------------------------------------------------------
// Default pricing table (per 1K tokens, ordered by specificity)
// ---------------------------------------------------------------------------

export const DEFAULT_PRICING_TABLE: PricingTable = [
  {
    modelPattern: "claude-opus-4",
    inputRate: 0.015,
    outputRate: 0.075,
    cacheReadRate: 0.0015,
    cacheCreationRate: 0.01875,
  },
  {
    modelPattern: "claude-sonnet-4",
    inputRate: 0.003,
    outputRate: 0.015,
    cacheReadRate: 0.0003,
    cacheCreationRate: 0.00375,
  },
  {
    modelPattern: "claude-haiku",
    inputRate: 0.0008,
    outputRate: 0.004,
    cacheReadRate: 0.00008,
    cacheCreationRate: 0.001,
  },
  {
    modelPattern: "",
    inputRate: 0.015,
    outputRate: 0.075,
    cacheReadRate: 0.0015,
    cacheCreationRate: 0.01875,
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Find the first pricing entry whose modelPattern is a prefix of the model string. */
const findPricing = (
  model: string,
  table: PricingTable,
): ModelPricing =>
  table.find((entry) => model.startsWith(entry.modelPattern)) ??
  table[table.length - 1];

/** Compute cost for a single token category: (tokens / 1000) * rate */
const computeTokenCost = (tokenCount: number, ratePerThousand: number): number =>
  (tokenCount / 1000) * ratePerThousand;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the dollar cost for a token usage event.
 *
 * Looks up model-specific rates from the pricing table using prefix matching.
 * The first entry whose modelPattern is a prefix of usage.model wins.
 * A fallback entry with empty modelPattern catches all unrecognized models.
 *
 * Returns an itemized CostResult with input, output, cache, and total costs.
 */
export const calculateCost = (
  usage: TokenUsage,
  table: PricingTable,
): CostResult => {
  const pricing = findPricing(usage.model, table);

  const inputCost = computeTokenCost(usage.inputTokens, pricing.inputRate);
  const outputCost = computeTokenCost(usage.outputTokens, pricing.outputRate);
  const cacheReadCost = computeTokenCost(usage.cacheReadTokens, pricing.cacheReadRate);
  const cacheCreationCost = computeTokenCost(usage.cacheCreationTokens, pricing.cacheCreationRate);
  const cacheCost = cacheReadCost + cacheCreationCost;
  const totalCost = inputCost + outputCost + cacheCost;

  return {
    totalCost,
    inputCost,
    outputCost,
    cacheCost,
    model: usage.model,
  };
};
