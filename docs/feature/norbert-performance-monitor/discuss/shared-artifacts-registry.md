# Shared Artifacts Registry: Performance Monitor

## Registry

### 1. total_token_rate

- **Source of Truth**: MetricsAggregator -- sum of burnRate across all active SessionMetrics snapshots
- **Consumers**:
  - Performance Monitor: tokens/s (total) chart value
  - Performance Monitor: stats bar current rate
- **Owner**: norbert-usage plugin domain layer
- **Integration Risk**: MEDIUM -- aggregate must equal sum of per-session rates. Timing of snapshot updates could cause momentary divergence.
- **Validation**: Assert `total_token_rate == sum(per_session_token_rate)` at each render tick

### 2. cost_per_min

- **Source of Truth**: MetricsAggregator -- sum of per-session cost rate deltas, multiplied by 60
- **Consumers**:
  - Performance Monitor: cost/min chart value
  - Performance Monitor: stats bar
- **Owner**: norbert-usage plugin domain layer
- **Integration Risk**: MEDIUM -- cost rate is derived from cost deltas over time window. Different window sizes produce different instantaneous rates.
- **Validation**: Cost rate trend direction must match token rate trend direction (both up or both down)

### 3. active_agents_total

- **Source of Truth**: MetricsAggregator -- sum of activeAgentCount across all active SessionMetrics
- **Consumers**:
  - Performance Monitor: active agents card
  - Gauge Cluster: RPM counter (for broadcast session)
- **Owner**: norbert-usage plugin domain layer
- **Integration Risk**: LOW -- simple sum, no timing sensitivity
- **Validation**: Total agents >= number of active sessions (each session has at least 1)

### 4. session_list

- **Source of Truth**: Event Source Adapter -- active sessions from sessions table (started_at present, ended_at null)
- **Consumers**:
  - Performance Monitor: per-session breakdown rows
  - Performance Monitor: drill-down navigation targets
  - Broadcast bar: session picker
- **Owner**: norbert core (sessions table) + norbert-usage adapter
- **Integration Risk**: HIGH -- session list must be identical across PM and broadcast bar. Race condition possible if session starts/ends between renders.
- **Validation**: PM session count matches broadcast bar session count at all times

### 5. time_window

- **Source of Truth**: User selection state (React component state, default: 60000ms)
- **Consumers**:
  - All PM chart time axes
  - PM stats bar window duration label
  - Sample resolution computation
  - Time-series buffer query parameters
- **Owner**: Performance Monitor view component
- **Integration Risk**: MEDIUM -- must persist across view transitions (aggregate to detail and back). Lost state causes jarring UX.
- **Validation**: After aggregate->detail->aggregate round-trip, time window value unchanged

### 6. per_session_token_rate

- **Source of Truth**: SessionMetrics.burnRate per active session
- **Consumers**:
  - Performance Monitor: per-session breakdown bar widths and labels
  - Performance Monitor: aggregate computation
- **Owner**: norbert-usage plugin domain layer (one SessionMetrics per session)
- **Integration Risk**: MEDIUM -- must update at same cadence across all sessions. Stale data for one session while others update creates inconsistency.
- **Validation**: Each session rate is non-negative. Sum equals total_token_rate.

### 7. context_pct_per_session

- **Source of Truth**: SessionMetrics.contextWindowPct per session
- **Consumers**:
  - Performance Monitor: context % chart trend lines
  - Performance Monitor: urgency coloring
  - Gauge Cluster: fuel gauge (for broadcast session)
- **Owner**: norbert-usage plugin domain layer
- **Integration Risk**: HIGH -- urgency thresholds must match between PM and Gauge Cluster. Different threshold values would cause user confusion.
- **Validation**: PM amber/red thresholds identical to Gauge Cluster thresholds

### 8. urgency_thresholds

- **Source of Truth**: Plugin configuration (shared constant or config entry)
- **Consumers**:
  - Performance Monitor: context % chart threshold lines
  - Performance Monitor: urgency coloring
  - Gauge Cluster: fuel gauge zones (amber 70%, red 90%)
- **Owner**: norbert-usage plugin configuration
- **Integration Risk**: HIGH -- single source of truth required. If PM and Gauge Cluster define thresholds independently, they will diverge.
- **Validation**: Both views reference same configuration constant. No hardcoded thresholds in view code.

### 9. selected_session_id

- **Source of Truth**: User click on session row in PM breakdown (drill-down selection)
- **Consumers**:
  - PM detail view: header breadcrumb
  - PM detail view: all charts (scoped to selected session)
  - PM detail view: back navigation target
- **Owner**: Performance Monitor view component
- **Integration Risk**: LOW -- local to PM view, no external consumers
- **Validation**: Selected session exists in session_list. Invalid selection (ended session) handled gracefully.

### 10. sample_resolution

- **Source of Truth**: Computed from time_window_ms: 1m=100ms, 5m=500ms, 15m=1000ms, session=dynamic
- **Consumers**:
  - Time-series buffer sampling rate
  - Chart rendering point density
  - Stats bar "Resolution" label
- **Owner**: Performance Monitor domain logic
- **Integration Risk**: MEDIUM -- resolution too high for wide windows causes performance issues. Resolution too low causes aliased waveforms.
- **Validation**: Point count per chart stays within 300-900 range regardless of time window

### 11. agent_breakdown

- **Source of Truth**: Per-agent metrics derived from event attribution (agent_id or subagent identification in event payloads)
- **Consumers**:
  - PM detail view: agent list with individual rates
- **Owner**: norbert-usage plugin domain layer (new capability)
- **Integration Risk**: HIGH -- agent identification depends on event payload structure. If Claude Code does not consistently identify agents in payloads, breakdown will be incomplete.
- **Validation**: Sum of agent rates approximates session total (within 10% tolerance for timing)

### 12. operational_metrics

- **Source of Truth**: Derived from event stream analysis (tool call frequency, latency between events, error events)
- **Consumers**:
  - PM detail view: operational metrics bar
- **Owner**: norbert-usage plugin domain layer (new capability)
- **Integration Risk**: MEDIUM -- metrics derived from event timing may be noisy. Latency measurement depends on event timestamp accuracy.
- **Validation**: Tool calls/s >= 0. Latency >= 0. Error count >= 0. Metrics update in real time.

---

## Integration Risk Summary

| Risk Level | Artifacts | Key Concern |
|------------|-----------|-------------|
| HIGH | session_list, context_pct_per_session, urgency_thresholds, agent_breakdown | Cross-view consistency, data availability |
| MEDIUM | total_token_rate, cost_per_min, time_window, per_session_token_rate, sample_resolution, operational_metrics | Timing, aggregation accuracy, performance |
| LOW | active_agents_total, selected_session_id | Simple values, local scope |

## Cross-View Consistency Rules

1. **Urgency thresholds**: PM and Gauge Cluster MUST reference the same configuration constant for amber (70%) and red (90%) context thresholds.
2. **Session list**: PM session list MUST be derived from the same source as broadcast bar session picker.
3. **Token rate**: Aggregate total MUST equal sum of per-session rates at each render.
4. **Context %**: PM context chart and Gauge Cluster fuel gauge MUST show identical percentage for the broadcast session.
5. **Cost**: PM cost rate and cost ticker MUST be consistent (derived from same pipeline).
