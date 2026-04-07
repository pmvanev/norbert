/// Metrics aggregator: pure fold over processed events.
///
/// (prev: SessionMetrics, event, pricingTable) => SessionMetrics
///
/// No side effects, no IO imports. All state transitions produce new
/// immutable SessionMetrics values.

import type { SessionMetrics, PricingTable, TokenUsage } from "./types";
import { extractTokenUsage } from "./tokenExtractor";
import { calculateCost } from "./pricingModel";
import { deriveContextWindowSample } from "./contextWindow";

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
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  sessionCost: 0,
  toolCallCount: 0,
  activeAgentCount: 0,
  contextWindowPct: 0,
  contextWindowTokens: 0,
  contextWindowMaxTokens: 0,
  contextWindowModel: "",
  lastApiLatencyMs: 0,
  totalEventCount: 0,
  apiErrorCount: 0,
  apiRequestCount: 0,
  apiErrorRate: 0,
  sessionStartedAt: "",
  lastEventAt: "",
  burnRate: 0,
});

// ---------------------------------------------------------------------------
// Per-event-type handlers (pure helpers)
// ---------------------------------------------------------------------------

/** Overlay the latest context-window snapshot on a metrics record.
 *
 *  Context window TOKENS are NOT cumulative: each request reports the
 *  full input side (prompt + cached prefix) that was sent to the model,
 *  so the snapshot is replaced with the most recent value.
 *
 *  Context window MAX, however, is sticky per session. Sonnet/Opus 4.x
 *  on the `context-1m-2025-08-07` beta header reports the same model id
 *  as the 200k variant; the only signal of the wider window is observing
 *  a request that exceeds 200k. Once promoted, the session stays on the
 *  larger tier so that a later, smaller request doesn't flap the gauge
 *  back to a stale baseline. */
const applyContextWindow = (
  metrics: SessionMetrics,
  usage: TokenUsage,
): SessionMetrics => {
  const sample = deriveContextWindowSample(usage);
  const stickyMax = Math.max(metrics.contextWindowMaxTokens, sample.maxTokens);
  const stickyPct = stickyMax === 0 ? 0 : Math.min(100, (sample.currentTokens / stickyMax) * 100);
  return {
    ...metrics,
    contextWindowPct: stickyPct,
    contextWindowTokens: sample.currentTokens,
    contextWindowMaxTokens: stickyMax,
    contextWindowModel: sample.model,
  };
};

/** Apply ONLY the context-window snapshot from a payload's usage record,
 *  without touching token counts or cost. Used by hook-path handlers so
 *  the fuel gauge can reflect the most recent request even though cost
 *  is credited exclusively by OTel api_request events. */
const applyContextWindowFromPayload = (
  metrics: SessionMetrics,
  payload: unknown,
): SessionMetrics => {
  const extraction = extractTokenUsage(payload);
  if (extraction.tag === "absent") return metrics;
  return applyContextWindow(metrics, extraction.usage);
};

/** Extract a numeric field from payload.usage if present. */
const extractUsageNumber = (payload: unknown, field: string): number | undefined => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  const usageField = record["usage"];
  if (typeof usageField !== "object" || usageField === null || Array.isArray(usageField)) return undefined;
  const usage = usageField as Record<string, unknown>;
  const value = usage[field];
  return typeof value === "number" && isFinite(value) && value >= 0 ? value : undefined;
};

/** Extract cost_usd from payload.usage if present as a number (including 0.0). */
const extractCostUsd = (payload: unknown): number | undefined => {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  const usageField = record["usage"];
  if (typeof usageField !== "object" || usageField === null || Array.isArray(usageField)) return undefined;
  const usage = usageField as Record<string, unknown>;
  const costUsd = usage["cost_usd"];
  return typeof costUsd === "number" && isFinite(costUsd) && costUsd >= 0 ? costUsd : undefined;
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
  const durationMs = extractUsageNumber(payload, "duration_ms");

  // totalTokens is the basis Anthropic bills against, so we sum every
  // category that contributed: uncached input, output, cache reads, and
  // cache creations. Without including cache tokens the displayed total
  // can be 50x smaller than what the cost was actually computed against
  // (Claude Code sessions with prompt caching enabled routinely log
  // tens of millions of cache_read tokens).
  const billedTokens =
    usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
  const withTokens: SessionMetrics = {
    ...metrics,
    totalTokens: metrics.totalTokens + billedTokens,
    inputTokens: metrics.inputTokens + usage.inputTokens,
    outputTokens: metrics.outputTokens + usage.outputTokens,
    cacheReadTokens: metrics.cacheReadTokens + usage.cacheReadTokens,
    cacheCreationTokens: metrics.cacheCreationTokens + usage.cacheCreationTokens,
    sessionCost: Math.max(0, metrics.sessionCost + cost),
    lastApiLatencyMs: durationMs ?? metrics.lastApiLatencyMs,
  };
  return applyContextWindow(withTokens, usage);
};

/** Increment tool call count. */
const applyToolCallStart = (metrics: SessionMetrics): SessionMetrics => ({
  ...metrics,
  toolCallCount: metrics.toolCallCount + 1,
});

/** Increment active agent count and track the earliest sessionStartedAt. */
const applySessionStart = (
  metrics: SessionMetrics,
  receivedAt: string,
): SessionMetrics => ({
  ...metrics,
  activeAgentCount: metrics.activeAgentCount + 1,
  sessionStartedAt: earliestTimestamp(metrics.sessionStartedAt, receivedAt),
});

/** Pick the earlier of two ISO timestamps. Empty string means "unset". */
const earliestTimestamp = (existing: string, candidate: string): string => {
  if (existing === "") return candidate;
  if (candidate === "") return existing;
  return new Date(candidate).getTime() < new Date(existing).getTime()
    ? candidate
    : existing;
};

/** Decrement active agent count, floored at 0. */
const applyAgentCompleteCount = (metrics: SessionMetrics): SessionMetrics => ({
  ...metrics,
  activeAgentCount: Math.max(0, metrics.activeAgentCount - 1),
});

/** Track the earliest sessionStartedAt seen so far. Does not touch
 *  activeAgentCount. Used by api_request handlers so OTel timing can
 *  win over a later-arriving session_start hook. */
const applyEarliestSessionStartedAt = (
  metrics: SessionMetrics,
  receivedAt: string,
): SessionMetrics => ({
  ...metrics,
  sessionStartedAt: earliestTimestamp(metrics.sessionStartedAt, receivedAt),
});

/** Compute error rate: errors / (errors + requests), convention 0/0 = 0. */
const computeErrorRate = (errors: number, requests: number): number =>
  (errors + requests) === 0 ? 0 : errors / (errors + requests);

/** Increment apiErrorCount and recompute apiErrorRate. */
const applyApiErrorCount = (metrics: SessionMetrics): SessionMetrics => {
  const newErrorCount = metrics.apiErrorCount + 1;
  return {
    ...metrics,
    apiErrorCount: newErrorCount,
    apiErrorRate: computeErrorRate(newErrorCount, metrics.apiRequestCount),
  };
};

/** Increment apiRequestCount and recompute apiErrorRate. */
const applyApiRequestCount = (metrics: SessionMetrics): SessionMetrics => {
  const newRequestCount = metrics.apiRequestCount + 1;
  return {
    ...metrics,
    apiRequestCount: newRequestCount,
    apiErrorRate: computeErrorRate(metrics.apiErrorCount, newRequestCount),
  };
};

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

/** Unified dispatch table.
 *
 *  Cost and token counts are credited EXCLUSIVELY by OTel `api_request`
 *  events (via applyApiRequestTokenUsage), which use the authoritative
 *  `cost_usd` field from Claude Code's OTel exporter and avoid the
 *  hook/OTel double-counting that would otherwise occur when hooks fire
 *  alongside OTel metrics for the same request.
 *
 *  Hook-path events (`prompt_submit`, `tool_call_end`, `agent_complete`)
 *  still carry a usage record and are used to refresh the context-window
 *  snapshot between `api_request` events, but they no longer contribute
 *  to `totalTokens`, `inputTokens`, `outputTokens`, or `sessionCost`. */
const eventHandlers: Record<string, EventHandler> = {
  prompt_submit: (metrics, event) =>
    applyContextWindowFromPayload(metrics, event.payload),

  tool_call_end: (metrics, event) =>
    applyContextWindowFromPayload(metrics, event.payload),

  // Hook PreToolUse. Under the OTel-authoritative policy, tool counts
  // are driven by tool_result (the OTel post-tool signal) so we don't
  // double-count when both streams are present.
  tool_call_start: identityHandler,

  session_start: (metrics, event) =>
    applySessionStart(metrics, event.receivedAt),

  agent_complete: (metrics, event) =>
    applyAgentCompleteCount(applyContextWindowFromPayload(metrics, event.payload)),

  api_request: (metrics, event, pricingTable) =>
    applyApiRequestCount(
      applyEarliestSessionStartedAt(
        applyApiRequestTokenUsage(metrics, event.payload, pricingTable),
        event.receivedAt,
      ),
    ),

  user_prompt: identityHandler,
  // OTel post-tool signal -- the single source for tool call counts.
  tool_result: (metrics) => applyToolCallStart(metrics),
  api_error: (metrics) => applyApiErrorCount(metrics),
  tool_decision: identityHandler,
};

export const aggregateEvent = (
  previous: SessionMetrics,
  event: AggregatorEvent,
  pricingTable: PricingTable,
  // isOtelActive is retained for backward compatibility with existing call
  // sites but is now unused: cost is always sourced from OTel api_request.
  _isOtelActive: boolean = false,
): SessionMetrics => {
  void _isOtelActive;
  const handler = eventHandlers[event.eventType] ?? identityHandler;
  const updated = handler(previous, event, pricingTable);
  return applyCommonFields(updated, event.receivedAt);
};
