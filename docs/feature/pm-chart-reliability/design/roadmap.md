# Implementation Roadmap: pm-chart-reliability

## Estimated Production Files

| File | Change Type |
|---|---|
| `PMChart.tsx` | Rewrite (canvas-based) |
| `multiSessionStore.ts` | Modify (MultiWindowBuffer integration) |
| `PMDetailPane.tsx` | Modify (window-aware buffer selection) |
| `PMTooltip.tsx` | Minor modify (containerWidth) |
| `package.json` | Modify (remove uPlot) |

**5 production files. 6 steps. Ratio: 6/5 = 1.2** (within 2.5 limit)

## Roadmap

```yaml
roadmap:
  feature: "pm-chart-reliability"
  paradigm: "functional"
  total_steps: 6

  phases:
    - id: "01"
      title: "Wire multi-window buffers into store"
      steps:
        - id: "01-01"
          title: "Integrate MultiWindowBuffer into multiSessionStore"
          description: "Replace single TimeSeriesBuffer per category with MultiWindowBuffer. Delegate appends to appendMultiWindowSample. Expose window-aware getters."
          acceptance_criteria:
            - "appendSessionSample feeds all three window buffers (1m/5m/15m) per category"
            - "getAggregateWindowBuffer(categoryId, windowId) returns buffer for specified window"
            - "getSessionWindowBuffer(sessionId, categoryId, windowId) returns session-specific window buffer"
            - "Existing getAggregateBuffer and getSessionBuffer continue to work (backward compat)"
          architectural_constraints:
            - "Import and compose multiWindowSampler pure functions"
            - "No new mutable state patterns -- follow existing Map-based approach"

    - id: "02"
      title: "Canvas-based chart rendering"
      steps:
        - id: "02-01"
          title: "Replace uPlot with canvas renderer in PMChart"
          description: "Rewrite PMChart to render on HTML Canvas using existing domain functions. Follow OscilloscopeView DPI pattern."
          acceptance_criteria:
            - "Chart displays visible line when samples array is non-empty"
            - "Chart area is DPR-scaled (no blurry rendering at 125%/150% DPI)"
            - "Gradient fill renders below the line trace"
            - "Grid lines render with dashed stroke matching theme"
            - "Chart resizes correctly when container dimensions change"
          architectural_constraints:
            - "Use prepareFilledAreaPoints from chartRenderer for coordinates"
            - "Use computeCanvasDimensions from oscilloscope for sizing"
            - "DPR handling: canvas.width = cssW * dpr, ctx.scale(dpr, dpr)"

        - id: "02-02"
          title: "Canvas hover, hit-test, and crosshair"
          description: "Add mousemove handler with hit-test and crosshair rendering. Emit HoverData using clientX/clientY."
          acceptance_criteria:
            - "Hovering over chart shows vertical crosshair line at cursor X position"
            - "Crosshair aligns within 2px of cursor at 100%, 125%, and 150% DPI"
            - "HoverData emitted with correct sample index, value, and time offset"
            - "Crosshair and hover data clear on mouseleave"
          architectural_constraints:
            - "Use computeHitTest from chartRenderer for index resolution"
            - "Use computeCrosshairPosition for crosshair coordinates"
            - "Capture clientX/clientY from MouseEvent (not canvas-relative)"

    - id: "03"
      title: "Wire time windows through view layer"
      steps:
        - id: "03-01"
          title: "PMDetailPane selects buffer by active time window"
          description: "Replace fixed buffer access with window-aware buffer selection from multiSessionStore."
          acceptance_criteria:
            - "Clicking 5m button changes chart data to 5-minute buffer samples"
            - "Clicking 1m returns to high-resolution 1-minute data"
            - "Duration label updates to match selected window"
            - "Per-session charts also use window-appropriate buffers"
          architectural_constraints:
            - "Use getAggregateWindowBuffer(categoryId, windowId)"
            - "Use getSessionWindowBuffer for per-session charts"

    - id: "04"
      title: "Empty state and session lifecycle"
      steps:
        - id: "04-01"
          title: "Empty state display and session end handling"
          description: "Show empty-state message when no sessions active. Handle session removal without chart disruption."
          acceptance_criteria:
            - "Empty-state message appears when no active sessions exist"
            - "Ending a session removes its mini chart without disrupting others"
            - "Aggregate chart continues updating after session ends"
          architectural_constraints:
            - "Empty state is a view-layer concern in PMDetailPane"

    - id: "05"
      title: "Tooltip edge handling and cleanup"
      steps:
        - id: "05-01"
          title: "Tooltip positioning accuracy and uPlot removal"
          description: "Verify tooltip edge-flip with window.innerWidth. Remove uPlot dependency from package.json."
          acceptance_criteria:
            - "Tooltip appears within 16px of cursor at all DPI settings"
            - "Tooltip flips to left side near right viewport edge"
            - "uPlot removed from package.json dependencies"
            - "No uPlot imports remain in codebase"
          architectural_constraints:
            - "PMTooltip uses window.innerWidth for edge calculation"

  implementation_scope:
    production_files:
      - "src/plugins/norbert-usage/views/PMChart.tsx"
      - "src/plugins/norbert-usage/adapters/multiSessionStore.ts"
      - "src/plugins/norbert-usage/views/PMDetailPane.tsx"
      - "src/plugins/norbert-usage/views/PMTooltip.tsx"
      - "package.json"
    domain_files_reused:
      - "src/plugins/norbert-usage/domain/chartRenderer.ts"
      - "src/plugins/norbert-usage/domain/oscilloscope.ts"
      - "src/plugins/norbert-usage/domain/multiWindowSampler.ts"
      - "src/plugins/norbert-usage/domain/timeSeriesSampler.ts"

  validation:
    step_ratio: 1.2
    step_ratio_limit: 2.5
    status: "PASS"
```

## Step-to-Story Traceability

| Step | User Story | Gherkin Scenarios Covered |
|---|---|---|
| 01-01 | US-PMR-03 | Time window infrastructure (prerequisite) |
| 02-01 | US-PMR-01 | Aggregate chart shows data, chart line advances, per-session charts |
| 02-02 | US-PMR-02 | Crosshair aligns, tooltip near cursor, tooltip disappears on leave |
| 03-01 | US-PMR-03 | 5m/15m/session window shows wider data, return to 1m preserves resolution |
| 04-01 | US-PMR-01 | Empty state, chart continues after session ends |
| 05-01 | US-PMR-02 | Tooltip flips near edge, DPI accuracy; cleanup |
