/**
 * Heartbeat sample creation -- pure function that produces the next
 * category sample for idle chart scrolling.
 *
 * Rate-based categories (tokens, cost) carry forward the last-known
 * value from the session's buffer to avoid abrupt drops to zero.
 * Point-in-time categories (agents, context) use current session state.
 *
 * No side effects, no IO.
 */

import type { SessionMetrics, TimeSeriesBuffer } from "./types";
import type { CategorySampleInput } from "../adapters/multiSessionStore";

/**
 * Extract the latest value from a category buffer's tokenRate field.
 * Returns 0 when the buffer is empty or undefined.
 */
const latestBufferValue = (buffer: TimeSeriesBuffer | undefined): number => {
  if (!buffer || buffer.samples.length === 0) return 0;
  return buffer.samples[buffer.samples.length - 1].tokenRate;
};

/**
 * Create a heartbeat sample that carries forward rate-based metrics
 * and uses current session state for point-in-time metrics.
 */
export const createHeartbeatSample = (
  session: SessionMetrics,
  tokenBuffer: TimeSeriesBuffer | undefined,
  costBuffer: TimeSeriesBuffer | undefined,
): CategorySampleInput => ({
  tokens: latestBufferValue(tokenBuffer),
  cost: latestBufferValue(costBuffer),
  agents: session.activeAgentCount,
  context: session.contextWindowPct,
});
