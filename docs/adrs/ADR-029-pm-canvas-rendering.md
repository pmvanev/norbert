# ADR-029: Replace uPlot with Canvas Rendering for Performance Monitor Charts

## Status

Proposed

## Context

The Performance Monitor v2 charts use uPlot 1.6.32 for time-series rendering. Three bugs are present:

1. **Blank charts**: Charts render empty rectangles despite active sessions generating data. The data pipeline is functional (oscilloscope canvas view shows data correctly from the same store).
2. **Crosshair/tooltip offset**: On Windows 11 with DPI scaling (125-150%), the crosshair appears ~50px offset from the cursor. Multiple fix attempts using `pxAlign`, `u.over` vs `u.root`, and raw `clientX/clientY` have not resolved the issue.
3. **Time windows non-functional**: Buttons highlight but chart data does not change (separate integration gap, but rendering approach affects the solution).

**Root cause analysis**: uPlot's `scales.x: { time: false }` combined with epoch-second timestamps creates an enormous x-range where data points compress to sub-pixel widths. uPlot's internal DPI handling via `pxAlign` and `u.bbox` interacts unpredictably with Tauri's webview on Windows. The library's internal coordinate system is opaque, making debugging difficult.

**Existing proven alternative**: `OscilloscopeView.tsx` renders identical time-series data on HTML Canvas using explicit `devicePixelRatio` handling and pure domain functions from `chartRenderer.ts` and `oscilloscope.ts`. It works correctly at all DPI settings.

**Quality attribute drivers**: Correctness (charts must show real data), maintainability (current design has proven hard to debug), responsiveness (tooltip must track cursor).

**Constraints**: Solo developer, functional paradigm, existing domain functions cover all needed computation.

## Decision

Replace uPlot with direct HTML Canvas 2D rendering in PMChart, following the pattern established by OscilloscopeView.

**Mechanism**:
1. PMChart creates an HTML Canvas element with explicit DPR scaling (`canvas.width = cssW * dpr; ctx.scale(dpr, dpr)`)
2. On each render frame, calls existing pure domain functions:
   - `prepareFilledAreaPoints(samples, dimensions, yMax)` for line coordinates
   - `computeGridLines(dimensions, windowDurationMs, gridIntervalMs)` for vertical grid
   - `computeHorizontalGridLines(dimensions, count)` for horizontal grid
3. Draws on canvas: grid lines, line trace, gradient fill area
4. Mouse handling: `mousemove` on canvas captures `clientX/clientY` (DPI-independent), calls `computeHitTest(mouseX, canvasWidth, bufferLength, padding)` to resolve sample index, emits `HoverData`
5. Crosshair rendering: `computeCrosshairPosition(sampleIndex, value, bufferLength, yMax, dimensions)` provides x/y for vertical line + dot
6. ResizeObserver for responsive sizing (same as OscilloscopeView)
7. 1Hz setInterval for periodic redraw (same as current CHART_REFRESH_MS)

## Alternatives Considered

### Alternative 1: Fix uPlot configuration
- **What**: Correct x-scale (use `time: true` or manual range), add explicit DPI compensation to cursor position, tune `pxAlign`
- **Expected impact**: ~80% of blank chart issue; uncertain for DPI offset
- **Why rejected**: Multiple prior fix attempts for DPI offset have failed. uPlot's internal coordinate system is opaque -- debugging requires reading library source. The `pxAlign` and `u.bbox` DPI interaction is undocumented for Tauri webview. Time invested in library debugging has low confidence of permanent resolution; each uPlot update may regress.

### Alternative 2: Replace uPlot with Chart.js or Recharts
- **What**: Swap to a different charting library with potentially better DPI handling
- **Expected impact**: ~70% -- new library introduces unknown Tauri/DPI compatibility
- **Why rejected**: Adds a new dependency to replace a problematic dependency. The fundamental issue (library-internal coordinate systems interacting with Tauri webview DPI) may recur. The codebase already has a proven canvas rendering pattern. Adding a library when the non-library approach works is unnecessary complexity.

### Alternative 3: Use SVG-based rendering (e.g., D3 or Recharts SVG mode)
- **What**: Render charts as SVG elements instead of canvas
- **Expected impact**: ~90% for DPI (SVG is resolution-independent)
- **Why rejected**: SVG performance degrades with 600-900 data points updating at 1Hz. Canvas is the appropriate technology for frequently-updated dense line charts. SVG adds DOM node overhead per data point.

## Consequences

- **Positive**: Charts render correctly using the same proven pattern as OscilloscopeView
- **Positive**: DPI handling is explicit and under our control (not library-internal)
- **Positive**: All coordinate computation is pure, unit-testable domain functions that already exist
- **Positive**: Removes uPlot dependency (one fewer npm package, no CSS import)
- **Positive**: Single rendering approach across oscilloscope and PM charts improves maintainability
- **Positive**: Hit-test and crosshair logic are already implemented in `chartRenderer.ts`
- **Negative**: Loss of uPlot features not currently used (zoom, pan, multi-axis). Accepted: PM charts do not require these features.
- **Negative**: Canvas text rendering for axis labels is lower quality than DOM/SVG. Accepted: PM charts use `show: false` for axes already; labels are rendered as React DOM elements outside the canvas.
- **Negative**: Manual gradient fill implementation needed. Accepted: current PMChart already implements gradient via `ctx.createLinearGradient` in the uPlot fill function.
