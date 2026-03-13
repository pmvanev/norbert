/// Burn rate calculator: tokens per second within a rolling window.
///
/// (events: Array<{timestamp, tokens}>, windowSeconds, now?) => number
///
/// No side effects, no IO imports. Pure computation over timestamped data.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimestampedTokens {
  readonly timestamp: number;
  readonly tokens: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate token burn rate (tokens/second) from events within a rolling window.
 *
 * Filters events to those whose timestamp falls within [now - windowSeconds, now],
 * sums their tokens, and divides by windowSeconds.
 *
 * Returns 0 when events is empty or no events fall within the window.
 *
 * @param events - Array of timestamped token counts
 * @param windowSeconds - Rolling window size in seconds
 * @param now - Current time as Unix epoch seconds (defaults to Date.now()/1000)
 */
export const calculateBurnRate = (
  events: ReadonlyArray<TimestampedTokens>,
  windowSeconds: number,
  now: number = Math.floor(Date.now() / 1000),
): number => {
  if (events.length === 0 || windowSeconds <= 0) return 0;

  const windowStart = now - windowSeconds;

  const tokensInWindow = events
    .filter((event) => event.timestamp >= windowStart)
    .reduce((sum, event) => sum + event.tokens, 0);

  return tokensInWindow / windowSeconds;
};
