/// Instantaneous rate computation: pure function mapping metric snapshots to rates.
///
/// Computes token rate (tok/s) and cost rate ($/s) from the delta between
/// two consecutive metric snapshots rather than cumulative session averages.
///
/// No side effects, no IO imports.

// ---------------------------------------------------------------------------
// MetricsSnapshot -- minimal snapshot for rate computation
// ---------------------------------------------------------------------------

export interface MetricsSnapshot {
  readonly totalTokens: number;
  readonly sessionCost: number;
  readonly timestamp: number;
}

// ---------------------------------------------------------------------------
// InstantaneousRates -- computed output
// ---------------------------------------------------------------------------

export interface InstantaneousRates {
  readonly tokenRate: number;
  readonly costRate: number;
}

// ---------------------------------------------------------------------------
// Minimum delta time to prevent division by near-zero
// ---------------------------------------------------------------------------

const MIN_DELTA_MS = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute instantaneous token and cost rates from consecutive snapshots.
 *
 * Rate = (currentTotal - previousTotal) / deltaSeconds.
 * Both rates are floored at 0 to prevent negative values from
 * transient metric resets. Delta time is clamped to a minimum of 1ms
 * to prevent division by zero.
 */
export const computeInstantaneousRates = (
  current: MetricsSnapshot,
  previous: MetricsSnapshot,
): InstantaneousRates => {
  const deltaMs = Math.max(MIN_DELTA_MS, current.timestamp - previous.timestamp);
  const deltaSec = deltaMs / 1000;

  const deltaTokens = current.totalTokens - previous.totalTokens;
  const deltaCost = current.sessionCost - previous.sessionCost;

  return {
    tokenRate: Math.max(0, deltaTokens / deltaSec),
    costRate: Math.max(0, deltaCost / deltaSec),
  };
};
