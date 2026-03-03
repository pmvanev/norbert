/**
 * Cost calculator -- pure function: tokens + model -> cost estimate.
 *
 * Uses the COST_RATES table to compute estimated cost from token counts.
 * Falls back to the default rate for unknown models.
 *
 * This module has zero side effects and zero dependencies beyond this package.
 */

import { getCostRate } from './cost.js';

/**
 * Estimate the cost in USD for a given number of tokens and model.
 *
 * Pure function: same inputs always produce the same output.
 *
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @param model - Model identifier (e.g., 'claude-sonnet-4')
 * @returns Estimated cost in USD
 */
export const estimateCost = (
  inputTokens: number,
  outputTokens: number,
  model: string
): number => {
  const rate = getCostRate(model);
  const inputCost = (inputTokens / 1_000_000) * rate.inputRate;
  const outputCost = (outputTokens / 1_000_000) * rate.outputRate;
  return inputCost + outputCost;
};
