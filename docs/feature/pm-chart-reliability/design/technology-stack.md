# Technology Stack: pm-chart-reliability

## Retained Technologies

| Technology | Version | License | Rationale |
|---|---|---|---|
| React | 18.x | MIT | Existing framework, component model for view layer |
| TypeScript | 5.x | Apache-2.0 | Existing language, algebraic types for domain model |
| Tauri | 2.x | MIT/Apache-2.0 | Existing desktop shell, no changes needed |
| HTML Canvas 2D API | Browser built-in | N/A | Direct rendering, proven in OscilloscopeView |

## Removed Technologies

| Technology | Version | License | Rationale for Removal |
|---|---|---|---|
| uPlot | 1.6.32 | MIT | Root cause of blank charts (x-scale mismanagement), opaque DPI handling causing crosshair offset on Windows/Tauri. Canvas rendering via existing domain functions is proven in the same codebase. See ADR-029. |

## No New Dependencies Added

This feature removes a dependency (uPlot) and adds none. All rendering uses browser-native Canvas 2D API. All coordinate computation uses existing pure TypeScript domain functions.

## Reused Internal Modules

| Module | Functions Used | Purpose |
|---|---|---|
| `chartRenderer.ts` | `prepareFilledAreaPoints`, `computeHitTest`, `computeCrosshairPosition`, `prepareHorizontalGridLines` | Coordinate mapping for PM charts |
| `oscilloscope.ts` | `computeCanvasDimensions`, `computeGridLines`, `computeHorizontalGridLines` | Canvas sizing and grid line computation |
| `multiWindowSampler.ts` | `createMultiWindowBuffer`, `appendMultiWindowSample`, `getActiveWindowSamples` | Multi-resolution time-series buffering |
| `timeSeriesSampler.ts` | `createBuffer`, `appendSample`, `getSamples` | Ring buffer operations |
