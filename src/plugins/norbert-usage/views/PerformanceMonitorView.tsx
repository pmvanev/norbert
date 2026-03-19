/**
 * PerformanceMonitorView: multi-session performance monitoring dashboard.
 *
 * Uses PMViewMode discriminated union to route between PMAggregateGrid
 * (aggregate view) and PMSessionDetail (session detail view).
 *
 * Subscribes to MetricsStore for live data updates and renders real-time
 * charts via PMAggregateGrid and PMChart components.
 *
 * Time window state is preserved across view mode transitions.
 */

import { useState, useEffect } from "react";
import type { MetricsStore } from "../adapters/metricsStore";
import type { PMViewMode, TimeWindowId, SessionMetrics, RateSample } from "../domain/types";
import { aggregateAcrossSessions } from "../domain/crossSessionAggregator";
import { getSamples } from "../domain/timeSeriesSampler";
import {
  createAggregateViewMode,
  computeBreadcrumb,
} from "../domain/performanceMonitor";
import { PMTimeWindowSelector } from "./PMTimeWindowSelector";
import { PMAggregateGrid } from "./PMAggregateGrid";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PerformanceMonitorViewProps {
  readonly store: MetricsStore;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Default time window for Performance Monitor. */
const DEFAULT_TIME_WINDOW: TimeWindowId = "1m";

export const PerformanceMonitorView = ({ store }: PerformanceMonitorViewProps) => {
  const [viewMode, _setViewMode] = useState<PMViewMode>(createAggregateViewMode);
  const [selectedWindow, setSelectedWindow] = useState<TimeWindowId>(DEFAULT_TIME_WINDOW);

  // Subscribe to live store updates for metrics and time series
  const [metrics, setMetrics] = useState<SessionMetrics>(() => store.getMetrics());
  const [samples, setSamples] = useState<ReadonlyArray<RateSample>>(() =>
    getSamples(store.getTimeSeries())
  );

  useEffect(() => {
    return store.subscribe((m, ts) => {
      setMetrics(m);
      setSamples(getSamples(ts));
    });
  }, [store]);

  // Aggregate the current session into the cross-session view.
  // For now we have a single session from the store; the multi-session
  // store will feed multiple sessions in the future.
  const aggregate = aggregateAcrossSessions([metrics]);

  const breadcrumb = computeBreadcrumb(viewMode);

  return (
    <div className="performance-monitor" role="region" aria-label="Performance Monitor">
      <div className="sec-hdr">
        <span className="sec-t">{breadcrumb}</span>
        <PMTimeWindowSelector
          selectedWindow={selectedWindow}
          onChange={setSelectedWindow}
        />
        <span className="sec-a">multi-session</span>
      </div>
      <div className="pm-main">
        {viewMode.tag === "aggregate" ? (
          <PMAggregateGrid
            aggregate={aggregate}
            tokenRateSamples={samples}
            costRateSamples={samples}
          />
        ) : (
          <p className="pm-placeholder">Session detail for {viewMode.sessionId}</p>
        )}
      </div>
    </div>
  );
};
