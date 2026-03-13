/// Cost Ticker: pure domain function mapping session cost and average to display data.
///
/// (sessionCost, sessionAverage) => CostTickerData
///
/// No side effects, no IO imports. Each sub-computation is a small
/// pure function composed into the final result.

// ---------------------------------------------------------------------------
// CostTickerData -- output type for the cost ticker status bar item
// ---------------------------------------------------------------------------

export type ColorZone = "dim" | "brand" | "amber" | "red";

export interface CostTickerData {
  readonly label: string;
  readonly colorZone: ColorZone;
}

// ---------------------------------------------------------------------------
// Formatting (small pure function)
// ---------------------------------------------------------------------------

const formatCost = (cost: number): string => `$${cost.toFixed(2)}`;

// ---------------------------------------------------------------------------
// Zone classification (small pure function)
// ---------------------------------------------------------------------------

const classifyZone = (sessionCost: number, sessionAverage: number): ColorZone => {
  if (sessionCost === 0 && sessionAverage === 0) return "dim";
  if (sessionAverage === 0) return "brand";
  if (sessionCost >= sessionAverage * 1.5) return "red";
  if (sessionCost >= sessionAverage) return "amber";
  return "brand";
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute cost ticker display data from session cost and historical average.
 *
 * Pure function: (sessionCost, sessionAverage) => CostTickerData.
 * No side effects. Zone classification derived from cost-to-average ratio.
 */
export const computeCostTickerData = (
  sessionCost: number,
  sessionAverage: number,
): CostTickerData => ({
  label: formatCost(sessionCost),
  colorZone: classifyZone(sessionCost, sessionAverage),
});
