/// Multi-session store: mutable adapter tracking SessionMetrics for all
/// active sessions. Lives at the adapter boundary (effects at edges).
///
/// Port: MultiSessionStore (v1 — category-based)
///   addSession(id) -- register a new session with zeroed metrics
///   removeSession(id) -- remove a tracked session
///   updateSession(id, metrics) -- replace metrics for a session
///   getSessions() -- all tracked session metrics (immutable snapshot)
///   getSession(id) -- metrics for a specific session or undefined
///   appendSessionSample(id, samples) -- append per-category sample values
///   getSessionBuffer(id, categoryId) -- per-session buffer for a category
///   getAggregateBuffer(categoryId) -- aggregate buffer across sessions
///   getAggregateWindowBuffer(categoryId, windowId) -- aggregate buffer for a specific time window
///   getSessionWindowBuffer(sessionId, categoryId, windowId) -- session buffer for a specific time window
///   subscribe(callback) -- register state-change listener
///
/// Port: MultiSessionStoreV2Surface (v2 — phosphor rate samples + pulse log)
/// Additive to v1; see the "V2 (phosphor) additive surface" section below.
/// Milestone 10 of the PM v2 rollout deletes the v1 category pathway; until
/// then both surfaces coexist on the same factory return value.

import type {
  SessionMetrics,
  TimeSeriesBuffer,
  RateSample as CategoryRateSample,
  TimeWindowId,
} from "../domain/types";
import type { MetricCategoryId } from "../domain/categoryConfig";
import { createInitialMetrics } from "../domain/metricsAggregator";
import { createBuffer, appendSample } from "../domain/timeSeriesSampler";
import { METRIC_CATEGORIES } from "../domain/categoryConfig";
import {
  createMultiWindowBuffer,
  appendMultiWindowSample,
  type MultiWindowBuffer,
} from "../domain/multiWindowSampler";
import {
  METRIC_IDS,
  PULSE_RETENTION_MS,
  type MetricId,
  type Pulse,
  type RateSample as PhosphorRateSample,
} from "../domain/phosphor/phosphorMetricConfig";
import { prunePulses } from "../domain/phosphor/pulseTiming";

// ---------------------------------------------------------------------------
// Category sample input -- values for each of the 4 metric categories
// ---------------------------------------------------------------------------

export interface CategorySampleInput {
  readonly tokens: number;
  readonly cost: number;
  readonly agents: number;
  readonly latency: number;
}

// ---------------------------------------------------------------------------
// Port type
// ---------------------------------------------------------------------------

export interface MultiSessionStore {
  readonly addSession: (sessionId: string) => void;
  readonly removeSession: (sessionId: string) => void;
  readonly updateSession: (sessionId: string, metrics: SessionMetrics) => void;
  readonly getSessions: () => ReadonlyArray<SessionMetrics>;
  readonly getSession: (sessionId: string) => SessionMetrics | undefined;
  readonly appendSessionSample: (sessionId: string, samples: CategorySampleInput) => void;
  /** Execute a batch of operations, notifying subscribers only once at the end. */
  readonly batchUpdate: (fn: () => void) => void;
  readonly getSessionBuffer: (sessionId: string, categoryId: MetricCategoryId) => TimeSeriesBuffer | undefined;
  readonly getAggregateBuffer: (categoryId: MetricCategoryId) => TimeSeriesBuffer;
  readonly getAggregateWindowBuffer: (categoryId: MetricCategoryId, windowId: TimeWindowId) => TimeSeriesBuffer;
  readonly getSessionWindowBuffer: (sessionId: string, categoryId: MetricCategoryId, windowId: TimeWindowId) => TimeSeriesBuffer | undefined;
  readonly subscribe: (callback: () => void) => () => void;

  // -------------------------------------------------------------------------
  // V2 (phosphor) additive surface — see ADR-049 / v2-phosphor-architecture.md.
  //
  // These methods coexist with the v1 category pathway above until milestone
  // 10 deletes v1. Phosphor domain modules consume only this subset via the
  // structural `PhosphorStoreSurface` type in `domain/phosphor/scopeProjection`.
  // -------------------------------------------------------------------------

  /** Append a rate sample for (session, metric) at time `t` with value `v`. */
  readonly appendRateSample: (
    sessionId: string,
    metric: MetricId,
    t: number,
    v: number,
  ) => void;
  /** Append a pulse event on the named session's pulse log. */
  readonly appendPulse: (sessionId: string, pulse: Pulse) => void;
  /**
   * Return the session's rate-sample history for the requested metric in
   * insertion order (oldest → newest). Empty array when the session has no
   * samples or does not exist.
   */
  readonly getRateHistory: (
    sessionId: string,
    metric: MetricId,
  ) => ReadonlyArray<PhosphorRateSample>;
  /**
   * Return the session's pulse log in insertion order with retention
   * trim applied: pulses older than `PULSE_RETENTION_MS` relative to
   * the reference clock are absent. When `now` is supplied, it is the
   * reference clock; otherwise `Date.now()` is used so callers always
   * observe the "no pulses older than retention" invariant. Empty
   * array when the session has no pulses or does not exist.
   */
  readonly getPulses: (
    sessionId: string,
    now?: number,
  ) => ReadonlyArray<Pulse>;
  /**
   * Return the ordered list of registered session IDs. Registration order
   * is preserved so per-session color assignment is deterministic.
   */
  readonly getSessionIds: () => ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BUFFER_CAPACITY = 60;

const CATEGORY_IDS: ReadonlyArray<MetricCategoryId> = ["tokens", "cost", "agents", "latency"];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/// Extract the value for a given category from the sample input.
const extractCategoryValue = (
  samples: CategorySampleInput,
  categoryId: MetricCategoryId,
): number => samples[categoryId];

/// Create a RateSample from a category value and timestamp.
///
/// Convention: all category values (tokens, cost, agents, context) are stored
/// in the `tokenRate` field of the RateSample. The `costRate` field is set to 0.
/// This reuses the existing RateSample type as a generic "category sample" --
/// the field name is a misnomer for non-token categories but avoids introducing
/// a separate CategorySample type. Consumers should read `tokenRate` to get the
/// category value regardless of which category the buffer represents.
/// TODO: introduce a dedicated CategorySample type to eliminate semantic mismatch.
const createCategorySample = (value: number, timestamp: number): CategoryRateSample => ({
  timestamp,
  tokenRate: value,
  costRate: 0,
});

/// Determine if a category supports aggregation across sessions.
const isCategoryAggregatable = (categoryId: MetricCategoryId): boolean => {
  const category = METRIC_CATEGORIES.find((c) => c.id === categoryId);
  return category?.aggregateApplicable ?? false;
};

/// Create an empty set of buffers for all 4 categories.
const createCategoryBuffers = (): Map<MetricCategoryId, TimeSeriesBuffer> => {
  const buffers = new Map<MetricCategoryId, TimeSeriesBuffer>();
  for (const id of CATEGORY_IDS) {
    buffers.set(id, createBuffer(DEFAULT_BUFFER_CAPACITY));
  }
  return buffers;
};

/// Create an empty set of multi-window buffers for all 4 categories.
const createCategoryMultiWindowBuffers = (): Map<MetricCategoryId, MultiWindowBuffer> => {
  const buffers = new Map<MetricCategoryId, MultiWindowBuffer>();
  for (const id of CATEGORY_IDS) {
    buffers.set(id, createMultiWindowBuffer());
  }
  return buffers;
};

/// Extract the TimeSeriesBuffer for a specific window from a MultiWindowBuffer.
const extractWindowBuffer = (
  multiWindowBuffer: MultiWindowBuffer,
  windowId: TimeWindowId,
): TimeSeriesBuffer => {
  const windowState = multiWindowBuffer.windows[windowId];
  if (!windowState) {
    return createBuffer(DEFAULT_BUFFER_CAPACITY);
  }
  return windowState.buffer;
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a multi-session store backed by an in-memory Map. */
export const createMultiSessionStore = (): MultiSessionStore => {
  const sessions = new Map<string, SessionMetrics>();
  const sessionBuffers = new Map<string, Map<MetricCategoryId, TimeSeriesBuffer>>();
  const aggregateBuffers = new Map<MetricCategoryId, TimeSeriesBuffer>();
  const sessionMultiWindowBuffers = new Map<string, Map<MetricCategoryId, MultiWindowBuffer>>();
  const aggregateMultiWindowBuffers = new Map<MetricCategoryId, MultiWindowBuffer>();
  const subscribers = new Set<() => void>();

  // Running aggregate sums per category (delta-updated, not recomputed from all sessions)
  const aggregateSums = new Map<MetricCategoryId, number>();
  // Last-known value per session per category (for delta computation)
  const lastSessionValues = new Map<string, Map<MetricCategoryId, number>>();

  // V2 phosphor storage — per-session per-metric rate samples + per-session pulse log.
  // Arrays grow on append; read-time callers are responsible for windowing.
  const sessionRateHistories = new Map<
    string,
    Map<MetricId, PhosphorRateSample[]>
  >();
  const sessionPulseLogs = new Map<string, Pulse[]>();

  // Initialize aggregate buffers and sums for all categories
  for (const id of CATEGORY_IDS) {
    aggregateBuffers.set(id, createBuffer(DEFAULT_BUFFER_CAPACITY));
    aggregateMultiWindowBuffers.set(id, createMultiWindowBuffer());
    aggregateSums.set(id, 0);
  }

  /** Initialize empty v2 rate-history buckets for a newly-added session. */
  const initPhosphorBuckets = (sessionId: string): void => {
    const metricMap = new Map<MetricId, PhosphorRateSample[]>();
    for (const metric of METRIC_IDS) metricMap.set(metric, []);
    sessionRateHistories.set(sessionId, metricMap);
    sessionPulseLogs.set(sessionId, []);
  };

  let batchDepth = 0;
  let batchDirty = false;

  const notifySubscribers = (): void => {
    if (batchDepth > 0) {
      batchDirty = true;
      return;
    }
    for (const callback of subscribers) {
      callback();
    }
  };

  const batchUpdate = (fn: () => void): void => {
    batchDepth++;
    try {
      fn();
    } finally {
      batchDepth--;
      if (batchDepth === 0 && batchDirty) {
        batchDirty = false;
        for (const callback of subscribers) {
          callback();
        }
      }
    }
  };

  const addSession = (sessionId: string): void => {
    if (sessions.has(sessionId)) return;
    sessions.set(sessionId, createInitialMetrics(sessionId));
    sessionBuffers.set(sessionId, createCategoryBuffers());
    sessionMultiWindowBuffers.set(sessionId, createCategoryMultiWindowBuffers());
    const valueMap = new Map<MetricCategoryId, number>();
    for (const id of CATEGORY_IDS) valueMap.set(id, 0);
    lastSessionValues.set(sessionId, valueMap);
    initPhosphorBuckets(sessionId);
  };

  const removeSession = (sessionId: string): void => {
    // Subtract this session's last values from running aggregates
    const valueMap = lastSessionValues.get(sessionId);
    if (valueMap) {
      for (const categoryId of CATEGORY_IDS) {
        if (isCategoryAggregatable(categoryId)) {
          const oldValue = valueMap.get(categoryId) ?? 0;
          aggregateSums.set(categoryId, (aggregateSums.get(categoryId) ?? 0) - oldValue);
        }
      }
    }
    sessions.delete(sessionId);
    sessionBuffers.delete(sessionId);
    sessionMultiWindowBuffers.delete(sessionId);
    lastSessionValues.delete(sessionId);
    sessionRateHistories.delete(sessionId);
    sessionPulseLogs.delete(sessionId);
  };

  const updateSession = (sessionId: string, metrics: SessionMetrics): void => {
    if (sessions.has(sessionId)) {
      sessions.set(sessionId, metrics);
    }
  };

  const getSessions = (): ReadonlyArray<SessionMetrics> =>
    Array.from(sessions.values());

  const getSession = (sessionId: string): SessionMetrics | undefined =>
    sessions.get(sessionId);

  const appendSessionSample = (sessionId: string, samples: CategorySampleInput): void => {
    const categoryBufferMap = sessionBuffers.get(sessionId);
    if (!categoryBufferMap) return;

    const timestamp = Date.now();
    const sessionMwBufferMap = sessionMultiWindowBuffers.get(sessionId);
    const valueMap = lastSessionValues.get(sessionId);

    // Append per-category samples and delta-update aggregates in a single pass
    for (const categoryId of CATEGORY_IDS) {
      const value = extractCategoryValue(samples, categoryId);
      const rateSample = createCategorySample(value, timestamp);

      // Per-session single-window buffer
      const currentBuffer = categoryBufferMap.get(categoryId)!;
      categoryBufferMap.set(categoryId, appendSample(currentBuffer, rateSample));

      // Per-session multi-window buffers
      if (sessionMwBufferMap) {
        const currentMwBuffer = sessionMwBufferMap.get(categoryId)!;
        sessionMwBufferMap.set(categoryId, appendMultiWindowSample(currentMwBuffer, rateSample));
      }

      // Delta-update running aggregate sum (O(1) instead of O(sessions))
      if (isCategoryAggregatable(categoryId)) {
        const oldValue = valueMap?.get(categoryId) ?? 0;
        const newSum = (aggregateSums.get(categoryId) ?? 0) - oldValue + value;
        aggregateSums.set(categoryId, newSum);
        valueMap?.set(categoryId, value);

        // Append aggregate sample to both single-window and multi-window buffers
        const aggregateSample = createCategorySample(newSum, timestamp);

        const currentAggregate = aggregateBuffers.get(categoryId)!;
        aggregateBuffers.set(categoryId, appendSample(currentAggregate, aggregateSample));

        const currentAggMwBuffer = aggregateMultiWindowBuffers.get(categoryId)!;
        aggregateMultiWindowBuffers.set(
          categoryId,
          appendMultiWindowSample(currentAggMwBuffer, aggregateSample),
        );
      }
    }

    notifySubscribers();
  };

  const getSessionBuffer = (
    sessionId: string,
    categoryId: MetricCategoryId,
  ): TimeSeriesBuffer | undefined => {
    const categoryBufferMap = sessionBuffers.get(sessionId);
    if (!categoryBufferMap) return undefined;
    return categoryBufferMap.get(categoryId);
  };

  const getAggregateBuffer = (categoryId: MetricCategoryId): TimeSeriesBuffer =>
    aggregateBuffers.get(categoryId) ?? createBuffer(DEFAULT_BUFFER_CAPACITY);

  const getAggregateWindowBuffer = (
    categoryId: MetricCategoryId,
    windowId: TimeWindowId,
  ): TimeSeriesBuffer => {
    const multiWindowBuffer = aggregateMultiWindowBuffers.get(categoryId);
    if (!multiWindowBuffer) {
      return createBuffer(DEFAULT_BUFFER_CAPACITY);
    }
    return extractWindowBuffer(multiWindowBuffer, windowId);
  };

  const getSessionWindowBuffer = (
    sessionId: string,
    categoryId: MetricCategoryId,
    windowId: TimeWindowId,
  ): TimeSeriesBuffer | undefined => {
    const sessionMwBufferMap = sessionMultiWindowBuffers.get(sessionId);
    if (!sessionMwBufferMap) return undefined;
    const multiWindowBuffer = sessionMwBufferMap.get(categoryId);
    if (!multiWindowBuffer) return undefined;
    return extractWindowBuffer(multiWindowBuffer, windowId);
  };

  const subscribe = (callback: () => void): (() => void) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  };

  // ---------------------------------------------------------------------------
  // V2 phosphor methods (additive)
  // ---------------------------------------------------------------------------

  const appendRateSample = (
    sessionId: string,
    metric: MetricId,
    t: number,
    v: number,
  ): void => {
    const metricMap = sessionRateHistories.get(sessionId);
    if (!metricMap) return; // unknown session -- silently drop (v1 parity)
    const history = metricMap.get(metric);
    if (!history) return;
    history.push({ t, v });
    notifySubscribers();
  };

  const appendPulse = (sessionId: string, pulse: Pulse): void => {
    const log = sessionPulseLogs.get(sessionId);
    if (!log) return;
    log.push(pulse);
    notifySubscribers();
  };

  const getRateHistory = (
    sessionId: string,
    metric: MetricId,
  ): ReadonlyArray<PhosphorRateSample> => {
    const metricMap = sessionRateHistories.get(sessionId);
    if (!metricMap) return [];
    const history = metricMap.get(metric);
    return history ?? [];
  };

  const getPulses = (
    sessionId: string,
    now?: number,
  ): ReadonlyArray<Pulse> => {
    const log = sessionPulseLogs.get(sessionId);
    if (!log) return [];
    // Retention trim is idempotent and always applied. When `now` is
    // supplied (e.g. by scopeProjection), use it so trimming aligns with
    // the frame's logical clock. Otherwise fall back to wall-clock
    // `Date.now()` so callers never observe pulses older than the
    // retention cutoff (the "pulses older than 5s are absent from
    // store.getPulses" invariant).
    const reference = now ?? Date.now();
    return prunePulses(log, reference, PULSE_RETENTION_MS);
  };

  const getSessionIds = (): ReadonlyArray<string> => Array.from(sessions.keys());

  return {
    addSession,
    removeSession,
    updateSession,
    getSessions,
    getSession,
    appendSessionSample,
    batchUpdate,
    getSessionBuffer,
    getAggregateBuffer,
    getAggregateWindowBuffer,
    getSessionWindowBuffer,
    subscribe,
    // v2 phosphor additive surface
    appendRateSample,
    appendPulse,
    getRateHistory,
    getPulses,
    getSessionIds,
  };
};
