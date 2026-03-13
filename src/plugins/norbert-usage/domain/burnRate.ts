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
 * Detect whether a timestamp is in milliseconds (> 1e12) or seconds.
 * Unix epoch in seconds is ~1.7e9 (2024); in milliseconds ~1.7e12.
 */
const isMillisecondTimestamp = (timestamp: number): boolean =>
  timestamp > 1e12;

/**
 * Calculate token burn rate (tokens/second) from events within a rolling window.
 *
 * Filters events to those whose timestamp falls within [now - window, now],
 * sums their tokens, and divides by windowSeconds.
 *
 * Automatically detects whether `now` is in seconds or milliseconds and
 * converts the window accordingly for the filter comparison.
 *
 * Returns 0 when events is empty or no events fall within the window.
 *
 * @param events - Array of timestamped token counts
 * @param windowSeconds - Rolling window size in seconds
 * @param now - Current time (seconds or milliseconds; auto-detected)
 */
export const calculateBurnRate = (
  events: ReadonlyArray<TimestampedTokens>,
  windowSeconds: number,
  now: number = Math.floor(Date.now() / 1000),
): number => {
  if (events.length === 0 || windowSeconds <= 0) return 0;

  const windowInTimestampUnits = isMillisecondTimestamp(now)
    ? windowSeconds * 1000
    : windowSeconds;
  const windowStart = now - windowInTimestampUnits;

  const tokensInWindow = events
    .filter((event) => event.timestamp >= windowStart)
    .reduce((sum, event) => sum + event.tokens, 0);

  return tokensInWindow / windowSeconds;
};
