/// Hook processor for norbert-usage plugin.
///
/// Factory function: createHookProcessor(deps) => (payload: unknown) => void
///
/// Pipeline: payload -> extractEventType -> buildAggregatorEvent -> aggregateEvent -> updateStore
///
/// Dependencies are injected via function parameters (no DI container).
/// Imports only from plugin types and its own domain modules.

import type { HookProcessor } from "../types";
import type { SessionMetrics, PricingTable } from "./domain/types";
import type { AggregatorEvent } from "./domain/metricsAggregator";
import type { CategorySampleInput } from "./adapters/multiSessionStore";
import { aggregateEvent } from "./domain/metricsAggregator";
import { computeInstantaneousRates } from "./domain/instantaneousRate";
import {
  PULSE_STRENGTHS,
  type Pulse,
  type PulseKind,
} from "./domain/phosphor/phosphorMetricConfig";

// ---------------------------------------------------------------------------
// Dependencies — injected at construction
// ---------------------------------------------------------------------------

export interface HookProcessorDeps {
  readonly updateMetrics: (reducer: (prev: SessionMetrics) => SessionMetrics) => void;
  readonly updateMultiSessionMetrics?: (sessionId: string, label: string, reducer: (prev: SessionMetrics) => SessionMetrics) => void;
  readonly appendSessionSample?: (sessionId: string, samples: CategorySampleInput) => void;
  readonly pricingTable: PricingTable;
  readonly getIsOtelActive?: (sessionId: string) => boolean;
}

// ---------------------------------------------------------------------------
// Payload field extraction — pure helpers
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Extract event_type string from an unknown payload, defaulting to "unknown". */
const extractEventType = (payload: unknown): string => {
  if (!isRecord(payload)) return "unknown";
  const eventType = payload["event_type"];
  return typeof eventType === "string" ? eventType : "unknown";
};

/** Extract session_id from the raw event payload wrapper. */
const extractSessionId = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const sid = payload["session_id"];
  return typeof sid === "string" ? sid : null;
};

/** Extract the provider tag from an event wrapper.
 *  Known values: "hook", "otel", "transcript". Returns null when absent. */
const extractProvider = (payload: unknown): string | null => {
  if (!isRecord(payload)) return null;
  const provider = payload["provider"];
  return typeof provider === "string" ? provider : null;
};

/** Extract a human-readable project name from the event payload.
 *  Claude Code hook payloads include a `cwd` field with the working directory.
 *  Falls back to the last segment of `transcript_path` parent directories. */
const extractSessionLabel = (payload: unknown): string => {
  if (!isRecord(payload)) return "";
  // Try cwd first (top-level field on Claude Code hook payloads)
  const cwd = payload["cwd"];
  if (typeof cwd === "string" && cwd.length > 0) {
    const segments = cwd.replace(/\\/g, "/").split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  }
  // Try inner payload's cwd
  const inner = payload["payload"];
  if (isRecord(inner)) {
    const innerCwd = inner["cwd"];
    if (typeof innerCwd === "string" && innerCwd.length > 0) {
      const segments = innerCwd.replace(/\\/g, "/").split("/").filter(Boolean);
      return segments[segments.length - 1] ?? "";
    }
  }
  return "";
};

/** Extract the inner payload from a DB event wrapper.
 *
 * Events from get_session_events arrive as:
 *   { session_id, event_type, payload: { ...claude code fields... }, received_at, provider }
 *
 * The token extractor needs the inner payload (where usage lives),
 * not the outer wrapper.
 */
const extractInnerPayload = (wrapper: unknown): unknown => {
  if (!isRecord(wrapper)) return wrapper;
  const inner = wrapper["payload"];
  return inner !== undefined ? inner : wrapper;
};

/** Build an AggregatorEvent from a raw payload and extracted event type. */
const buildAggregatorEvent = (
  eventType: string,
  payload: unknown,
): AggregatorEvent => ({
  eventType,
  payload: extractInnerPayload(payload),
  receivedAt: new Date().toISOString(),
});

// ---------------------------------------------------------------------------
// emitPulse — pure helper that builds a Pulse from a kind and timestamp.
//
// The strength for each kind is looked up from the `PULSE_STRENGTHS` table
// in `domain/phosphor/phosphorMetricConfig` (the single source of truth).
// Keeping the lookup as pure data means this helper has no effects and is
// trivially composable at the hookProcessor effect boundary.
//
// Strength convention (see DESIGN §5 Q1): tool > subagent > lifecycle.
// ---------------------------------------------------------------------------

/**
 * Build a `Pulse` for a hook event of the given `kind` observed at time `t`.
 * Pure: derives `strength` from `PULSE_STRENGTHS[kind]`. Callers inject the
 * timestamp so this helper remains clock-free (effects at the boundary).
 */
export const emitPulse = (kind: PulseKind, t: number): Pulse => ({
  t,
  kind,
  strength: PULSE_STRENGTHS[kind],
});

// ---------------------------------------------------------------------------
// Category sample derivation — pure helper
// ---------------------------------------------------------------------------

/** Minimum assumed interval (ms) between events when no prior timestamp exists. */
const DEFAULT_EVENT_INTERVAL_MS = 1000;

/** Derive per-category sample values from previous and updated session metrics.
 *
 *  Uses the real elapsed time between events (from lastEventAt) to compute
 *  instantaneous rates. Falls back to 1 second when no prior timestamp exists. */
const deriveCategorySamples = (
  previous: SessionMetrics,
  updated: SessionMetrics,
): CategorySampleInput => {
  const now = Date.now();
  const previousTimestamp = previous.lastEventAt
    ? new Date(previous.lastEventAt).getTime()
    : 0;
  // Use real elapsed time; fall back to 1s for first event or invalid timestamps
  const elapsed = previousTimestamp > 0 ? now - previousTimestamp : DEFAULT_EVENT_INTERVAL_MS;
  const safeElapsed = Math.max(DEFAULT_EVENT_INTERVAL_MS, elapsed);

  const previousSnapshot = {
    totalTokens: previous.totalTokens,
    sessionCost: previous.sessionCost,
    timestamp: now - safeElapsed,
  };
  const currentSnapshot = {
    totalTokens: updated.totalTokens,
    sessionCost: updated.sessionCost,
    timestamp: now,
  };
  const { tokenRate, costRate } = computeInstantaneousRates(currentSnapshot, previousSnapshot);

  return {
    tokens: tokenRate,
    cost: costRate,
    agents: updated.activeAgentCount,
    latency: updated.lastApiLatencyMs,
  };
};

// ---------------------------------------------------------------------------
// Public API — factory with dependency injection
// ---------------------------------------------------------------------------

/**
 * Create a hook processor that dispatches session-event payloads through
 * the extraction, pricing, and aggregation pipeline.
 *
 * The processor composes pure domain functions (tokenExtractor, pricingModel,
 * metricsAggregator) with the effect boundary (metrics store update).
 *
 * Pipeline per invocation:
 * 1. extractEventType(payload) -> eventType string
 * 2. buildAggregatorEvent(eventType, payload) -> AggregatorEvent
 * 3. aggregateEvent(prev, event, pricingTable) -> next SessionMetrics
 * 4. updateMetrics(reducer) -> effect (store update)
 */
export const createHookProcessor = (deps: HookProcessorDeps): HookProcessor => {
  const { updateMetrics, updateMultiSessionMetrics, appendSessionSample, pricingTable, getIsOtelActive } = deps;

  // Per-session OTel-active tracking. A session is flipped to OTel mode
  // on the first event tagged with provider="otel" and remains in that
  // mode for the rest of its lifetime. Subsequent hook-provider events
  // for that session are routed through the OTel dispatch table, which
  // suppresses hook-side cost/token accumulation and avoids double-
  // counting against OTel api_request events.
  const otelActiveSessions = new Set<string>();

  return (payload: unknown): void => {
    const eventType = extractEventType(payload);
    const event = buildAggregatorEvent(eventType, payload);
    const sessionId = extractSessionId(payload);
    const provider = extractProvider(payload);

    // Flip the switch BEFORE dispatch so the triggering OTel event is
    // itself processed through the OTel handlers.
    if (sessionId && provider === "otel") {
      otelActiveSessions.add(sessionId);
    }

    const isOtelActive = sessionId
      ? otelActiveSessions.has(sessionId) || (getIsOtelActive?.(sessionId) ?? false)
      : false;

    updateMetrics((previous: SessionMetrics): SessionMetrics =>
      aggregateEvent(previous, event, pricingTable, isOtelActive),
    );

    // Also feed multi-session store if available
    if (updateMultiSessionMetrics) {
      if (sessionId) {
        const label = extractSessionLabel(payload);
        // Capture previous and updated metrics for category sample derivation
        let previousMetrics: SessionMetrics | undefined;
        let updatedMetrics: SessionMetrics | undefined;

        updateMultiSessionMetrics(sessionId, label, (previous: SessionMetrics): SessionMetrics => {
          previousMetrics = previous;
          const next = aggregateEvent(previous, event, pricingTable, isOtelActive);
          updatedMetrics = next;
          return next;
        });

        // Append per-category samples after metrics update
        if (appendSessionSample && previousMetrics && updatedMetrics) {
          const samples = deriveCategorySamples(previousMetrics, updatedMetrics);
          appendSessionSample(sessionId, samples);
        }
      }
    }
  };
};

