# Data Models: norbert-performance-monitor-v2

## Existing Types (Reused Unchanged)

| Type | Source | Usage in PM v2 |
|---|---|---|
| SessionMetrics | `domain/types.ts` | Per-session metrics snapshot |
| RateSample | `domain/types.ts` | Time-series data point (tokenRate, costRate) |
| TimeSeriesBuffer | `domain/types.ts` | Ring buffer for chart rendering |
| OscilloscopeStats | `domain/types.ts` | Stats computation (peak, avg) |
| AggregateMetrics | `domain/types.ts` | Cross-session aggregate |
| SessionSummary | `domain/types.ts` | Per-session breakdown data |
| TimeWindowId | `domain/types.ts` | '1m' \| '5m' \| '15m' \| 'session' |
| TimeWindowConfig | `domain/types.ts` | Window duration/resolution config |
| CompactionEstimate | `domain/types.ts` | Time-to-compaction estimate |
| Urgency | `domain/types.ts` | 'normal' \| 'amber' \| 'red' |
| MultiWindowBuffer | `domain/multiWindowSampler.ts` | Per-window ring buffers |

## Types to Remove or Deprecate

| Type | Reason |
|---|---|
| PMViewMode | v1 aggregate/session-detail navigation replaced by category selection |
| AgentMetrics | Agent-level breakdown deferred (blocked by Claude Code hook format) |
| SessionDetailData | v1 drill-down composition type replaced by category-scoped rendering |

## New Domain Types

### MetricCategoryId

Discriminated union for the four metric categories.

```
type MetricCategoryId = 'tokens' | 'cost' | 'agents' | 'context'
```

### MetricCategory

Configuration for a single metric category. Const data -- no runtime construction.

| Field | Type | Description |
|---|---|---|
| id | MetricCategoryId | Category identifier |
| label | string | Display label (e.g., "Tokens/s") |
| color | string | Line color hex (e.g., "#00e5cc") |
| yMax | number | Default Y-axis maximum |
| yLabels | ReadonlyArray\<string\> | Y-axis label strings at grid intervals |
| aggregateApplicable | boolean | Whether aggregate graph is meaningful |
| aggregateStrategy | 'sum' \| 'none' | How to aggregate across sessions |
| formatValue | (value: number) => string | Format a raw value for display |
| statsConfig | ReadonlyArray\<StatCellConfig\> | Stats grid cell definitions |
| sessionColumns | ReadonlyArray\<string\> | Session table column headers |

### StatCellConfig

Configuration for a single cell in the stats grid.

| Field | Type | Description |
|---|---|---|
| label | string | Stat label (e.g., "Peak", "Sessions") |
| key | string | Data key to look up |
| format | (value: number \| string) => string | Value formatter |

### CategorySample

Per-category sample point extending RateSample for multi-category buffers.

| Field | Type | Description |
|---|---|---|
| timestamp | number | Sample time (ms epoch) |
| value | number | Category-specific value (tok/s, $/min, count, %) |

### PerSessionCategoryBuffers

Per-session, per-category time-series storage.

| Field | Type | Description |
|---|---|---|
| sessionId | string | Session identifier |
| buffers | ReadonlyMap\<MetricCategoryId, TimeSeriesBuffer\> | One buffer per category |

### HoverState

Shared hover state for crosshair + tooltip rendering.

| Field | Type | Description |
|---|---|---|
| active | boolean | Whether hover is active |
| canvasId | string | Which chart canvas is being hovered |
| mouseX | number | Mouse X relative to canvas |
| sampleIndex | number | Nearest sample index (computed by hit-test) |
| value | number | Sample value at index |
| formattedValue | string | Formatted display string |
| timeOffset | string | Time offset string (e.g., "23s ago") |
| color | string | Category line color for tooltip border |
| tooltipX | number | Tooltip screen X position |
| tooltipY | number | Tooltip screen Y position |

### ChartMode

Discriminated union for chart rendering mode.

```
type ChartMode = 'aggregate' | 'mini'
```

- `aggregate`: Large chart with Y-axis labels, horizontal grid lines, current value overlay
- `mini`: Compact per-session chart, no grid lines, session label + value overlay

### CategoryStats

Pre-computed stats for the stats grid, keyed by category.

| Category | Stats Keys |
|---|---|
| tokens | peak, sessions, avg, totalTokens, costRate, toolCalls |
| cost | current, sessions, sessionTotal, totalCost, avgCostPerToken, model |
| agents | active, sessions, peak, totalSpawned, avgPerSession, toolCalls |
| context | current, remaining, maxTokens, model, urgency, compressions |

These are computed by pure functions from AggregateMetrics + SessionMetrics arrays.

## Extended MultiSessionStore Interface

Current (preserved):
```
addSession(id) | removeSession(id) | updateSession(id, metrics) | getSessions() | getSession(id)
```

New methods:
```
appendSessionSample(sessionId, categorySamples: Record<MetricCategoryId, number>) -> void
getSessionBuffer(sessionId, categoryId) -> TimeSeriesBuffer | undefined
getAggregateBuffer(categoryId) -> TimeSeriesBuffer
subscribe(callback: () => void) -> () => void  // returns unsubscribe
```

## Sidebar Display Data

Computed from aggregate buffers and current metrics. Pure function output.

| Field | Type | Description |
|---|---|---|
| categoryId | MetricCategoryId | Category |
| currentValue | string | Formatted current value |
| sparklineBuffer | TimeSeriesBuffer | Last 60s buffer for sparkline canvas |
| isSelected | boolean | Whether this category is active |
