/// Metrics aggregator: pure fold over processed events.
///
/// (prev: SessionMetrics, event, pricingTable) => SessionMetrics
///
/// No side effects, no IO imports. All state transitions produce new
/// immutable SessionMetrics values.

import type { SessionMetrics, PricingTable } from "./types";
import { extractTokenUsage } from "./tokenExtractor";
import { calculateCost } from "./pricingModel";

// ---------------------------------------------------------------------------
// Event shape accepted by the aggregator
// ---------------------------------------------------------------------------

export type AggregatorEvent = {
  readonly eventType: string;
  readonly payload: unknown;
  readonly receivedAt: string;
};

// ---------------------------------------------------------------------------
// Initial metrics factory
// ---------------------------------------------------------------------------

/** Create zeroed SessionMetrics for a new session. */
export const createInitialMetrics = (sessionId: string): SessionMetrics => ({
  sessionId,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  sessionCost: 0,
  toolCallCount: 0,
  activeAgentCount: 0,
  contextWindowPct: 0,
  contextWindowModel: "",
  hookEventCount: 0,
  sessionStartedAt: "",
  lastEventAt: "",
  burnRate: 0,
});

// ---------------------------------------------------------------------------
// Per-event-type handlers (pure helpers)
// ---------------------------------------------------------------------------

/** Apply token and cost updates from a payload that may contain usage data. */
const applyTokenUsage = (
  metrics: SessionMetrics,
  payload: unknown,
  pricingTable: PricingTable,
): SessionMetrics => {
  const extraction = extractTokenUsage(payload);
  if (extraction.tag === "absent") return metrics;

  const { usage } = extraction;
  const cost = calculateCost(usage, pricingTable);

  return {
    ...metrics,
    totalTokens: metrics.totalTokens + usage.inputTokens + usage.outputTokens,
    inputTokens: metrics.inputTokens + usage.inputTokens,
    outputTokens: metrics.outputTokens + usage.outputTokens,
    sessionCost: Math.max(0, metrics.sessionCost + cost.totalCost),
  };
};

/** Increment tool call count. */
const applyToolCallStart = (metrics: SessionMetrics): SessionMetrics => ({
  ...metrics,
  toolCallCount: metrics.toolCallCount + 1,
});

/** Increment active agent count and set sessionStartedAt if first. */
const applySessionStart = (
  metrics: SessionMetrics,
  receivedAt: string,
): SessionMetrics => ({
  ...metrics,
  activeAgentCount: metrics.activeAgentCount + 1,
  sessionStartedAt: metrics.sessionStartedAt === "" ? receivedAt : metrics.sessionStartedAt,
});

/** Decrement active agent count, floored at 0. */
const applyAgentCompleteCount = (metrics: SessionMetrics): SessionMetrics => ({
  ...metrics,
  activeAgentCount: Math.max(0, metrics.activeAgentCount - 1),
});

/** Apply common bookkeeping: increment hookEventCount, update lastEventAt. */
const applyCommonFields = (
  metrics: SessionMetrics,
  receivedAt: string,
): SessionMetrics => ({
  ...metrics,
  hookEventCount: metrics.hookEventCount + 1,
  lastEventAt: receivedAt,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Aggregate a single event into session metrics.
 *
 * Pure fold function: (prev, event, pricingTable) => next.
 * Never mutates the previous metrics object.
 *
 * Event type dispatch:
 * - prompt_submit / tool_call_end: extract tokens, compute cost, accumulate
 * - agent_complete: extract tokens + compute cost if present, decrement agent count
 * - tool_call_start: increment tool call count only
 * - session_start: increment active agent count
 * - All events: increment hookEventCount, update lastEventAt
 */
export const aggregateEvent = (
  previous: SessionMetrics,
  event: AggregatorEvent,
  pricingTable: PricingTable,
): SessionMetrics => {
  let metrics = previous;

  switch (event.eventType) {
    case "prompt_submit":
    case "tool_call_end":
      metrics = applyTokenUsage(metrics, event.payload, pricingTable);
      break;

    case "tool_call_start":
      metrics = applyToolCallStart(metrics);
      break;

    case "session_start":
      metrics = applySessionStart(metrics, event.receivedAt);
      break;

    case "agent_complete":
      metrics = applyTokenUsage(metrics, event.payload, pricingTable);
      metrics = applyAgentCompleteCount(metrics);
      break;

    default:
      // Unknown event types: only common fields updated
      break;
  }

  return applyCommonFields(metrics, event.receivedAt);
};
