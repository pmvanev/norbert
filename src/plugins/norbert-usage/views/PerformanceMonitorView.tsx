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
import { PMTimeWindowSelector } from "./PMTimeWindowSelector";
import { PMSidebar } from "./PMSidebar";

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

  // hoverState + setter will be passed to PMDetailPane (04-02)
  void hoverState;
  void setHoverState;

  // Force re-render when store data changes
  const [, setRenderTick] = useState(0);

  useEffect(() => {
    const unsubscribe = multiSessionStore.subscribe(() => {
      setRenderTick((tick) => tick + 1);
    });
    return unsubscribe;
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

        {/* Right: PMDetailPane placeholder (04-02) */}
        <div
          className="pm-detail-pane"
          data-selected-category={selectedCategory}
          data-selected-window={selectedWindow}
        />
      </div>
    </div>
  );
};
