# Journey Visual: Performance Monitoring

## Journey Flow

```
[Trigger]              [Step 1]              [Step 2]              [Step 3]              [Step 4]
Multiple sessions  --> Open Performance  --> Scan aggregate   --> Drill into        --> Adjust time
running, cost          Monitor view          metric grid           session detail        window to
question arises                                                                         investigate

Feels: Curious/        Feels: Oriented       Feels: Informed       Feels: Focused        Feels: Confident
       Slightly                                      /Concerned            /Diagnostic           /Satisfied
       anxious
                                                     |
                                              [Error Path A]        [Error Path B]        [Error Path C]
                                              No sessions active    Session ended         Data unavailable
                                              -> empty state        during drill          for metric
                                              with guidance         -> playback mode      -> graceful gap
```

## Emotional Arc

```
Confidence
    ^
    |                                                         * Satisfied
    |                                              * Confident  (found answer)
    |                                    * Focused
    |                          * Informed
    |               * Oriented
    |    * Curious
    |
    +--*------+----------+----------+----------+----------> Time
     Anxious  Open PM    Scan       Drill      Adjust
              View       Grid       Down       Window
```

**Pattern**: Confidence Building
- Start: Slightly anxious -- "How much is all this costing me?"
- Middle: Increasingly informed as aggregate then detail metrics load
- End: Confident and satisfied -- found the specific answer to the question
- No jarring transitions -- each step reveals more detail progressively

---

## Step 1: Open Performance Monitor View

The user selects the Performance Monitor from the Usage tab or switches mode within the existing usage plugin zone.

### UI Mockup

```
+-- Performance Monitor ----------------------------------------+
| sec-hdr                                                        |
|   Performance Monitor              [1m] [5m] [15m]  [Session] |
+----------------------------------------------------------------+
|                                                                |
|  +-- tokens/s (total) --------+  +-- cost/min ---------------+ |
|  |  ~~~~~~~~/\~~~/\~~~~        |  |  ~~~~~/\~~~~/\~~~~         | |
|  |  ~/\~~~/    \/   \~~~/\~~  |  |  ~/\~/   \~/   \~~~~      | |
|  |  /   \/              \~/  |  |  /  /                      | |
|  |  527 tok/s               |  |  $0.42/min                 | |
|  +---------------------------+  +----------------------------+ |
|                                                                |
|  +-- active agents ----------+  +-- context % ---------------+ |
|  |                            |  |                             | |
|  |  ===  3 total              |  |  [||||||||----] 67%        | |
|  |  S1: 1  S2: 1  S3: 1      |  |  S1: 67%  S2: 45%  S3: 82%| |
|  |                            |  |                             | |
|  +---------------------------+  +----------------------------+ |
|                                                                |
|  +-- tokens/s (per session) ---------------------------------+ |
|  |  S1: refactor-auth   |||||||||||||||||||  312 tok/s  67%  | |
|  |  S2: migrate-db      ||||||||||          185 tok/s  45%  | |
|  |  S3: test-coverage   ||||                 30 tok/s  82%  | |
|  +-----------------------------------------------------------+ |
+----------------------------------------------------------------+
| osc-stats: Peak 527 | Avg 341 | Total 1.2M | Sessions 3       |
+----------------------------------------------------------------+
```

### Shared Artifacts

| Artifact | Source | Displayed As |
|----------|--------|-------------|
| ${total_token_rate} | MetricsAggregator (sum across sessions) | "527 tok/s" |
| ${cost_per_min} | MetricsAggregator (sum cost rate * 60) | "$0.42/min" |
| ${active_agents_total} | MetricsAggregator (sum activeAgentCount) | "3 total" |
| ${session_list} | Event Source Adapter (active sessions) | Per-session rows |
| ${time_window} | User selection state | "[1m] [5m] [15m]" |

### Emotional State

- Entry: Curious, slightly anxious about total resource consumption
- Exit: Oriented -- sees the full picture at a glance, knows where to look next

### Integration Checkpoint

- All session metrics must be aggregated from the same data pipeline (MetricsAggregator per session, then summed)
- Time window selection must apply uniformly to all charts in the grid
- Session list must match broadcast bar session list

---

## Step 2: Scan Aggregate Metric Grid

User reads the aggregate metrics to understand overall resource consumption. The grid provides at-a-glance awareness of total burn rate, cost velocity, agent count, and context pressure across all sessions.

### UI Mockup (Detail: tokens/s total chart)

```
+-- tokens/s (total) ------------------------------------------+
|                                                               |
|  600 |                                                        |
|      |        /\                                              |
|  400 |  /\   /  \    /\                                       |
|      | /  \ /    \  /  \                                      |
|  200 |/    \/     \/    \                                     |
|      |               \                                        |
|    0 +-----|-----|-----|-----|-----                            |
|          -50s  -40s  -30s  -20s  -10s   now                   |
|                                                               |
|  Current: 527 tok/s    Peak: 612    Avg: 341                  |
+---------------------------------------------------------------+
```

### UI Mockup (Detail: context % chart)

```
+-- context window % ------------------------------------------+
|                                                               |
| 100% |                                                        |
|      |                                      ____/             |
|  75% |                              ___/---                   |
|      |  - - - - - - - - - - amber - - - - - - - - - - -  S3  |
|  50% |              ___/---                                   |
|      |      ___/---                                      S1   |
|  25% |  ---                                                   |
|      |                                                   S2   |
|    0 +-----|-----|-----|-----|-----                            |
|          -50s  -40s  -30s  -20s  -10s   now                   |
|                                                               |
|  S1: 67%  S2: 45%  S3: 82% (amber)                           |
+---------------------------------------------------------------+
```

### Shared Artifacts

| Artifact | Source | Displayed As |
|----------|--------|-------------|
| ${per_session_token_rate} | MetricsAggregator per session | Bar widths in session list |
| ${context_pct_per_session} | SessionMetrics.contextWindowPct | Per-session % and trend line |
| ${urgency_thresholds} | Configuration (amber: 70%, red: 90%) | Dashed threshold lines |

### Emotional State

- Entry: Oriented (from Step 1)
- Exit: Informed (understands overall situation), possibly Concerned if a metric is in amber/red zone

### Integration Checkpoint

- Urgency thresholds must match Gauge Cluster thresholds (amber at 70%, red at 90% for context)
- Token rate aggregation must be consistent: sum of per-session rates equals total rate

---

## Step 3: Drill into Session Detail

User clicks a session in the per-session breakdown to see detailed metrics for that session, including per-agent breakdown and the familiar oscilloscope waveform.

### UI Mockup

```
+-- Performance Monitor > refactor-auth ------------------------+
| sec-hdr                                                        |
|  < Back to Overview    refactor-auth    [1m] [5m] [15m] [Ses] |
+----------------------------------------------------------------+
|                                                                |
|  +-- token rate (session) ----+  +-- cost rate ---------------+ |
|  |  ~~~~~~~~/\~~~/\~~~~        |  |  ~~~~~/\~~~~/\~~~~         | |
|  |  312 tok/s                 |  |  $0.18/min                 | |
|  +---------------------------+  +----------------------------+ |
|                                                                |
|  +-- context window ----------+  +-- agents ------------------+ |
|  |  [||||||||||------] 67%     |  |  Agent 1 (coordinator)     | |
|  |  134k / 200k tokens        |  |    185 tok/s  $0.12/min    | |
|  |  ~4 min to compaction est. |  |  Agent 2 (file-reader)     | |
|  +---------------------------+  |    127 tok/s  $0.06/min    | |
|                                  +----------------------------+ |
|                                                                |
|  +-- operational metrics -------------------------------------+ |
|  |  Tool calls: 3.2/s | Latency: 1.2s | Errors: 0 | Cache: --| |
|  +-----------------------------------------------------------+ |
+----------------------------------------------------------------+
```

### Shared Artifacts

| Artifact | Source | Displayed As |
|----------|--------|-------------|
| ${session_id} | Broadcast context or drill-down selection | "refactor-auth" |
| ${session_token_rate} | SessionMetrics.burnRate | "312 tok/s" |
| ${session_cost_rate} | Derived from SessionMetrics.sessionCost delta | "$0.18/min" |
| ${context_detail} | SessionMetrics context fields | "134k / 200k tokens" |
| ${agent_breakdown} | Per-agent metrics (when available) | Agent list with rates |
| ${operational_metrics} | Derived from event stream analysis | Tool calls/s, latency, errors |

### Emotional State

- Entry: Focused -- has identified the session of interest from aggregate view
- Exit: Diagnostic confidence -- understands the session's resource profile in detail

### Integration Checkpoint

- Session drill-down must use same time window as aggregate view
- "Back to Overview" must restore aggregate view with same time window and scroll position
- Session metrics shown here must match the same session's data in aggregate view

---

## Step 4: Adjust Time Window

User selects a different time window to see longer-term trends for the current view (aggregate or session detail).

### UI Mockup (15-minute window)

```
+-- tokens/s (total) -- 15m window -----------------------------+
|                                                                |
|  800 |                                                         |
|      |    /\                         /\                        |
|  600 |   /  \              /\       /  \   /\                  |
|      |  /    \     /\     /  \     /    \ /  \                 |
|  400 | /      \   /  \   /    \   /      \    \                |
|      |/        \ /    \ /      \ /             \               |
|  200 |          \/      \/      \/              \____          |
|      |                                                         |
|    0 +---|---|---|---|---|---|---|---|---|---|---|---|---|---     |
|       -15m   -13m  -11m  -9m   -7m   -5m   -3m   -1m  now     |
|                                                                |
|  Peak: 743   Avg: 412   Window: 15m   Resolution: 1s          |
+----------------------------------------------------------------+
```

### Shared Artifacts

| Artifact | Source | Displayed As |
|----------|--------|-------------|
| ${time_window_ms} | User selection | Duration label in header |
| ${sample_resolution} | Computed from window (1m: 100ms, 5m: 500ms, 15m: 1s) | "Resolution: 1s" |
| ${historical_samples} | Time-series buffer or historical query | Waveform data at appropriate resolution |

### Emotional State

- Entry: Focused (investigating specific pattern)
- Exit: Confident/Satisfied -- has the temporal context needed to understand the pattern

### Integration Checkpoint

- Wider time windows must use appropriate sample resolution (cannot render 10Hz for 15 minutes)
- Stats bar values (peak, avg, total) must reflect the selected window, not always 60s
- Time window selection must persist across view mode changes (aggregate to session detail)

---

## Error Paths

### Error Path A: No Active Sessions

```
+-- Performance Monitor ----------------------------------------+
| sec-hdr                                                        |
|   Performance Monitor              [1m] [5m] [15m]  [Session] |
+----------------------------------------------------------------+
|                                                                |
|                                                                |
|     No active sessions                                         |
|                                                                |
|     Start a Claude Code session with hooks enabled             |
|     to see live performance metrics here.                      |
|                                                                |
|     Most recent session: refactor-auth (2h ago)                |
|     [View historical data]                                     |
|                                                                |
+----------------------------------------------------------------+
```

Emotional design: Inviting, not blaming. Provides clear next step and historical fallback.

### Error Path B: Session Ends During Drill-Down

When a session the user is viewing ends while they are in the detail view:

- Charts freeze at final values (no abrupt blank)
- A subtle indicator appears: "Session ended at 14:32"
- Time window controls remain functional for reviewing historical data
- "Back to Overview" removes the ended session from the active count

### Error Path C: Metric Data Unavailable

When a specific metric cannot be computed (e.g., context window % when Claude Code does not report context usage):

```
+-- context window % ------------------------------------------+
|                                                               |
|  Data unavailable                                             |
|                                                               |
|  Context utilization data is not available for this session.  |
|  This metric requires Claude Code to report context usage     |
|  in hook event payloads.                                      |
|                                                               |
+---------------------------------------------------------------+
```

The chart slot remains visible but shows an explanatory message rather than disappearing (maintains layout stability).

---

## Oscilloscope Subsumption Strategy

The existing oscilloscope (US-005) is not deleted but absorbed:

1. **Performance Monitor v1 ships as a new view** registered alongside the oscilloscope
2. **Token rate waveform** in the PM grid uses the same rendering pipeline (oscilloscope.ts pure functions)
3. **Oscilloscope view registration remains** for users who prefer the single-focus waveform
4. **Future**: Oscilloscope view becomes a "focus mode" of the PM -- clicking a chart in the grid expands it to full-width waveform view, identical to the current oscilloscope
5. **No breaking change**: users who configured floating panels with the oscilloscope continue to see it

This preserves the emotional quality of the oscilloscope (perceptual pattern recognition) while adding the practical monitoring capabilities the Performance Monitor provides.
