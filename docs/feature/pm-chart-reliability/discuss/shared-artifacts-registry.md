# Shared Artifacts Registry: pm-chart-reliability

## Artifacts

### aggregateBuffer.samples

- **Source of truth**: `multiSessionStore.getAggregateBuffer(categoryId).samples`
- **Consumers**:
  - `PMChart` (aggregate mode) -- renders as uPlot time-series line
  - `PMSidebar` sparklines -- renders mini preview per category
  - `PMStatsGrid` -- derives peak, avg, current from buffer
  - `PMDetailPane.deriveStatsFromBuffer()` -- computes display metrics
- **Owner**: `multiSessionStore` adapter
- **Integration risk**: HIGH -- if buffer is empty when sessions are active, all
  charts render blank. This is the current primary failure mode.
- **Validation**: `aggregateBuffer.samples.length > 0` whenever
  `multiSessionStore.getSessions().length > 0` and at least one session event
  has been processed.

### sessionBuffer.samples

- **Source of truth**: `multiSessionStore.getSessionBuffer(sessionId, categoryId).samples`
- **Consumers**:
  - `PMChart` (mini mode) -- per-session chart in grid
  - `PMDetailPane.buildSessionRows()` -- latest value for session table
- **Owner**: `multiSessionStore` adapter
- **Integration risk**: HIGH -- per-session data feeds aggregate computation.
  If session buffers are empty, aggregate will also be zero.
- **Validation**: After `appendSessionSample()` call, the session buffer for
  each category should have one more sample than before.

### HoverState

- **Source of truth**: `PerformanceMonitorView` React state via `onHoverChange`
- **Consumers**:
  - `PMTooltip` -- renders floating tooltip at `(tooltipX, tooltipY)`
  - `PMChart` (via `hoverIndex` prop) -- synchronizes crosshair across charts
- **Owner**: `PerformanceMonitorView` component
- **Integration risk**: MEDIUM -- tooltip positioning depends on correct
  `clientX`/`clientY` values. DPI scaling can distort `uPlot.cursor.left/top`
  but should not affect `MouseEvent.clientX/clientY`.
- **Validation**: `tooltipX` and `tooltipY` are `MouseEvent.clientX/clientY`
  values, never derived from uPlot internal coordinates.

### selectedWindow (TimeWindowId)

- **Source of truth**: `PerformanceMonitorView` React state
- **Consumers**:
  - `PMTimeWindowSelector` -- button active state
  - `PMDetailPane` -- selects which buffer to pass to `PMChart`
  - `PMDetailPane.formatDurationLabel()` -- label text below chart
- **Owner**: `PerformanceMonitorView` component
- **Integration risk**: HIGH -- currently `selectedWindow` changes the button
  highlight but does NOT change the data buffer. The `multiWindowSampler`
  domain logic exists but is not wired into `multiSessionStore`.
- **Validation**: Changing `selectedWindow` from "1m" to "5m" must result in
  `PMChart` receiving a different `samples` array with different length and
  time range.

### selectedCategory (MetricCategoryId)

- **Source of truth**: `PerformanceMonitorView` React state
- **Consumers**:
  - `PMSidebar` -- row highlight
  - `PMDetailPane` -- buffer selection, header, stats, formatting
  - `PMChart` -- color, yMax, formatValue via category config
- **Owner**: `PerformanceMonitorView` component
- **Integration risk**: LOW -- category switching works at the UI level;
  inherits data-display bugs from buffer/chart integration.
- **Validation**: Switching category changes chart color and stat labels.

### devicePixelRatio

- **Source of truth**: `window.devicePixelRatio` (browser/OS)
- **Consumers**:
  - `PMChart` uPlot fill gradient (`u.bbox` values divided by `devicePixelRatio`)
  - uPlot internal cursor positioning
  - `PMChart` `pxAlign` option
- **Owner**: OS / display settings
- **Integration risk**: HIGH -- Windows DPI scaling (125%, 150%) causes
  `uPlot.cursor.left/top` to be in CSS pixels while `u.bbox` is in device
  pixels. Mismatch causes crosshair offset. Current `pxAlign: 0` may
  interact with this.
- **Validation**: Crosshair and tooltip are correctly positioned at 100%,
  125%, and 150% DPI scaling.

## Integration Checkpoints

| Checkpoint | Steps | What to verify |
|---|---|---|
| Data pipeline to chart | 1 | `hookProcessor` -> `appendSessionSample` -> subscriber -> React render -> `uPlot.setData()` with non-empty Float64Array |
| Time window to buffer | 3 | `selectedWindow` change -> different buffer from `multiWindowSampler` -> `PMChart` receives different samples |
| Mouse to tooltip | 2 | `MouseEvent.clientX/clientY` -> `HoverState.tooltipX/tooltipY` -> `PMTooltip` CSS fixed position |
| DPI to cursor | 2 | `devicePixelRatio` accounted for in uPlot cursor and gradient calculations |
