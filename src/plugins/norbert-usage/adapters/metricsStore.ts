/**
 * Metrics Store -- the ONLY mutable cell in the norbert-usage plugin.
 *
 * Effect boundary: holds current SessionMetrics + TimeSeriesBuffer,
 * provides pub/sub for state change notifications.
 *
 * All domain logic lives in pure functions (metricsAggregator, timeSeriesSampler).
 * This module is strictly a state container with notification.
 */

import type { SessionMetrics, TimeSeriesBuffer } from "../domain/types";
import { createInitialMetrics } from "../domain/metricsAggregator";
import { createBuffer } from "../domain/timeSeriesSampler";

// ---------------------------------------------------------------------------
// MetricsStore interface -- the port for state access and subscription
// ---------------------------------------------------------------------------

export interface MetricsStore {
  readonly getMetrics: () => SessionMetrics;
  readonly getTimeSeries: () => TimeSeriesBuffer;
  readonly update: (metrics: SessionMetrics, timeSeries: TimeSeriesBuffer) => void;
  readonly subscribe: (
    callback: (metrics: SessionMetrics, timeSeries: TimeSeriesBuffer) => void,
  ) => () => void;
}

// ---------------------------------------------------------------------------
// Subscriber callback type
// ---------------------------------------------------------------------------

type Subscriber = (metrics: SessionMetrics, timeSeries: TimeSeriesBuffer) => void;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const DEFAULT_TIME_SERIES_CAPACITY = 60;

/**
 * Create a metrics store with initial zeroed state.
 *
 * The store is the single mutable cell: it holds current metrics and
 * time series, and notifies subscribers when state changes via update().
 *
 * subscribe() returns an unsubscribe function to stop receiving notifications.
 */
export const createMetricsStore = (
  initialSessionId: string = "default",
): MetricsStore => {
  let currentMetrics: SessionMetrics = createInitialMetrics(initialSessionId);
  let currentTimeSeries: TimeSeriesBuffer = createBuffer(DEFAULT_TIME_SERIES_CAPACITY);
  const subscribers: Set<Subscriber> = new Set();

  const getMetrics = (): SessionMetrics => currentMetrics;

  const getTimeSeries = (): TimeSeriesBuffer => currentTimeSeries;

  const update = (metrics: SessionMetrics, timeSeries: TimeSeriesBuffer): void => {
    currentMetrics = metrics;
    currentTimeSeries = timeSeries;

    for (const subscriber of subscribers) {
      subscriber(metrics, timeSeries);
    }
  };

  const subscribe = (callback: Subscriber): (() => void) => {
    subscribers.add(callback);

    return () => {
      subscribers.delete(callback);
    };
  };

  return { getMetrics, getTimeSeries, update, subscribe };
};
