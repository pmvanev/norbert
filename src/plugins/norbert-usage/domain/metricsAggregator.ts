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
export const createInitialMetrics = (sessionId: string, sessionLabel = ""): SessionMetrics => ({
  sessionId,
  sessionLabel,
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  sessionCost: 0,
  toolCallCount: 0,
  activeAgentCount: 0,
  contextWindowPct: 0,
  contextWindowTokens: 0,
  contextWindowMaxTokens: 0,
  contextWindowModel: "",
  totalEventCount: 0,
  apiErrorCount: 0,
  apiRequestCount: 0,
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

/** Extract cost_usd from payload.usage if present as a number (including 0.0). */
const extractCostUsd = (payload: unknown): number | undefined => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  const usageField = record["usage"];
  if (typeof usageField !== "object" || usageField === null || Array.isArray(usageField)) return undefined;
  const usage = usageField as Record<string, unknown>;
  const costUsd = usage["cost_usd"];
  return typeof costUsd === "number" ? costUsd : undefined;
};

/** Apply token and cost updates for api_request events (OTel).
 *  Uses cost_usd directly when present (including 0.0); otherwise falls back to pricing model. */
const applyApiRequestTokenUsage = (
  metrics: SessionMetrics,
  payload: unknown,
  pricingTable: PricingTable,
): SessionMetrics => {
  const extraction = extractTokenUsage(payload);
  if (extraction.tag === "absent") return metrics;

  const { usage } = extraction;
  const costUsd = extractCostUsd(payload);
  const cost = costUsd !== undefined ? costUsd : calculateCost(usage, pricingTable).totalCost;

  return {
    ...metrics,
    totalTokens: metrics.totalTokens + usage.inputTokens + usage.outputTokens,
    inputTokens: metrics.inputTokens + usage.inputTokens,
    outputTokens: metrics.outputTokens + usage.outputTokens,
    sessionCost: Math.max(0, metrics.sessionCost + cost),
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

/** Set sessionStartedAt if currently empty. Does not touch activeAgentCount. */
const applySessionStartedAtIfEmpty = (
  metrics: SessionMetrics,
  receivedAt: string,
): SessionMetrics =>
  metrics.sessionStartedAt === ""
    ? { ...metrics, sessionStartedAt: receivedAt }
    : metrics;

/** Increment apiErrorCount. */
const applyApiErrorCount = (metrics: SessionMetrics): SessionMetrics => ({
  ...metrics,
  apiErrorCount: metrics.apiErrorCount + 1,
});

/** Increment apiRequestCount. */
const applyApiRequestCount = (metrics: SessionMetrics): SessionMetrics => ({
  ...metrics,
  apiRequestCount: metrics.apiRequestCount + 1,
});

/** Apply common bookkeeping: increment totalEventCount, update lastEventAt. */
const applyCommonFields = (
  metrics: SessionMetrics,
  receivedAt: string,
): SessionMetrics => ({
  ...metrics,
  totalEventCount: metrics.totalEventCount + 1,
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
 * - All events: increment totalEventCount, update lastEventAt
 */
// ---------------------------------------------------------------------------
// Dispatch tables: hook-only vs OTel-active sessions
// ---------------------------------------------------------------------------

type EventHandler = (metrics: SessionMetrics, event: AggregatorEvent, pricingTable: PricingTable) => SessionMetrics;

/** Identity handler for unknown event types: only common fields updated. */
const identityHandler: EventHandler = (metrics) => metrics;

/** Hook-only dispatch table: all hook events contribute tokens and cost. */
const hookEventHandlers: Record<string, EventHandler> = {
  prompt_submit: (metrics, event, pricingTable) =>
    applyTokenUsage(metrics, event.payload, pricingTable),

  tool_call_end: (metrics, event, pricingTable) =>
    applyTokenUsage(metrics, event.payload, pricingTable),

  tool_call_start: (metrics) =>
    applyToolCallStart(metrics),

  session_start: (metrics, event) =>
    applySessionStart(metrics, event.receivedAt),

  agent_complete: (metrics, event, pricingTable) =>
    applyAgentCompleteCount(applyTokenUsage(metrics, event.payload, pricingTable)),

  api_request: (metrics, event, pricingTable) =>
    applyApiRequestCount(applyApiRequestTokenUsage(metrics, event.payload, pricingTable)),

  user_prompt: identityHandler,
  tool_result: identityHandler,
  api_error: (metrics) => applyApiErrorCount(metrics),
  tool_decision: identityHandler,
};

/** OTel-active dispatch table: hook cost/token events suppressed.
 *  prompt_submit, tool_call_end, tool_call_start -> identity (no cost/token contribution).
 *  agent_complete -> count only (no token/cost).
 *  api_request -> full cost_usd + token processing (same as hook table). */
const otelEventHandlers: Record<string, EventHandler> = {
  prompt_submit: identityHandler,
  tool_call_end: identityHandler,
  tool_call_start: identityHandler,

  session_start: (metrics) => ({
    ...metrics,
    activeAgentCount: metrics.activeAgentCount + 1,
  }),

  agent_complete: (metrics) =>
    applyAgentCompleteCount(metrics),

  api_request: (metrics, event, pricingTable) =>
    applyApiRequestCount(
      applySessionStartedAtIfEmpty(
        applyApiRequestTokenUsage(metrics, event.payload, pricingTable),
        event.receivedAt,
      ),
    ),

  user_prompt: identityHandler,
  tool_result: (metrics) => applyToolCallStart(metrics),
  api_error: (metrics) => applyApiErrorCount(metrics),
  tool_decision: identityHandler,
};

export const aggregateEvent = (
  previous: SessionMetrics,
  event: AggregatorEvent,
  pricingTable: PricingTable,
  isOtelActive: boolean = false,
): SessionMetrics => {
  const handlers = isOtelActive ? otelEventHandlers : hookEventHandlers;
  const handler = handlers[event.eventType] ?? identityHandler;
  const updated = handler(previous, event, pricingTable);
  return applyCommonFields(updated, event.receivedAt);
};
