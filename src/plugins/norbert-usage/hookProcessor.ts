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
import { aggregateEvent } from "./domain/metricsAggregator";

// ---------------------------------------------------------------------------
// Dependencies — injected at construction
// ---------------------------------------------------------------------------

export interface HookProcessorDeps {
  readonly updateMetrics: (reducer: (prev: SessionMetrics) => SessionMetrics) => void;
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

/** Build an AggregatorEvent from a raw payload and extracted event type. */
const buildAggregatorEvent = (
  eventType: string,
  payload: unknown,
): AggregatorEvent => ({
  eventType,
  payload,
  receivedAt: new Date().toISOString(),
});

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
  const { updateMetrics, pricingTable } = deps;

  return (payload: unknown): void => {
    const eventType = extractEventType(payload);
    const event = buildAggregatorEvent(eventType, payload);

    updateMetrics((previous: SessionMetrics): SessionMetrics =>
      aggregateEvent(previous, event, pricingTable),
    );
  };
};

