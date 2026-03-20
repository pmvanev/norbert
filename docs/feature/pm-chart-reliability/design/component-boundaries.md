# Component Boundaries: pm-chart-reliability

## Boundary Map

```
+-- Domain Layer (pure, no IO) ----------------------------------------+
|                                                                       |
|  chartRenderer.ts      -- coordinate mapping, hit-test, crosshair     |
|  oscilloscope.ts       -- waveform points, grid lines, canvas dims    |
|  multiWindowSampler.ts -- multi-resolution ring buffers               |
|  timeSeriesSampler.ts  -- ring buffer core (create, append, get)      |
|  categoryConfig.ts     -- category metadata, format functions         |
|  types.ts              -- algebraic data types                        |
|                                                                       |
+-----------------------------------------------------------------------+
          |                              |
          | pure function calls          | pure function calls
          v                              v
+-- Adapter Layer (effects at edges) ---+   +-- View Layer (React) -----+
|                                       |   |                           |
|  multiSessionStore.ts                 |   |  PerformanceMonitorView   |
|    - per-session MultiWindowBuffers   |   |    (shell, state, sub)    |
|    - aggregate MultiWindowBuffers     |   |                           |
|    - subscriber notification          |   |  PMDetailPane             |
|                                       |   |    (layout, buffer sel)   |
+---------------------------------------+   |                           |
          |                                  |  PMChart                  |
          | subscribe/notify                 |    (canvas renderer)      |
          v                                  |                           |
+-- Integration (hookProcessor) --------+   |  PMTooltip                |
|                                       |   |    (DOM tooltip)          |
|  hookProcessor.ts                     |   |                           |
|    (event -> categorySamples -> store)|   +---------------------------+
+---------------------------------------+
```

## Component Responsibilities

### Domain: chartRenderer.ts
- **Owns**: `prepareFilledAreaPoints`, `computeHitTest`, `computeCrosshairPosition`, `prepareHorizontalGridLines`, `formatTimeOffset`, `prepareSparklinePoints`
- **Boundary**: Input is samples + dimensions + yMax. Output is canvas coordinates. No canvas context access.
- **Change needed**: None. All needed functions exist.

### Domain: oscilloscope.ts
- **Owns**: `prepareWaveformPoints`, `computeGridLines`, `computeHorizontalGridLines`, `computeCanvasDimensions`, `formatRateOverlay`
- **Boundary**: Input is samples + dimensions. Output is canvas coordinates and grid positions.
- **Change needed**: None. PMChart reuses `computeCanvasDimensions` and `computeGridLines`.

### Domain: multiWindowSampler.ts
- **Owns**: `createMultiWindowBuffer`, `appendMultiWindowSample`, `getActiveWindowSamples`, `computeMultiWindowStats`, `resolveSessionWindowConfig`, `TIME_WINDOW_PRESETS`
- **Boundary**: Input is MultiWindowBuffer + RateSample. Output is new MultiWindowBuffer. Pure transformations.
- **Change needed**: None. Complete and tested.

### Adapter: multiSessionStore.ts
- **Owns**: Session lifecycle, per-session buffers, aggregate computation, subscriber management
- **Boundary**: Mutable state at the effect edge. Exposes immutable snapshots via getters.
- **Change needed**: Replace single `TimeSeriesBuffer` per category with `MultiWindowBuffer` per category. Add `getAggregateWindowBuffer(categoryId, windowId)` and `getSessionWindowBuffer(sessionId, categoryId, windowId)`. On `appendSessionSample`, delegate to `appendMultiWindowSample` for each category's MultiWindowBuffer.

### View: PMChart.tsx
- **Owns**: Canvas element lifecycle, DPI-correct rendering, mousemove -> HoverData emission
- **Boundary**: Receives `samples`, `field`, `color`, `mode`, `yMax`, callbacks. Renders canvas. Emits HoverData.
- **Change needed**: Rewrite from uPlot-based to canvas-based. Follow OscilloscopeView pattern: explicit `devicePixelRatio` handling, `ResizeObserver`, `setInterval` for periodic redraw. Use `prepareFilledAreaPoints` for line coordinates, `computeHitTest` for hover, `computeCrosshairPosition` for crosshair.

### View: PMDetailPane.tsx
- **Owns**: Layout decisions, buffer selection, hover handler creation, stats derivation
- **Boundary**: Receives store + selectedCategory + selectedWindow. Passes samples to PMChart.
- **Change needed**: Use `multiSessionStore.getAggregateWindowBuffer(categoryId, windowId)` instead of `getAggregateBuffer(categoryId)`. Use `getSessionWindowBuffer` for per-session charts.

### View: PMTooltip.tsx
- **Owns**: Tooltip positioning, edge-flip logic, display formatting
- **Boundary**: Receives HoverState, renders DOM element
- **Change needed**: Minor -- use `window.innerWidth` for containerWidth default

## Dependency Direction

All dependencies point inward (domain has no imports from adapter/view):

```
View -> Domain (pure function calls)
View -> Adapter (store reads)
Adapter -> Domain (buffer operations)
hookProcessor -> Adapter (store writes)
hookProcessor -> Domain (rate computation)
```

No circular dependencies. No domain dependency on React, canvas, or uPlot.
