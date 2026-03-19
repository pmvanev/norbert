# Roadmap: norbert-performance-monitor-v2

## Metadata

- **Feature**: norbert-performance-monitor-v2
- **Paradigm**: Functional (types-first, pure core, effect shell)
- **Estimated production files**: 9 net new + 5 modified = 14 touched
- **Step ratio check**: 9 steps / 14 files = 0.64 (well under 2.5 limit)

## Rejected Simple Alternatives

### Alternative 1: CSS-only layout patch on v1 view
- What: Rearrange v1 PerformanceMonitorView with sidebar CSS
- Expected Impact: ~40% (layout changes, no per-category graphs or sparklines)
- Why Insufficient: v1 renders all metrics in one chart. Category-scoped graphs require new state management and per-category buffers.

### Alternative 2: Add category tabs to v1 without sidebar
- What: Tab buttons in v1 to switch between metric categories
- Expected Impact: ~60% (category isolation, but no simultaneous overview)
- Why Insufficient: No sidebar sparklines. Loses at-a-glance visibility of all categories -- the core value of the Task Manager pattern.

## Phases

### Phase 01: Domain Types and Category Configuration

#### Step 01-01: Metric category types and configuration
- **Description**: Define MetricCategoryId, MetricCategory, CategorySample, HoverState, ChartMode types. Create categoryConfig with const array of 4 categories including formatting, colors, aggregate applicability, stats config, and session table columns.
- **AC**:
  - 4 metric categories defined with distinct colors and Y-axis config
  - Context category marked as aggregate-not-applicable
  - Each category has value formatter producing display strings
  - Stats config and session column definitions present per category
- **Architectural constraints**:
  - Pure const data, no runtime construction
  - Reuse existing Urgency, TimeWindowId types

#### Step 01-02: Chart renderer pure functions
- **Description**: Filled-area line chart renderer composing with oscilloscope functions. Adds gradient fill, horizontal grid lines, Y-axis labels, current value overlay, crosshair, hit-test, and sparkline rendering.
- **AC**:
  - Filled-area chart renders line with gradient fill beneath
  - Horizontal grid lines drawn at Y-axis intervals
  - Hit-test maps mouseX to nearest sample index and value
  - Sparkline renders line-only (no fill, no grid, no labels)
  - Crosshair renders vertical line + dot at specified index
- **Architectural constraints**:
  - All functions pure (receive canvas context as parameter)
  - Reuse prepareWaveformPoints and computeCanvasDimensions from oscilloscope.ts

### Phase 02: Adapter Extension

#### Step 02-01: Extend MultiSessionStore with per-category buffers
- **Description**: Add per-session per-category TimeSeriesBuffers and aggregate category buffers to MultiSessionStore. Add subscribe/notify, appendSessionSample, getSessionBuffer, getAggregateBuffer methods.
- **AC**:
  - Per-session samples appendable for each of 4 categories
  - Aggregate buffers auto-recomputed on sample append (sum for tokens/cost/agents)
  - Context aggregate buffer not populated (non-applicable)
  - Subscribers notified on state change
  - Existing addSession/removeSession/updateSession/getSessions unchanged
- **Architectural constraints**:
  - Effect boundary -- mutable state cells
  - Ring buffers use existing TimeSeriesBuffer/appendSample from timeSeriesSampler

#### Step 02-02: Extend hookProcessor to feed category samples
- **Description**: After metrics update, compute per-category sample values and call appendSessionSample on the extended MultiSessionStore.
- **AC**:
  - Token rate and cost rate samples derived from instantaneous rate computation
  - Agent count and context percentage samples derived from updated SessionMetrics
  - Samples appended to MultiSessionStore per session per category on each event
  - Existing broadcast-session pipeline unchanged
- **Architectural constraints**:
  - Sample computation reuses existing instantaneousRate functions

### Phase 03: View Layer -- Layout Shell

#### Step 03-01: PMContainerView with sidebar+detail layout
- **Description**: Replace PerformanceMonitorView with master-detail layout shell managing selectedCategory, selectedWindow, and hoverState. Subscribes to MultiSessionStore. Renders PMSidebar (left) and PMDetailPane (right).
- **AC**:
  - Sidebar+detail dual-pane layout renders with correct proportions
  - Category selection updates detail pane content
  - Time window selection persists across category switches
  - View subscribes to MultiSessionStore and re-renders on data updates
  - sec-hdr title area showing "Performance Monitor"
- **Architectural constraints**:
  - Reuse PMTimeWindowSelector unchanged
  - Sidebar fixed 180px, detail pane flex

#### Step 03-02: PMSidebar with sparklines
- **Description**: Category list where each row shows label, current value, and sparkline canvas. Selected category has accent-colored left border.
- **AC**:
  - 4 category rows rendered with correct labels and colors
  - Current value updates from aggregate buffer latest sample
  - Sparkline canvas renders last 60s line using chartRenderer
  - Selected category highlighted with left border in category color
  - Clicking a row emits category selection
- **Architectural constraints**:
  - Sparkline canvases update at 1Hz (data sample rate)
  - Sparkline uses chartRenderer sparkline function (line only, no fill)

### Phase 04: View Layer -- Detail Pane Components

#### Step 04-01: PMChart with filled-area rendering and hover
- **Description**: Replace PMChart with filled-area canvas chart supporting aggregate and mini modes. Emits hover coordinates for tooltip. Renders crosshair when hovered.
- **AC**:
  - Aggregate mode: Y-axis labels, horizontal grid lines, current value overlay, gradient fill
  - Mini mode: no grid lines, session label + value overlay, gradient fill
  - Hover emits sample index, value, and time offset to container
  - Crosshair renders at hovered position (vertical line + dot)
  - Canvas sizes responsively via ResizeObserver
- **Architectural constraints**:
  - Rendering delegates to chartRenderer pure functions
  - Hover data computed by domain hit-test function

#### Step 04-02: PMDetailPane with aggregate graph, per-session grid, stats, table
- **Description**: Detail pane rendering all category-scoped sections. Aggregate graph omitted when category is non-aggregatable. Per-session grid auto-arranges (2 cols for 2 sessions, 2x2 for 3-4, 3 cols for 5+). Hidden when single session active.
- **AC**:
  - Aggregate graph visible for tokens/cost/agents categories
  - Aggregate graph omitted for context; per-session graphs render larger
  - Per-session grid shows one mini-graph per active session with shared Y-axis scale
  - Per-session grid hidden when only 1 session active
  - Stats grid and session table render below graphs
- **Architectural constraints**:
  - Content driven by MetricCategory configuration
  - All per-session graphs share same yMax for visual comparison

#### Step 04-03: PMTooltip, PMStatsGrid, PMSessionTable
- **Description**: Floating tooltip, 2-column stats grid, and per-session breakdown table -- all driven by category configuration.
- **AC**:
  - Tooltip shows formatted value + time offset, positioned near cursor
  - Tooltip border color matches category line color
  - Stats grid shows 6 cells (2x3) with category-specific labels and values
  - Session table columns change per selected category
  - Session rows sorted by primary metric descending
- **Architectural constraints**:
  - Tooltip is DOM element (not canvas) for edge handling
  - Stats content and session columns driven by MetricCategory config

### Phase 05: Integration and Polish

#### Step 05-01: Wire PMContainerView into plugin registration and App.tsx
- **Description**: Update index.ts to wire extended MultiSessionStore. Ensure PMContainerView renders when "performance-monitor" view is selected. Remove v1 view imports (PMAggregateGrid, PMSessionDetail). Clean up unused v1 types.
- **AC**:
  - Performance Monitor v2 renders in the performance-monitor view slot
  - Extended MultiSessionStore wired with per-category buffer initialization
  - v1 view files (PMAggregateGrid, PMSessionDetail) removed
  - Existing views (Oscilloscope, Gauge Cluster, Dashboard) unchanged
  - PMViewMode, AgentMetrics, SessionDetailData types removed from types.ts
- **Architectural constraints**:
  - No changes to existing view registrations
  - Backward compatibility with floating panel configurations

## Implementation Scope

| Phase | Steps | Files Touched |
|---|---|---|
| 01 Domain | 2 | types.ts, categoryConfig.ts (new), chartRenderer.ts (new) |
| 02 Adapter | 2 | multiSessionStore.ts, hookProcessor.ts |
| 03 View Shell | 2 | PerformanceMonitorView.tsx (replaced), PMSidebar.tsx (new) |
| 04 Detail Pane | 3 | PMChart.tsx (replaced), PMDetailPane.tsx (new), PMTooltip.tsx (new), PMStatsGrid.tsx (new), PMSessionTable.tsx (new) |
| 05 Integration | 1 | index.ts, remove PMAggregateGrid.tsx, PMSessionDetail.tsx, types.ts cleanup |
| **Total** | **9** | **14 files** |
