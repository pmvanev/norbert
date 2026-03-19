# Component Boundaries: norbert-performance-monitor-v2

## Module Map

All changes within `src/plugins/norbert-usage/`. No new plugins.

```
src/plugins/norbert-usage/
  domain/
    types.ts                        # MODIFIED: add MetricCategoryId, CategorySample, HoverState, ChartMode
    oscilloscope.ts                 # UNCHANGED: reused by chart renderer
    metricsAggregator.ts            # UNCHANGED
    timeSeriesSampler.ts            # UNCHANGED
    burnRate.ts                     # UNCHANGED
    instantaneousRate.ts            # UNCHANGED
    pricingModel.ts                 # UNCHANGED
    tokenExtractor.ts               # UNCHANGED
    gaugeCluster.ts                 # UNCHANGED
    dashboard.ts                    # UNCHANGED
    costTicker.ts                   # UNCHANGED
    crossSessionAggregator.ts       # UNCHANGED: reused
    multiWindowSampler.ts           # UNCHANGED: reused
    performanceMonitor.ts           # UNCHANGED: cost rate, compaction estimate reused
    urgencyThresholds.ts            # UNCHANGED: reused
    categoryConfig.ts               # NEW: MetricCategory const array, formatting, aggregate applicability
    chartRenderer.ts                # NEW: filled-area line chart, crosshair, hit-test, sparkline

  adapters/
    metricsStore.ts                 # UNCHANGED
    eventSource.ts                  # UNCHANGED
    multiSessionStore.ts            # MODIFIED: add per-session/per-category buffers, subscribe, sample append

  views/
    GaugeClusterView.tsx            # UNCHANGED
    OscilloscopeView.tsx            # UNCHANGED
    UsageDashboardView.tsx          # UNCHANGED
    CostTicker.tsx                  # UNCHANGED
    PMTimeWindowSelector.tsx        # UNCHANGED: reused
    PerformanceMonitorView.tsx      # REPLACED: new sidebar+detail container
    PMAggregateGrid.tsx             # REMOVED: replaced by PMDetailPane
    PMSessionDetail.tsx             # REMOVED: replaced by PMDetailPane
    PMChart.tsx                     # REPLACED: filled-area chart with hover support
    PMSidebar.tsx                   # NEW: category list with sparklines
    PMDetailPane.tsx                # NEW: aggregate graph + per-session grid + stats + table
    PMTooltip.tsx                   # NEW: floating hover tooltip
    PMStatsGrid.tsx                 # NEW: 2-column category-scoped stats
    PMSessionTable.tsx              # NEW: per-session breakdown table

  hookProcessor.ts                  # MODIFIED: extend to feed per-category samples
  index.ts                          # MODIFIED: wire extended MultiSessionStore
```

## Dependency Graph

```
categoryConfig.ts (const data: categories, formatting, colors)
       |
       +--- chartRenderer.ts (filled-area, crosshair, sparkline, hit-test)
       |         |
       |         +--- oscilloscope.ts (prepareWaveformPoints, computeCanvasDimensions)
       |
       +--- PMContainerView (reads category config for sidebar + detail)
       |         |
       |         +--- PMSidebar (renders categories, sparkline canvases)
       |         +--- PMDetailPane (aggregate graph, per-session grid, stats, table)
       |         |        |
       |         |        +--- PMChart (filled-area canvas, hover emit)
       |         |        +--- PMStatsGrid (category-scoped stats)
       |         |        +--- PMSessionTable (category-scoped columns)
       |         +--- PMTooltip (hover state -> floating tooltip)
       |         +--- PMTimeWindowSelector (reused unchanged)
       |
       +--- multiSessionStore.ts (per-session + aggregate buffers per category)
                 |
                 +--- crossSessionAggregator.ts (aggregate computation)
                 +--- timeSeriesSampler.ts (ring buffer operations)

urgencyThresholds.ts --- PMStatsGrid (context urgency display)
performanceMonitor.ts --- PMStatsGrid (cost rate, compaction estimate)
```

## New Module Responsibilities

### domain/categoryConfig.ts
- **Pure**: Yes (const configuration data)
- **Responsibility**: Define the 4 metric categories with all rendering/formatting properties. Single source of truth for colors, Y-axis config, aggregate applicability, stat definitions, session table columns.
- **Key export**: `METRIC_CATEGORIES: ReadonlyArray<MetricCategory>`

### domain/chartRenderer.ts
- **Pure**: Yes (canvas drawing functions with context parameter)
- **Responsibility**: Filled-area line chart rendering pipeline. Composes with oscilloscope functions for coordinate mapping. Adds: gradient fill, horizontal grid lines, Y-axis labels, crosshair overlay, sparkline (line-only, no fill/grid).
- **Key exports**: Canvas drawing functions, hit-test computation function
- **Reuses**: `prepareWaveformPoints`, `computeCanvasDimensions` from oscilloscope.ts

### adapters/multiSessionStore.ts (Extended)
- **Effect boundary**: Yes (mutable state cells)
- **New state**: `Map<sessionId, Map<MetricCategoryId, TimeSeriesBuffer>>` per-session category buffers; `Map<MetricCategoryId, TimeSeriesBuffer>` aggregate category buffers
- **New methods**: `appendSessionSample`, `getSessionBuffer`, `getAggregateBuffer`, `subscribe`
- **Backward compatible**: All existing methods preserved

## Modified Module Changes

### hookProcessor.ts
- **Change**: After updating SessionMetrics, compute per-category sample values (tokenRate, costRate from instantaneous rates; agentCount and contextPct from SessionMetrics) and call `appendSessionSample` on the MultiSessionStore.
- **Backward compatible**: Existing broadcast-session pipeline unchanged.

### index.ts (onLoad)
- **Change**: Wire extended MultiSessionStore with per-category buffer initialization. No new registrations needed (PM view already registered as "performance-monitor").
- **Backward compatible**: All existing registrations preserved.

### domain/types.ts
- **Change**: Add `MetricCategoryId`, `CategorySample`, `HoverState`, `ChartMode` type definitions. Remove `PMViewMode`, `AgentMetrics`, `SessionDetailData` (v1 types no longer needed).

## View Component Boundaries (v2)

### PerformanceMonitorView.tsx (Container -- REPLACED)
- Manages: `selectedCategory: MetricCategoryId`, `selectedWindow: TimeWindowId`, `hoverState: HoverState`
- Subscribes to MultiSessionStore for re-render on data change
- Renders: PMSidebar (left), PMDetailPane (right), PMTooltip (floating)
- Passes category config and buffers to children

### PMSidebar.tsx (NEW)
- Renders one row per MetricCategory
- Each row: label, current value (from aggregate buffer latest), sparkline canvas
- Selected row has accent-colored left border
- Emits `onSelectCategory(id)` callback

### PMDetailPane.tsx (NEW)
- Receives: selected MetricCategory, aggregate buffer, per-session buffers, stats data, session list
- Renders (top to bottom):
  1. Header (category name + subtitle)
  2. Aggregate graph (PMChart in 'aggregate' mode) -- **omitted when `aggregateApplicable === false`**
  3. Per-session graph grid (PMChart in 'mini' mode per session) -- auto-layout grid
  4. Duration label ("60 seconds")
  5. PMStatsGrid (category-scoped)
  6. PMSessionTable (category-scoped)

### PMChart.tsx (REPLACED)
- Supports two modes via `ChartMode`:
  - `aggregate`: Large, with horizontal grid lines, Y-axis labels, current value overlay
  - `mini`: Compact, no grid lines, session label + value overlay
- Renders filled-area line chart using chartRenderer pure functions
- Emits hover coordinates via `onHover(hoverData)` / `onHoverEnd()` callbacks
- Renders crosshair when hover state matches this canvas

### PMTooltip.tsx (NEW)
- Pure presentation: positioned at hover coordinates
- Shows: formatted value (bold, category color) + time offset (muted)
- Border color matches category line color
- Flips position near edges

### PMStatsGrid.tsx (NEW)
- 2-column, 3-row grid
- Content driven by `MetricCategory.statsConfig`
- Receives computed stats values as a record

### PMSessionTable.tsx (NEW)
- Columns driven by `MetricCategory.sessionColumns`
- Rows from per-session data, sorted by primary metric descending
- Urgency coloring on context-related values

## Production File Estimate

| Category | New Files | Modified Files | Removed Files |
|---|---|---|---|
| Domain (pure) | 2 | 1 | 0 |
| Adapters (effect) | 0 | 1 | 0 |
| Views (React) | 5 | 1 (replaced) | 3 |
| Entry/wiring | 0 | 2 | 0 |
| **Total** | **7** | **5** | **3** |

12 files touched, 3 removed. Net new: 9 production files.
Roadmap step target: <= 22 steps (9 * 2.5).
