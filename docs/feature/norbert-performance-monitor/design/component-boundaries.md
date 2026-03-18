# Component Boundaries: norbert-performance-monitor

## Module Map

All new modules live within the existing `src/plugins/norbert-usage/` directory structure. No new plugins.

```
src/plugins/norbert-usage/
  domain/                           # Pure functions (no side effects)
    types.ts                        # MODIFIED: add new algebraic types
    oscilloscope.ts                 # UNCHANGED: reused by PM charts
    metricsAggregator.ts            # UNCHANGED: per-session fold
    timeSeriesSampler.ts            # UNCHANGED: ring buffer operations
    burnRate.ts                     # UNCHANGED: burn rate computation
    instantaneousRate.ts            # UNCHANGED: rate from snapshots
    pricingModel.ts                 # UNCHANGED: model pricing
    tokenExtractor.ts               # UNCHANGED: payload extraction
    gaugeCluster.ts                 # MODIFIED: extract threshold config to shared constant
    dashboard.ts                    # UNCHANGED
    costTicker.ts                   # UNCHANGED
    crossSessionAggregator.ts       # NEW: Array<SessionMetrics> -> AggregateMetrics
    multiWindowSampler.ts           # NEW: multi-resolution buffer management
    performanceMonitor.ts           # NEW: PM chart data, urgency, compaction estimate
    urgencyThresholds.ts            # NEW: shared threshold configuration constant

  adapters/                         # Effect boundary (mutable state, I/O)
    metricsStore.ts                 # UNCHANGED: broadcast-session store
    eventSource.ts                  # UNCHANGED: hook registration wiring
    multiSessionStore.ts            # NEW: manages SessionMetrics for all active sessions
    sessionDiscovery.ts             # NEW: queries sessions table for active sessions

  views/                            # React components
    GaugeClusterView.tsx            # MODIFIED: import thresholds from shared config
    OscilloscopeView.tsx            # UNCHANGED
    UsageDashboardView.tsx          # UNCHANGED
    CostTicker.tsx                  # UNCHANGED
    PerformanceMonitorView.tsx      # NEW: PM container with aggregate/detail routing
    PMAggregateGrid.tsx              # NEW: multi-metric grid with per-session breakdown
    PMSessionDetail.tsx             # NEW: session-scoped metrics + agent breakdown
    PMTimeWindowSelector.tsx        # NEW: time window button group
    PMChart.tsx                     # NEW: reusable canvas chart cell for PM grid

  hookProcessor.ts                  # MODIFIED: route events by session_id to multi-session store
  index.ts                          # MODIFIED: register PM view, initialize multi-session store
  manifest.ts                       # UNCHANGED
```

## Dependency Graph

```
                    urgencyThresholds.ts (shared config)
                    /                \
                   /                  \
  gaugeCluster.ts                    performanceMonitor.ts
  (MODIFIED: imports thresholds)     (NEW: imports thresholds)

  crossSessionAggregator.ts  <-- types.ts (SessionMetrics, AggregateMetrics)
           |
           v
  multiSessionStore.ts  <--  metricsAggregator.ts (per-session fold)
      |        |                    |
      |        |              tokenExtractor.ts + pricingModel.ts
      |        |
      v        v
  PMAggregateGrid   PMSessionDetail
      |                |
      v                v
  PMChart.tsx (reuses oscilloscope.ts functions)
      |
      v
  oscilloscope.ts (prepareWaveformPoints, computeGridLines, formatRateOverlay)
```

## New Module Responsibilities

### domain/crossSessionAggregator.ts
- **Input**: `ReadonlyArray<SessionMetrics>`
- **Output**: `AggregateMetrics`
- **Pure**: Yes
- **Responsibility**: Sum token rates, cost rates, agent counts across sessions. Sort sessions by rate descending. Produce SessionSummary array.
- **No dependencies on**: adapters, views, external APIs

### domain/multiWindowSampler.ts
- **Input**: `MultiWindowBuffer`, `RateSample`, `TimeWindowId`
- **Output**: `MultiWindowBuffer`
- **Pure**: Yes
- **Responsibility**: Maintain ring buffers at different resolutions. Downsample incoming samples for wider windows. Select active window buffer.
- **Reuses**: `appendSample`, `getSamples`, `computeStats` from `timeSeriesSampler.ts`

### domain/performanceMonitor.ts
- **Input**: `AggregateMetrics`, `SessionMetrics`, `TimeSeriesBuffer`, `CanvasDimensions`, `UrgencyThresholds`
- **Output**: `PMChartData`, `CompactionEstimate`, `SessionDetailData`
- **Pure**: Yes
- **Responsibility**: Compose oscilloscope rendering functions with PM-specific data mapping. Compute compaction estimates. Classify urgency. Produce chart data.
- **Reuses**: `prepareWaveformPoints`, `computeGridLines`, `formatRateOverlay` from `oscilloscope.ts`

### domain/urgencyThresholds.ts
- **Pure**: Yes (const configuration data)
- **Responsibility**: Single source of truth for amber/red thresholds. Consumed by `gaugeCluster.ts` (modified to import) and `performanceMonitor.ts`.

### adapters/multiSessionStore.ts
- **Effect boundary**: Yes (mutable state cell)
- **Responsibility**: Hold `Map<sessionId, SessionMetrics>` and `Map<sessionId, SessionTimeSeries>` for all active sessions. Notify PM view subscribers on state change. Maintain aggregate-level time series buffers.
- **Interface**: `getSessionMetrics(id)`, `getAllSessions()`, `getAggregateMetrics()`, `getTimeSeries(id, window)`, `getAggregateTimeSeries(window)`, `updateSession(id, metrics, sample)`, `addSession(id)`, `removeSession(id)`, `subscribe(callback)`

### adapters/sessionDiscovery.ts
- **Effect boundary**: Yes (I/O via api.db.execute)
- **Responsibility**: Poll sessions table at 2-second intervals. Detect new and ended sessions. Trigger `addSession`/`removeSession` on Multi-Session Store.

## Modified Module Changes

### hookProcessor.ts
- **Change**: Extract `session_id` from event payload. Route event to Multi-Session Store's per-session pipeline in addition to existing broadcast-session pipeline.
- **Backward compatible**: Existing broadcast-session pipeline unchanged.

### index.ts (onLoad)
- **Change**: Create and initialize Multi-Session Store. Register PM view. Wire hook processor to Multi-Session Store. Start session discovery polling.
- **Backward compatible**: All existing registrations preserved.

### domain/gaugeCluster.ts
- **Change**: Import `DEFAULT_THRESHOLDS` from `urgencyThresholds.ts` instead of defining inline. No behavioral change.

### domain/types.ts
- **Change**: Add new type definitions (AggregateMetrics, SessionSummary, TimeWindowConfig, etc.). No modifications to existing types.

## View Component Boundaries

### PerformanceMonitorView.tsx (Container)
- Manages PMViewMode state (aggregate vs detail)
- Manages TimeWindowId state
- Subscribes to Multi-Session Store
- Routes to PMAggregateGrid or PMSessionDetail based on mode
- Preserves time window across mode switches

### PMAggregateGrid.tsx
- Renders 2x2 chart grid (tokens/s total, cost/min, active agents, context %)
- Renders per-session breakdown panel
- Delegates chart rendering to PMChart
- Handles session click for drill-down (calls parent callback)

### PMSessionDetail.tsx
- Renders session-scoped charts (token rate, cost rate, context, agents)
- Renders agent breakdown panel
- Renders operational metrics bar
- Renders back navigation

### PMChart.tsx
- Reusable Canvas chart component
- Receives PMChartData (pre-computed waveform points, grid lines, stats)
- Draws using same canvas functions as OscilloscopeView (clearCanvas, drawGridLines, drawTrace, drawRateOverlay)
- Handles responsive sizing via ResizeObserver

### PMTimeWindowSelector.tsx
- Button group for time window selection (1m, 5m, 15m, Session)
- Calls parent callback on selection change
- Highlights active window

## Production File Estimate

| Category | New Files | Modified Files |
|---|---|---|
| Domain (pure) | 4 | 2 |
| Adapters (effect) | 2 | 0 |
| Views (React) | 5 | 0 |
| Entry/wiring | 0 | 2 |
| **Total** | **11** | **4** |

15 total files touched. This informs roadmap step count: target <= 37 steps (15 * 2.5).
