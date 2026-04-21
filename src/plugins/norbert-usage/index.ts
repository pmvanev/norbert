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
import type { RateSample, SessionMetrics } from "./domain/types";
import { RATE_TICK_MS, WINDOW_MS } from "./domain/phosphor/phosphorMetricConfig";
import {
  deriveEventsRate,
  deriveToolCallsRate,
  deriveTokensRate,
} from "./domain/phosphor/rateDerivation";

// ---------------------------------------------------------------------------
// Shared metrics store -- module-level so App.tsx and the hook processor
// operate on the same instance. This is the single mutable cell.
// ---------------------------------------------------------------------------

export const usageMetricsStore = createMetricsStore();
export const usageMultiSessionStore = createMultiSessionStore();

// Mutable snapshot for instantaneous rate computation.
// Module-level singleton alongside the metrics store.
let previousSnapshot: MetricsSnapshot = { totalTokens: 0, sessionCost: 0, timestamp: Date.now() };

// Per-session snapshots used to compute each session's own burn rate.
// Keyed by sessionId so that one session's rate isn't affected by events
// from another session interleaving through the global pipeline.
const perSessionSnapshots = new Map<string, MetricsSnapshot>();

// v2 phosphor rate ticker handle. Scheduled by onLoad, cleared by onUnload.
// The ticker drains the hookProcessor's per-session events / toolcalls
// counters every RATE_TICK_MS and appends the derived rate samples to the
// v2 store so per-session traces on the Activity phosphor scope reflect
// live upstream activity.
let rateTickHandle: ReturnType<typeof setInterval> | null = null;

// v2 phosphor DEV-only silence watchdog. Scheduled alongside rateTickHandle
// in onLoad and cleared by onUnload. Fires once ~10s after plugin load and
// warns on the console if no events have arrived, so Phil can distinguish
// "hook wiring broken" from "implementation bug" when DevTools shows an
// empty scope. Production builds skip this entirely.
let silenceWatchdogHandle: ReturnType<typeof setTimeout> | null = null;
let firstEventReceivedAt: number | null = null;

// ---------------------------------------------------------------------------
// View constants
// ---------------------------------------------------------------------------

const ACTIVITY_VIEW_ICON = "square-activity";

// Session Status view: combined gauges + dashboard, shown in the secondary
// panel when a session is selected. Not registered as a sidebar entry.
const SESSION_STATUS_VIEW_ID = "session-status";
const SESSION_STATUS_VIEW_LABEL = "Session Status";
const SESSION_STATUS_VIEW_ICON = "layout-dashboard";

const ACTIVITY_VIEW_ID = "activity";
const ACTIVITY_VIEW_LABEL = "Activity";

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
  // Register the combined Session Status view (gauges + session dashboard).
  // Shown in the secondary panel when a session is selected; filtered out
  // of the sidebar.
  api.ui.registerView({
    id: SESSION_STATUS_VIEW_ID,
    label: SESSION_STATUS_VIEW_LABEL,
    icon: SESSION_STATUS_VIEW_ICON,
    primaryView: false,
    minWidth: 400,
    minHeight: 300,
    floatMetric: null,
  });

  // Register the Activity view (multi-session phosphor scope)
  api.ui.registerView({
    id: ACTIVITY_VIEW_ID,
    label: ACTIVITY_VIEW_LABEL,
    icon: ACTIVITY_VIEW_ICON,
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
  // Also feeds multi-session store for cross-session PM aggregation.
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
    updateMultiSessionMetrics: (sessionId, label, reducer) => {
      if (firstEventReceivedAt === null) {
        firstEventReceivedAt = Date.now();
      }
      usageMultiSessionStore.addSession(sessionId);
      const prev = usageMultiSessionStore.getSession(sessionId);
      if (prev) {
        const updated = reducer(prev);
        const now = Date.now();

        // Per-session burn rate: compute instantaneous token rate from this
        // session's own previous snapshot. Mirrors the global pipeline but
        // scoped per sessionId so cross-session interleaving can't skew it.
        const sessionPrevSnapshot: MetricsSnapshot = perSessionSnapshots.get(sessionId) ?? {
          totalTokens: prev.totalTokens,
          sessionCost: prev.sessionCost,
          timestamp: now,
        };
        const sessionCurrentSnapshot: MetricsSnapshot = {
          totalTokens: updated.totalTokens,
          sessionCost: updated.sessionCost,
          timestamp: now,
        };
        const { tokenRate } = computeInstantaneousRates(
          sessionCurrentSnapshot,
          sessionPrevSnapshot,
        );
        perSessionSnapshots.set(sessionId, sessionCurrentSnapshot);

        const withBurnRate: SessionMetrics = { ...updated, burnRate: tokenRate };

        // Populate sessionLabel from cwd on first event (when label is empty)
        const withLabel = withBurnRate.sessionLabel === "" && label !== ""
          ? { ...withBurnRate, sessionLabel: label }
          : withBurnRate;
        usageMultiSessionStore.updateSession(sessionId, withLabel);
      }
    },
    appendSessionSample: (sessionId, samples) => {
      usageMultiSessionStore.appendSessionSample(sessionId, samples);
    },
    // v2 phosphor wiring: feed per-session rate samples and pulses into
    // the multi-session store. Both methods are part of the store's
    // additive v2 surface; callers that don't need the v2 pathway simply
    // omit these deps. See v2-phosphor-architecture.md §5 Q1.
    appendRateSample: (sessionId, metric, t, v) => {
      usageMultiSessionStore.appendRateSample(sessionId, metric, t, v);
    },
    appendPulse: (sessionId, pulse) => {
      usageMultiSessionStore.appendPulse(sessionId, pulse);
    },
    pricingTable: DEFAULT_PRICING_TABLE,
  });
  api.hooks.register("session-event", processor);

  // v2 phosphor rate ticker: every RATE_TICK_MS the processor drains its
  // per-session events / toolcalls counters as rate samples. Running the
  // scheduler here (composition root) rather than inside the processor
  // keeps the processor's effect boundary bounded to ingest — the ticker
  // is a separate boundary concern owned by plugin lifecycle.
  if (rateTickHandle !== null) {
    clearInterval(rateTickHandle);
  }
  rateTickHandle = setInterval(() => {
    processor.sampleRates(Date.now());
  }, RATE_TICK_MS);

  // Phosphor history backfill. The scope shows a 60-second rolling window
  // of per-session activity; under the live-only ingest path it starts
  // empty and needs a full minute to fill. Since the DB already contains
  // the last minute of events, a single IPC call to `get_phosphor_history`
  // returns pre-bucketed counts that we paint directly into the
  // multi-session store — the scope lights up immediately on PM open.
  //
  // The response also carries `queryTimeMs` — the backend clock reading
  // that bounds the backfill. We prime the processor's live boundary to
  // that timestamp so live events pick up exactly where backfill ends
  // (no gap, no double count).
  //
  // Best-effort: a failure here just leaves the user with the pre-fix
  // behavior (empty scope, first-tick-prime fallback kicks in). No throw.
  void (async () => {
    try {
      const response = await api.host.invoke<{
        buckets: ReadonlyArray<{
          sessionId: string;
          bucketEndMs: number;
          events: number;
          toolcalls: number;
          tokens: number;
        }>;
        queryTimeMs: number;
      }>("get_phosphor_history", { windowMs: WINDOW_MS });

      // Register each session encountered in the backfill. addSession is
      // idempotent, so coexisting with App.tsx's polling-driven session
      // discovery is safe.
      const registered = new Set<string>();
      for (const b of response.buckets) {
        if (!registered.has(b.sessionId)) {
          usageMultiSessionStore.addSession(b.sessionId);
          registered.add(b.sessionId);
        }
        const ev = deriveEventsRate(b.events, RATE_TICK_MS, b.bucketEndMs);
        usageMultiSessionStore.appendRateSample(b.sessionId, "events", ev.t, ev.v);
        const tc = deriveToolCallsRate(b.toolcalls, RATE_TICK_MS, b.bucketEndMs);
        usageMultiSessionStore.appendRateSample(b.sessionId, "toolcalls", tc.t, tc.v);
        const tk = deriveTokensRate(b.tokens, RATE_TICK_MS, b.bucketEndMs);
        usageMultiSessionStore.appendRateSample(b.sessionId, "tokens", tk.t, tk.v);
      }

      // Prime the live-rate boundary to the backend's query time. The
      // processor's counter is zeroed and its freshness guard switches to
      // `received_at >= queryTimeMs`, making the backfill→live transition
      // seamless.
      processor.primeFromBackfill(response.queryTimeMs);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("norbert-usage: phosphor history backfill failed", error);
    }
  })();

  // DEV-only silence watchdog — see module-level docblock. If no events
  // arrive within the 10s grace window, warn on the console so Phil can
  // identify a hook-receiver wiring issue vs an implementation bug.
  if (
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    Boolean(import.meta.env.DEV)
  ) {
    if (silenceWatchdogHandle !== null) {
      clearTimeout(silenceWatchdogHandle);
    }
    silenceWatchdogHandle = setTimeout(() => {
      if (firstEventReceivedAt === null) {
        // eslint-disable-next-line no-console
        console.warn(
          "[phosphor] no events received in 10s — check hook receiver wiring",
        );
      }
    }, 10_000);
  }
};

/// Cleanup function called when the plugin is unloaded.
const onUnload = (): void => {
  // Stop the v2 phosphor rate ticker if one is running so unload is
  // idempotent and doesn't leak a background interval into the next
  // load cycle.
  if (rateTickHandle !== null) {
    clearInterval(rateTickHandle);
    rateTickHandle = null;
  }
  // Clear the DEV silence watchdog if it was armed.
  if (silenceWatchdogHandle !== null) {
    clearTimeout(silenceWatchdogHandle);
    silenceWatchdogHandle = null;
  }
  // Reset the first-event sentinel so reload-cycles during development
  // actually re-arm the watchdog.
  firstEventReceivedAt = null;
};

/// The norbert-usage plugin instance.
/// Satisfies the NorbertPlugin interface for standard plugin loading.
export const norbertUsagePlugin: NorbertPlugin = {
  manifest: NORBERT_USAGE_MANIFEST,
  onLoad,
  onUnload,
};
