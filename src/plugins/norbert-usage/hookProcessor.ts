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

// ---------------------------------------------------------------------------
// Dependencies — injected at construction
// ---------------------------------------------------------------------------

export interface HookProcessorDeps {
  readonly updateMetrics: (reducer: (prev: SessionMetrics) => SessionMetrics) => void;
  readonly updateMultiSessionMetrics?: (sessionId: string, label: string, reducer: (prev: SessionMetrics) => SessionMetrics) => void;
  readonly appendSessionSample?: (sessionId: string, samples: CategorySampleInput) => void;
  readonly pricingTable: PricingTable;
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
// Category sample derivation — pure helper
// ---------------------------------------------------------------------------

/** Derive per-category sample values from previous and updated session metrics. */
const deriveCategorySamples = (
  previous: SessionMetrics,
  updated: SessionMetrics,
): CategorySampleInput => {
  const now = Date.now();
  const previousSnapshot = {
    totalTokens: previous.totalTokens,
    sessionCost: previous.sessionCost,
    timestamp: now - 1, // ensure non-zero delta
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
    context: updated.contextWindowPct,
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
  const { updateMetrics, updateMultiSessionMetrics, appendSessionSample, pricingTable } = deps;

  return (payload: unknown): void => {
    const eventType = extractEventType(payload);
    const event = buildAggregatorEvent(eventType, payload);

    updateMetrics((previous: SessionMetrics): SessionMetrics =>
      aggregateEvent(previous, event, pricingTable),
    );

    // Also feed multi-session store if available
    if (updateMultiSessionMetrics) {
      const sessionId = extractSessionId(payload);
      if (sessionId) {
        const label = extractSessionLabel(payload);
        // Capture previous and updated metrics for category sample derivation
        let previousMetrics: SessionMetrics | undefined;
        let updatedMetrics: SessionMetrics | undefined;

        updateMultiSessionMetrics(sessionId, label, (previous: SessionMetrics): SessionMetrics => {
          previousMetrics = previous;
          const next = aggregateEvent(previous, event, pricingTable);
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

