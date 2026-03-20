# Data Models: pm-chart-reliability

## Existing Types (No Changes)

These types are already defined in `domain/types.ts` and are sufficient:

- `RateSample` -- `{ timestamp, tokenRate, costRate }`
- `TimeSeriesBuffer` -- `{ samples, capacity, headIndex }`
- `TimeWindowId` -- `"1m" | "5m" | "15m" | "session"`
- `MetricCategoryId` -- `"tokens" | "cost" | "agents" | "context"`
- `HoverState` -- `{ active, canvasId, mouseX, sampleIndex, value, formattedValue, timeOffset, color, tooltipX, tooltipY }`
- `CategorySample` -- `{ timestamp, value }` (defined but unused; see note below)

## Existing Types in multiWindowSampler.ts (No Changes)

- `MultiWindowBuffer` -- `{ windows: Record<string, WindowState> }`
- `WindowState` -- `{ buffer: TimeSeriesBuffer, lastAppendedAt: number, sampleIntervalMs: number }`
- `TimeWindowConfig` -- `{ durationMs, label, sampleIntervalMs, bufferCapacity }`

## Store Interface Changes

### multiSessionStore.ts Port Extension

Two new methods on the `MultiSessionStore` interface:

```
getAggregateWindowBuffer(categoryId, windowId) -> TimeSeriesBuffer
getSessionWindowBuffer(sessionId, categoryId, windowId) -> TimeSeriesBuffer | undefined
```

Existing `getAggregateBuffer(categoryId)` and `getSessionBuffer(sessionId, categoryId)` can be retained as aliases for the "1m" window or deprecated.

### Internal State Change

Current internal state per session:
```
sessionBuffers: Map<string, Map<MetricCategoryId, TimeSeriesBuffer>>
aggregateBuffers: Map<MetricCategoryId, TimeSeriesBuffer>
```

After change:
```
sessionBuffers: Map<string, Map<MetricCategoryId, MultiWindowBuffer>>
aggregateBuffers: Map<MetricCategoryId, MultiWindowBuffer>
```

Each `TimeSeriesBuffer` becomes a `MultiWindowBuffer` containing three parallel ring buffers (1m/5m/15m). The `appendSessionSample` logic changes from calling `appendSample` directly to calling `appendMultiWindowSample`.

## Note on CategorySample vs RateSample

The codebase has a semantic mismatch documented in `multiSessionStore.ts`: all category values are stored in the `tokenRate` field of `RateSample`, with `costRate` set to 0. A `CategorySample` type exists in `types.ts` but is unused. This mismatch is pre-existing and out of scope for this feature. The crafter may choose to address it during REFACTOR if it improves clarity.
