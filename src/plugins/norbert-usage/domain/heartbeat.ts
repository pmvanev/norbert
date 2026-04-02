/**
 * Heartbeat sample creation -- pure function that produces the next
 * category sample for idle chart scrolling.
 *
 * Rate-based categories (tokens, cost) are set to zero because the
 * rate represents "how fast are tokens/dollars flowing right now" --
 * when no API call is in progress, the answer is zero.
 *
 * Point-in-time categories (agents, context) use current session state
 * because those values persist between events.
 *
 * No side effects, no IO.
 */

import type { SessionMetrics } from "./types";
import type { CategorySampleInput } from "../adapters/multiSessionStore";

/**
 * Create a heartbeat sample with zero rates and current session state.
 */
export const createHeartbeatSample = (
  session: SessionMetrics,
): CategorySampleInput => ({
  tokens: 0,
  cost: 0,
  agents: session.activeAgentCount,
  context: session.contextWindowPct,
});
