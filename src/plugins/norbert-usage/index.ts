/// norbert-usage plugin entry point.
///
/// Implements the NorbertPlugin interface using only the public NorbertAPI.
/// Registers Gauge Cluster, Oscilloscope, and Usage Dashboard views,
/// a sidebar tab, a status bar item, and a hook processor for session events.
///
/// This is a first-party plugin that loads via the standard plugin loader
/// identically to any third-party plugin.

import type { NorbertPlugin, NorbertAPI } from "../types";
import { NORBERT_USAGE_MANIFEST } from "./manifest";
import { createHookProcessor } from "./hookProcessor";
import { createMetricsStore } from "./adapters/metricsStore";
import { createMultiSessionStore } from "./adapters/multiSessionStore";
import { DEFAULT_PRICING_TABLE } from "./domain/pricingModel";
import { appendSample } from "./domain/timeSeriesSampler";
import { computeInstantaneousRates, type MetricsSnapshot } from "./domain/instantaneousRate";
import type { RateSample } from "./domain/types";

// ---------------------------------------------------------------------------
// Shared metrics store -- module-level so App.tsx and the hook processor
// operate on the same instance. This is the single mutable cell.
// ---------------------------------------------------------------------------

export const usageMetricsStore = createMetricsStore();
export const usageMultiSessionStore = createMultiSessionStore();

// Mutable snapshot for instantaneous rate computation.
// Module-level singleton alongside the metrics store.
let previousSnapshot: MetricsSnapshot = { totalTokens: 0, sessionCost: 0, timestamp: Date.now() };

// ---------------------------------------------------------------------------
// View constants
// ---------------------------------------------------------------------------

const GAUGE_CLUSTER_VIEW_ID = "gauge-cluster";
const GAUGE_CLUSTER_VIEW_LABEL = "Gauge Cluster";
const GAUGE_CLUSTER_VIEW_ICON = "gauge"; // gauge cluster

const OSCILLOSCOPE_VIEW_ID = "oscilloscope";
const OSCILLOSCOPE_VIEW_LABEL = "Oscilloscope";
const OSCILLOSCOPE_VIEW_ICON = "activity"; // oscilloscope trace

const USAGE_DASHBOARD_VIEW_ID = "usage-dashboard";
const USAGE_DASHBOARD_VIEW_LABEL = "Usage Dashboard";
const USAGE_DASHBOARD_VIEW_ICON = "bar-chart"; // usage dashboard

const PERFORMANCE_MONITOR_VIEW_ID = "performance-monitor";
const PERFORMANCE_MONITOR_VIEW_LABEL = "Performance Monitor";
const PERFORMANCE_MONITOR_VIEW_ICON = "monitor"; // performance monitor

// ---------------------------------------------------------------------------
// Tab constants
// ---------------------------------------------------------------------------

const USAGE_TAB_ID = "usage";
const USAGE_TAB_LABEL = "Usage";
const USAGE_TAB_ICON = "zap"; // lightning bolt
const USAGE_TAB_ORDER = 1;

// ---------------------------------------------------------------------------
// Status item constants
// ---------------------------------------------------------------------------

const COST_TICKER_ID = "cost-ticker";
const COST_TICKER_LABEL = "Cost";
const COST_TICKER_ICON = "dollar"; // cost ticker
const COST_TICKER_POSITION = "right" as const;
const COST_TICKER_ORDER = 0;

// ---------------------------------------------------------------------------
// Plugin lifecycle
// ---------------------------------------------------------------------------

/// Registers all norbert-usage views, tabs, status items, and hooks
/// via the public API.
///
/// Pure registration function: calls only api.ui.registerView(),
/// api.ui.registerTab(), api.ui.registerStatusItem(), and api.hooks.register().
/// No internal Norbert modules are accessed.
const onLoad = (api: NorbertAPI): void => {
  // Register the Gauge Cluster view (floating panel with session cost pill)
  api.ui.registerView({
    id: GAUGE_CLUSTER_VIEW_ID,
    label: GAUGE_CLUSTER_VIEW_LABEL,
    icon: GAUGE_CLUSTER_VIEW_ICON,
    primaryView: false,
    minWidth: 200,
    minHeight: 150,
    floatMetric: "session_cost",
  });

  // Register the Oscilloscope view
  api.ui.registerView({
    id: OSCILLOSCOPE_VIEW_ID,
    label: OSCILLOSCOPE_VIEW_LABEL,
    icon: OSCILLOSCOPE_VIEW_ICON,
    primaryView: false,
    minWidth: 300,
    minHeight: 200,
    floatMetric: null,
  });

  // Register the Usage Dashboard as the primary view
  api.ui.registerView({
    id: USAGE_DASHBOARD_VIEW_ID,
    label: USAGE_DASHBOARD_VIEW_LABEL,
    icon: USAGE_DASHBOARD_VIEW_ICON,
    primaryView: true,
    minWidth: 400,
    minHeight: 300,
    floatMetric: null,
  });

  // Register the Performance Monitor view (multi-session mode view)
  api.ui.registerView({
    id: PERFORMANCE_MONITOR_VIEW_ID,
    label: PERFORMANCE_MONITOR_VIEW_LABEL,
    icon: PERFORMANCE_MONITOR_VIEW_ICON,
    primaryView: false,
    minWidth: 400,
    minHeight: 300,
    floatMetric: null,
  });

  // Register sidebar tab for quick access
  api.ui.registerTab({
    id: USAGE_TAB_ID,
    icon: USAGE_TAB_ICON,
    label: USAGE_TAB_LABEL,
    order: USAGE_TAB_ORDER,
  });

  // Register cost ticker status bar item (degraded mode if unavailable)
  try {
    api.ui.registerStatusItem({
      id: COST_TICKER_ID,
      label: COST_TICKER_LABEL,
      icon: COST_TICKER_ICON,
      position: COST_TICKER_POSITION,
      order: COST_TICKER_ORDER,
    });
  } catch {
    // Status item API unavailable -- plugin continues with views and tab.
    // This supports degraded functionality when the status bar is not present.
    console.warn(
      "norbert-usage: registerStatusItem unavailable, continuing in degraded mode",
    );
  }

  // Wire hook processor to the shared module-level store.
  // On each event: reduce metrics, compute burn rate, push a time series sample.
  const processor = createHookProcessor({
    updateMetrics: (reducer) => {
      const reduced = reducer(usageMetricsStore.getMetrics());
      const now = Date.now();

      const currentSnapshot: MetricsSnapshot = {
        totalTokens: reduced.totalTokens,
        sessionCost: reduced.sessionCost,
        timestamp: now,
      };
      const { tokenRate, costRate } = computeInstantaneousRates(currentSnapshot, previousSnapshot);
      previousSnapshot = currentSnapshot;

      const nextMetrics = { ...reduced, burnRate: tokenRate };
      const sample: RateSample = { timestamp: now, tokenRate, costRate };
      const nextTimeSeries = appendSample(usageMetricsStore.getTimeSeries(), sample);
      usageMetricsStore.update(nextMetrics, nextTimeSeries);
    },
    pricingTable: DEFAULT_PRICING_TABLE,
  });
  api.hooks.register("session-event", processor);
};

/// Cleanup function called when the plugin is unloaded.
const onUnload = (): void => {
  // No cleanup needed for the walking skeleton.
  // Future: unsubscribe from event sources, clear caches.
};

/// The norbert-usage plugin instance.
/// Satisfies the NorbertPlugin interface for standard plugin loading.
export const norbertUsagePlugin: NorbertPlugin = {
  manifest: NORBERT_USAGE_MANIFEST,
  onLoad,
  onUnload,
};
