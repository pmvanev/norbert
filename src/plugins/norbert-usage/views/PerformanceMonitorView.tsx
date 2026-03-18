/**
 * PerformanceMonitorView: shell container for multi-session performance monitoring.
 *
 * Uses PMViewMode discriminated union to route between PMAggregateGrid
 * (aggregate view) and PMSessionDetail (session detail view).
 *
 * Navigation state is managed via the pure domain functions
 * createAggregateViewMode and createSessionDetailViewMode.
 * Time window state is preserved across view mode transitions.
 *
 * Receives the same MetricsStore as OscilloscopeView for shared data access.
 */

import { useState } from "react";
import type { MetricsStore } from "../adapters/metricsStore";
import type { PMViewMode, TimeWindowId } from "../domain/types";
import {
  createAggregateViewMode,
  computeBreadcrumb,
} from "../domain/performanceMonitor";
import { PMTimeWindowSelector } from "./PMTimeWindowSelector";

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

export const PerformanceMonitorView = ({ store: _store }: PerformanceMonitorViewProps) => {
  const [viewMode, _setViewMode] = useState<PMViewMode>(createAggregateViewMode);
  const [selectedWindow, setSelectedWindow] = useState<TimeWindowId>(DEFAULT_TIME_WINDOW);

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
          <p className="pm-placeholder">Performance Monitor view -- coming soon.</p>
        ) : (
          <p className="pm-placeholder">Session detail for {viewMode.sessionId}</p>
        )}
      </div>
    </div>
  );
};
