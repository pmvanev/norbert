# ADR-015: Oscilloscope Time-Series Sampling Strategy

## Status

Accepted

## Context

The norbert-usage Oscilloscope renders a dual-trace waveform (token rate + cost rate) scrolling at ~10Hz over a 60-second window. This requires a time-series sampling strategy that balances visual fidelity, memory usage, and computational cost.

**Quality attribute drivers**: Performance (10Hz render without frame drops), accuracy (waveform shape must faithfully represent activity patterns), memory efficiency (bounded buffer).

**Constraints**: Single-threaded browser JS. Canvas rendering at 10Hz. Tauri webview (Chromium). Must not degrade main thread responsiveness.

## Decision

Fixed-capacity ring buffer with event-driven sampling and render-tick interpolation.

**Mechanism**:
1. Ring buffer of 600 samples (60 seconds at 10 samples/second)
2. On each hook event: compute instantaneous token rate and cost rate from the time delta since previous event
3. On each render tick (~10Hz via requestAnimationFrame): read current buffer, draw both traces on canvas
4. When no events arrive: sample rate decays to zero (flat baseline) by inserting zero-rate samples at render ticks
5. Buffer is immutable: each append produces a new buffer (pure function), stored in the Metrics State Store

**Ring buffer operations (pure)**:
- `appendSample(buffer, sample) -> newBuffer` -- adds sample, evicts oldest if at capacity
- `getSamples(buffer) -> ReadonlyArray<RateSample>` -- returns ordered slice for rendering
- `computeStats(buffer) -> OscilloscopeStats` -- derives peak, avg, total, window duration

## Alternatives Considered

### Alternative 1: Store all raw events and compute rates at render time
- What: Keep all events in memory, compute rate on each frame by scanning recent events
- Tradeoff: Simpler data model. But scanning N events per frame at 10Hz creates O(N) per-frame cost that grows with session length. Unbounded memory.
- Why rejected: Long sessions with thousands of events would cause frame drops. Memory growth unbounded.

### Alternative 2: SQL-based sampling (query events table per render tick)
- What: Run a SQL query against the events table every 100ms to get recent events
- Tradeoff: Zero in-memory state. But SQLite round-trip per frame (10 queries/second) adds latency and contention with the hook receiver's writes.
- Why rejected: 10 SQL queries/second is excessive for a visualization. Introduces jitter from query latency variation.

### Alternative 3: Web Worker for sampling computation
- What: Offload ring buffer management and rate computation to a Web Worker
- Tradeoff: Isolates computation from main thread. But adds message-passing complexity and latency for a computation that takes <1ms per sample.
- Why rejected: Over-engineered for the workload. Ring buffer operations are O(1) per sample. Web Worker message passing overhead exceeds the computation cost.

## Consequences

- Positive: Fixed O(1) memory (600 samples max). O(1) per-event and per-render-tick. Pure functional operations (testable, predictable). Flat baseline naturally emerges from zero-rate sampling.
- Positive: Waveform resolution of 10Hz matches human perception threshold for smooth animation.
- Negative: Ring buffer size is static. Very short sessions (<60s) show partial waveform. Accepted: the waveform fills from right-to-left, empty space is visually clear.
- Negative: Rate computation depends on event timestamps being monotonically increasing. Mitigated: events from SQLite are already ordered by `received_at`.
