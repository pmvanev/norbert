# Component Boundaries: norbert-usage Plugin

## Boundary Principle

Pure core / effect shell. All domain computation is pure functions (no side effects, no API calls, no mutable state). Effects are confined to adapters at the boundary.

```
+------------------------------------------------------------------+
|  norbert-usage plugin                                            |
|                                                                  |
|  +--------------------+    +-------------------------------+     |
|  | ADAPTERS (effects) |    | DOMAIN (pure functions)       |     |
|  |                    |    |                               |     |
|  | Event Source       |--->| Token Extractor               |     |
|  | Metrics State Store|<---| Pricing Model                 |     |
|  |                    |    | Metrics Aggregator            |     |
|  +--------------------+    | Time-Series Sampler           |     |
|                            | Burn Rate Calculator          |     |
|  +--------------------+    +-------------------------------+     |
|  | VIEWS (React)      |                                          |
|  |                    |    +-------------------------------+     |
|  | Gauge Cluster      |<---| Metrics State Store (read)    |     |
|  | Oscilloscope       |    +-------------------------------+     |
|  | Usage Dashboard    |                                          |
|  | Cost Ticker        |                                          |
|  +--------------------+                                          |
|                                                                  |
|  +--------------------+                                          |
|  | ENTRY POINT        |                                          |
|  | Plugin Entry       |  onLoad/onUnload, registration wiring   |
|  | Hook Processor     |  event dispatch to domain pipeline       |
|  +--------------------+                                          |
+------------------------------------------------------------------+
```

## Domain Layer (Pure Functions)

All functions in this layer are pure: given the same input, they always produce the same output with no side effects.

### Token Extractor
- **Responsibility**: Parse event payload JSON to extract token counts and model identifier
- **Input**: Raw event payload (unknown JSON structure)
- **Output**: `TokenUsage` value (inputTokens, outputTokens, model) or null if absent
- **Boundary rule**: Never queries database. Never accesses NorbertAPI. Pure transformation.

### Pricing Model
- **Responsibility**: Map (model, inputTokens, outputTokens) to dollar cost
- **Input**: `TokenUsage` value + pricing table (configuration data)
- **Output**: Cost in dollars as number
- **Boundary rule**: Pricing table is injected data, not fetched. No side effects.
- **Design note**: Pricing table is a plain data structure (record of model -> { inputRate, outputRate }). Updated via configuration, not hardcoded.

### Metrics Aggregator
- **Responsibility**: Fold a stream of events into an immutable `SessionMetrics` snapshot
- **Input**: Previous `SessionMetrics` + new event (with optional TokenUsage + cost)
- **Output**: New `SessionMetrics` snapshot
- **Boundary rule**: Pure fold function. Does not hold state. State is held by the adapter.
- **Metrics produced**: totalTokens, inputTokens, outputTokens, sessionCost, toolCallCount, activeAgentCount, contextWindowPct, sessionDuration, hookEventCount

### Time-Series Sampler
- **Responsibility**: Maintain a fixed-size ring buffer of rate samples for waveform rendering
- **Input**: Ring buffer (immutable array) + new sample (timestamp, tokenRate, costRate)
- **Output**: New ring buffer with sample appended (oldest evicted if full)
- **Boundary rule**: Pure function operating on immutable data. The "ring buffer" is a plain array that gets replaced, not mutated.
- **Configuration**: Buffer capacity = 600 (60s at 10Hz)

### Burn Rate Calculator
- **Responsibility**: Compute tokens-per-second over a rolling time window
- **Input**: Array of recent events with timestamps and token counts, window size in seconds
- **Output**: Rate value (tokens/second)
- **Boundary rule**: Pure computation over event array. Default window: 10 seconds.

## Adapter Layer (Effect Boundary)

### Event Source Adapter
- **Responsibility**: Provide events to the domain pipeline
- **Effects**: Calls `api.db.execute()` to query events table, or subscribes via `api.events` when available
- **Interface**: Exposes a subscribe pattern -- callers register callbacks for new events
- **Boundary rule**: Only component that calls NorbertAPI data methods. Translates API result types to domain types.

### Metrics State Store
- **Responsibility**: Hold the current `SessionMetrics` and time-series buffer, notify subscribers on change
- **Effects**: Mutable state reference (the single mutable cell in the plugin). Subscriber notification.
- **Interface**: `getMetrics()` returns current snapshot. `subscribe(callback)` registers listener. `update(newMetrics, newTimeSeries)` replaces state and notifies.
- **Boundary rule**: Only component that holds mutable state. Domain functions produce new values; this store holds them.

## View Layer (React Components)

All views are pure renderers: they receive metrics data and render it. No business logic in views.

### Gauge Cluster View
- **Input**: SessionMetrics snapshot (burnRate, contextPct, sessionCost, activeAgents, hookHealth, duration)
- **Renders**: 3 radial gauges (Tachometer, Fuel Gauge, RPM) + warning lights row + cost/clock
- **Registration**: `api.ui.registerView()` with `floatMetric: "session_cost"` for floating panel
- **Zone**: Floating panel or Secondary zone
- **Minimized state**: Pill showing session cost value

### Oscilloscope View
- **Input**: Time-series ring buffer (token rate + cost rate samples)
- **Renders**: Canvas-based dual-trace waveform, stats bar (peak, avg, total, window)
- **Registration**: `api.ui.registerView()` without primaryView
- **Zone**: Secondary zone or floating panel
- **Rendering**: requestAnimationFrame at ~10Hz, draws both traces on shared canvas

### Usage Dashboard View
- **Input**: SessionMetrics snapshot + 7-day cost history
- **Renders**: 6 metric cards (Running Cost, Token Count, Active Agents, Tool Calls, Context Window, Hook Health) + 7-day burn chart
- **Registration**: `api.ui.registerView()` with `primaryView: true`
- **Zone**: Main zone (default when Usage tab selected)

### Cost Ticker (Status Bar Item)
- **Input**: Current session cost value
- **Renders**: Formatted dollar amount with odometer animation
- **Registration**: `api.ui.registerStatusItem()` with `position: "right"`
- **Update**: Calls `StatusItemHandle.update({ label })` on each cost change

## Entry Point

### Plugin Entry (index.ts)
- **Responsibility**: Implement NorbertPlugin interface, wire all components during onLoad
- **onLoad**: Create domain pipeline, create adapters, register views/tab/status/hooks
- **onUnload**: Unsubscribe from events, clear state store, release resources
- **Boundary rule**: Wiring only. No business logic. Calls adapter constructors and registration APIs.

### Hook Processor
- **Responsibility**: Receive raw event payloads from the hook bridge, dispatch to domain pipeline
- **Input**: Unknown payload from `api.hooks.register("session-event", processor)`
- **Flow**: payload -> Token Extractor -> Pricing Model -> Metrics Aggregator -> State Store
- **Boundary rule**: Thin dispatch layer. Calls pure domain functions in sequence, passes results to state store.

## Dependency Direction

```
Views --reads--> State Store --updated-by--> Domain Functions <--called-by-- Hook Processor
                                                                            |
Event Source Adapter --provides-events-to--> Hook Processor                 |
                                                                            |
Plugin Entry --wires--> all components                                      |
```

All dependencies point inward toward the domain. Views depend on the state store (read-only). The state store depends on domain types. Domain functions have zero dependencies on adapters or views.

## File Organization

```
src/plugins/norbert-usage/
  index.ts              -- Plugin entry (NorbertPlugin impl)
  manifest.ts           -- PluginManifest constant
  hookProcessor.ts      -- Hook processor factory
  domain/
    tokenExtractor.ts   -- Pure: payload -> TokenUsage | null
    pricingModel.ts     -- Pure: TokenUsage -> cost
    metricsAggregator.ts -- Pure: fold events into SessionMetrics
    timeSeriesSampler.ts -- Pure: ring buffer operations
    burnRate.ts         -- Pure: event window -> rate
    types.ts            -- Domain ADTs: SessionMetrics, TokenUsage, RateSample, etc.
  adapters/
    eventSource.ts      -- Effect: queries/subscribes for events
    metricsStore.ts     -- Effect: holds mutable state, notifies subscribers
  views/
    GaugeClusterView.tsx  -- React: 5 gauge instruments
    OscilloscopeView.tsx  -- React/Canvas: dual-trace waveform
    UsageDashboardView.tsx -- React: 6 metric cards + 7-day chart
    CostTicker.tsx        -- React: status bar cost display
```
