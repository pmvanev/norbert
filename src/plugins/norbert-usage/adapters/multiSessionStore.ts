/// Multi-session store: mutable adapter tracking SessionMetrics for all
/// active sessions. Lives at the adapter boundary (effects at edges).
///
/// Port: MultiSessionStore
///   addSession(id) -- register a new session with zeroed metrics
///   removeSession(id) -- remove a tracked session
///   updateSession(id, metrics) -- replace metrics for a session
///   getSessions() -- all tracked session metrics (immutable snapshot)
///   getSession(id) -- metrics for a specific session or undefined
///   appendSessionSample(id, samples) -- append per-category sample values
///   getSessionBuffer(id, categoryId) -- per-session buffer for a category
///   getAggregateBuffer(categoryId) -- aggregate buffer across sessions
///   subscribe(callback) -- register state-change listener

import type { SessionMetrics, TimeSeriesBuffer, RateSample } from "../domain/types";
import type { MetricCategoryId } from "../domain/categoryConfig";
import { createInitialMetrics } from "../domain/metricsAggregator";
import { createBuffer, appendSample } from "../domain/timeSeriesSampler";
import { METRIC_CATEGORIES } from "../domain/categoryConfig";

// ---------------------------------------------------------------------------
// Category sample input -- values for each of the 4 metric categories
// ---------------------------------------------------------------------------

export interface CategorySampleInput {
  readonly tokens: number;
  readonly cost: number;
  readonly agents: number;
  readonly context: number;
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
  readonly getSessionBuffer: (sessionId: string, categoryId: MetricCategoryId) => TimeSeriesBuffer | undefined;
  readonly getAggregateBuffer: (categoryId: MetricCategoryId) => TimeSeriesBuffer;
  readonly subscribe: (callback: () => void) => () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BUFFER_CAPACITY = 60;

const CATEGORY_IDS: ReadonlyArray<MetricCategoryId> = ["tokens", "cost", "agents", "context"];

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
const createCategorySample = (value: number, timestamp: number): RateSample => ({
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

/// Recompute aggregate buffer for a given category by summing per-session latest values.
const recomputeAggregateBuffer = (
  sessionBuffers: Map<string, Map<MetricCategoryId, TimeSeriesBuffer>>,
  categoryId: MetricCategoryId,
  currentAggregate: TimeSeriesBuffer,
  timestamp: number,
): TimeSeriesBuffer => {
  if (!isCategoryAggregatable(categoryId)) {
    return currentAggregate;
  }

  let sum = 0;
  for (const [, categoryBufferMap] of sessionBuffers) {
    const buffer = categoryBufferMap.get(categoryId);
    if (buffer && buffer.samples.length > 0) {
      const latestSample = buffer.samples[buffer.samples.length - 1];
      sum += latestSample.tokenRate;
    }
  }

  const aggregateSample = createCategorySample(sum, timestamp);
  return appendSample(currentAggregate, aggregateSample);
};

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a multi-session store backed by an in-memory Map. */
export const createMultiSessionStore = (): MultiSessionStore => {
  const sessions = new Map<string, SessionMetrics>();
  const sessionBuffers = new Map<string, Map<MetricCategoryId, TimeSeriesBuffer>>();
  const aggregateBuffers = new Map<MetricCategoryId, TimeSeriesBuffer>();
  const subscribers = new Set<() => void>();

  // Initialize aggregate buffers for all categories
  for (const id of CATEGORY_IDS) {
    aggregateBuffers.set(id, createBuffer(DEFAULT_BUFFER_CAPACITY));
  }

  const notifySubscribers = (): void => {
    for (const callback of subscribers) {
      callback();
    }
  };

  const addSession = (sessionId: string): void => {
    if (sessions.has(sessionId)) return;
    sessions.set(sessionId, createInitialMetrics(sessionId));
    sessionBuffers.set(sessionId, createCategoryBuffers());
  };

  const removeSession = (sessionId: string): void => {
    sessions.delete(sessionId);
    sessionBuffers.delete(sessionId);
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

    // Append per-category samples to session buffers
    for (const categoryId of CATEGORY_IDS) {
      const value = extractCategoryValue(samples, categoryId);
      const sample = createCategorySample(value, timestamp);
      const currentBuffer = categoryBufferMap.get(categoryId)!;
      categoryBufferMap.set(categoryId, appendSample(currentBuffer, sample));
    }

    // Recompute aggregate buffers for aggregatable categories
    for (const categoryId of CATEGORY_IDS) {
      const currentAggregate = aggregateBuffers.get(categoryId)!;
      aggregateBuffers.set(
        categoryId,
        recomputeAggregateBuffer(sessionBuffers, categoryId, currentAggregate, timestamp),
      );
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

  const subscribe = (callback: () => void): (() => void) => {
    subscribers.add(callback);
    return () => {
      subscribers.delete(callback);
    };
  };

  return {
    addSession,
    removeSession,
    updateSession,
    getSessions,
    getSession,
    appendSessionSample,
    getSessionBuffer,
    getAggregateBuffer,
    subscribe,
  };
};
