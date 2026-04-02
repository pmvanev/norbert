/**
 * PerformanceMonitorView (v2): master-detail shell for the Performance Monitor.
 *
 * Layout: sidebar (left) + detail pane (right), inspired by Windows Task
 * Manager Performance tab.
 *
 * Manages state:
 *   - selectedCategory: MetricCategoryId (default "tokens")
 *   - selectedWindow: TimeWindowId (persists across category switches)
 *   - hoverState: shared crosshair state for chart tooltips
 *
 * Subscribes to MultiSessionStore for re-renders on data updates.
 * PMSidebar renders category rows with sparklines. PMDetailPane is a
 * placeholder slot for 04-02.
 */

import { useState, useEffect } from "react";
import type { MetricsStore } from "../adapters/metricsStore";
import type { MultiSessionStore } from "../adapters/multiSessionStore";
import type { MetricCategoryId, TimeWindowId, HoverState } from "../domain/types";
import { createHeartbeatSample } from "../domain/heartbeat";
import { PMTimeWindowSelector } from "./PMTimeWindowSelector";
import { PMSidebar } from "./PMSidebar";
import { PMDetailPane } from "./PMDetailPane";
import { PMTooltip } from "./PMTooltip";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CATEGORY: MetricCategoryId = "tokens";
const DEFAULT_TIME_WINDOW: TimeWindowId = "1m";

const INITIAL_HOVER_STATE: HoverState = {
  active: false,
  canvasId: "",
  mouseX: 0,
  sampleIndex: 0,
  value: 0,
  formattedValue: "",
  timeOffset: "",
  color: "",
  tooltipX: 0,
  tooltipY: 0,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PerformanceMonitorViewProps {
  readonly store: MetricsStore;
  readonly multiSessionStore: MultiSessionStore;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PerformanceMonitorView = ({
  store: _store,
  multiSessionStore,
}: PerformanceMonitorViewProps) => {
  const [selectedCategory, setSelectedCategory] = useState<MetricCategoryId>(DEFAULT_CATEGORY);
  const [selectedWindow, setSelectedWindow] = useState<TimeWindowId>(DEFAULT_TIME_WINDOW);
  const [hoverState, setHoverState] = useState<HoverState>(INITIAL_HOVER_STATE);

  // hoverState + setter passed to PMDetailPane

  // Force re-render when store data changes
  const [, setRenderTick] = useState(0);

  useEffect(() => {
    const unsubscribe = multiSessionStore.subscribe(() => {
      setRenderTick((tick) => tick + 1);
    });
    return unsubscribe;
  }, [multiSessionStore]);

  // Heartbeat: inject zero-rate samples at ~1Hz so charts keep scrolling
  // when no real events arrive. Rate-based categories (tokens, cost) go to
  // zero because no tokens/dollars are flowing during idle. Point-in-time
  // categories (agents, context) reflect current session state.
  useEffect(() => {
    const id = setInterval(() => {
      const sessions = multiSessionStore.getSessions();
      if (sessions.length > 0) {
        for (const session of sessions) {
          const sample = createHeartbeatSample(session);
          multiSessionStore.appendSessionSample(session.sessionId, sample);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [multiSessionStore]);

  return (
    <div className="performance-monitor" role="region" aria-label="Performance Monitor">
      <div className="sec-hdr">
        <span className="sec-t">Performance Monitor</span>
        <PMTimeWindowSelector
          selectedWindow={selectedWindow}
          onChange={setSelectedWindow}
        />
      </div>

      <div className="pm-container">
        {/* Left: PMSidebar (03-02) */}
        <PMSidebar
          multiSessionStore={multiSessionStore}
          selectedCategory={selectedCategory}
          onCategorySelect={setSelectedCategory}
        />

        {/* Right: PMDetailPane (04-02) */}
        <PMDetailPane
          multiSessionStore={multiSessionStore}
          selectedCategory={selectedCategory}
          selectedWindow={selectedWindow}
          hoverState={hoverState}
          onHoverChange={setHoverState}
        />
      </div>

      {/* Floating tooltip -- uses fixed positioning, placed outside pm-container */}
      <PMTooltip hoverState={hoverState} />

      {/* Visually-hidden live region for screen readers to announce hover values */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {hoverState.active
          ? `${hoverState.formattedValue}, ${hoverState.timeOffset}`
          : ""}
      </div>
    </div>
  );
};
