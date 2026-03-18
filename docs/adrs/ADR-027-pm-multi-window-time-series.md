# ADR-027: Multi-Window Time-Series via Parallel Ring Buffers

## Status

Accepted

## Context

The Performance Monitor requires configurable time windows (1m, 5m, 15m, full session) whereas the existing oscilloscope uses a fixed 60-second window with a 600-sample ring buffer at 10Hz. Each time window needs appropriate sample resolution to maintain 300-900 data points per chart for visual clarity.

**Quality attribute drivers**: Performance (multi-window must not degrade 10Hz rendering), maintainability (reuse existing ring buffer operations), user experience (smooth transitions between windows, no data gaps).

**Constraints**: Existing TimeSeriesBuffer and ring buffer operations (appendSample, getSamples, computeStats) are proven and tested. Browser memory budget for multiple buffers across multiple sessions must remain bounded.

## Decision

Parallel ring buffers per time window with client-side downsampling.

**Mechanism**:
1. For each tracked session + aggregate, maintain parallel ring buffers:
   - 1m: 600 samples, 100ms interval (existing behavior)
   - 5m: 600 samples, 500ms interval (every 5th sample from live feed)
   - 15m: 900 samples, 1000ms interval (every 10th sample from live feed)
2. On each incoming RateSample, append to all buffers using modular downsampling:
   - 1m buffer: every sample
   - 5m buffer: every 5th sample (counter mod 5 === 0)
   - 15m buffer: every 10th sample (counter mod 10 === 0)
3. Time window switching reads from the pre-populated buffer (instant, no recomputation)
4. Session-length window loads historical events from SQLite, downsamples to 300-900 points, creates a temporary buffer
5. All buffer operations reuse existing `appendSample`, `getSamples`, `computeStats` pure functions

**Memory budget**: 5 sessions x 3 windows x 900 samples x ~32 bytes = ~432KB. Plus aggregate buffers: 3 x 900 x 32 = ~86KB. Total: ~520KB. Well within browser constraints.

## Alternatives Considered

### Alternative 1: Single buffer, re-query on window change
- What: Keep only the 1m ring buffer. When user selects 5m or 15m, query SQLite for historical events and rebuild the buffer.
- Tradeoff: Minimal memory (one buffer per session). But SQL query + client-side folding on each window switch introduces 100-500ms latency. Window switching feels sluggish. Repeated queries on window toggle are wasteful.
- Why rejected: User switches windows during investigation (per journey analysis). Each switch must be instant. Latency during drill-down investigation breaks the "confidence building" emotional arc.

### Alternative 2: Single large buffer, slice for each window
- What: One large buffer per session (9000 samples = 15 minutes at 10Hz). Each window reads a slice.
- Tradeoff: Simple mental model. But 9000 samples per session at 10Hz means every session accumulates a large buffer. 5 sessions x 9000 x 32 bytes = 1.4MB. More importantly, rendering 9000 points on canvas (even for the 15m view) is wasteful when only 900 are needed. Must downsample at render time.
- Why rejected: Wasteful memory and computation. Render-time downsampling adds per-frame cost. The parallel buffer approach pre-computes the downsampled data.

### Alternative 3: Adaptive resolution single buffer
- What: One buffer that changes its sample rate when the window changes. On switch from 1m to 5m, compact existing samples and change the append interval.
- Tradeoff: Single buffer, adapts to active window. But compaction is lossy (cannot un-compact to return to 1m). Switching back to 1m after viewing 5m loses the high-resolution data for the period spent in 5m mode.
- Why rejected: Lossy compaction is unacceptable. Users frequently toggle between windows (per journey analysis step 4). Must preserve all resolution levels simultaneously.

## Consequences

- Positive: Instant window switching (no query, no computation). Pre-populated buffers ready for any window at any time.
- Positive: Reuses all existing ring buffer pure functions. No new buffer implementation needed.
- Positive: Memory budget is bounded and small (~520KB for 5 sessions across 3 windows + aggregate).
- Positive: Each buffer independently testable with same property-based tests as existing ring buffer.
- Negative: Parallel writes on each sample (3 buffers per session). Accepted: appendSample is O(1) (array slice + push). 3 x O(1) per sample is negligible.
- Negative: Session-length window requires a SQL query (not pre-populated). Accepted: this is an infrequent operation (user selects "Session" once per investigation), and the query is bounded by time range.
