/**
 * PerformanceMonitorView: shell container for multi-session performance monitoring.
 *
 * Minimal placeholder at this stage -- will be expanded in later steps
 * to show aggregate metrics, per-session breakdowns, and compaction estimates.
 *
 * Receives the same MetricsStore as OscilloscopeView for shared data access.
 */

import type { MetricsStore } from "../adapters/metricsStore";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PerformanceMonitorViewProps {
  readonly store: MetricsStore;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PerformanceMonitorView = ({ store: _store }: PerformanceMonitorViewProps) => {
  return (
    <div className="performance-monitor" role="region" aria-label="Performance Monitor">
      <div className="sec-hdr">
        <span className="sec-t">Performance Monitor</span>
        <span className="sec-a">multi-session</span>
      </div>
      <div className="pm-main">
        <p className="pm-placeholder">Performance Monitor view -- coming soon.</p>
      </div>
    </div>
  );
};
