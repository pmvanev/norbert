# Shared Artifacts Registry: norbert-usage

## Artifacts

### session_id

- **Source of truth:** Context Broadcast Bar session picker selection
- **Consumers:**
  - Broadcast bar session label
  - Gauge Cluster (scopes all 6 instruments)
  - Oscilloscope (scopes waveform data)
  - Default Dashboard (scopes all metric cards)
  - Floating panel (inherits from Gauge Cluster)
- **Owner:** Norbert core (broadcast bar)
- **Integration risk:** HIGH -- if session_id is inconsistent, all views show data for different sessions
- **Validation:** All views subscribed to broadcast context must display data for the same session_id

### session_cost

- **Source of truth:** Aggregated from session_events table -- sum of (input_tokens * input_price + output_tokens * output_price) for all events in session
- **Consumers:**
  - Broadcast bar cost ticker
  - Gauge Cluster odometer instrument
  - Default Dashboard running cost card
  - Floating panel minimized pill
  - Tray popover cost line
  - Status item (registered via api.ui.registerStatusItem)
- **Owner:** norbert-usage plugin (metric computation)
- **Integration risk:** HIGH -- cost must be identical everywhere it appears; discrepancy destroys trust
- **Validation:** Compare cost in broadcast bar, Gauge Cluster odometer, Dashboard card, and floating pill -- all must match to the cent

### total_tokens

- **Source of truth:** Sum of input_tokens + output_tokens from session_events for current session
- **Consumers:**
  - Broadcast bar token count
  - Default Dashboard token count card (with input/output breakdown)
- **Owner:** norbert-usage plugin
- **Integration risk:** MEDIUM -- total must match sum of breakdowns
- **Validation:** Broadcast bar total equals Dashboard card total equals sum of input + output breakdown

### token_burn_rate

- **Source of truth:** Derived metric -- tokens per second over a rolling window, computed from session_events timestamps and token counts
- **Consumers:**
  - Gauge Cluster tachometer instrument
  - Oscilloscope current rate overlay
  - Oscilloscope stats bar (as "avg rate" component)
- **Owner:** norbert-usage plugin
- **Integration risk:** MEDIUM -- tachometer and oscilloscope must agree on current rate
- **Validation:** Tachometer reading matches oscilloscope current rate display

### context_window_pct

- **Source of truth:** Derived metric -- (current context tokens consumed by agent) / (model context window limit)
- **Consumers:**
  - Gauge Cluster fuel gauge instrument
  - Default Dashboard context window card
- **Owner:** norbert-usage plugin
- **Integration risk:** MEDIUM -- requires knowing model context limit (model-dependent)
- **Validation:** Fuel gauge percentage matches Dashboard card percentage; model limit is correct for active model

### active_agent_count

- **Source of truth:** Derived metric -- count of agents with session_start event but no corresponding agent_complete event in current session
- **Consumers:**
  - Gauge Cluster RPM counter instrument
  - Default Dashboard active agents card
- **Owner:** norbert-usage plugin
- **Integration risk:** LOW -- straightforward count
- **Validation:** RPM counter matches Dashboard card agent count

### hook_health

- **Source of truth:** Derived metric -- latency and error rate computed from recent hook event arrival times and any error payloads
- **Consumers:**
  - Gauge Cluster warning cluster (green/amber/red indicators)
  - Default Dashboard hook health card
  - Status bar hook health indicator
- **Owner:** norbert-usage plugin
- **Integration risk:** MEDIUM -- stale detection threshold must be consistent (30s amber, 60s red)
- **Validation:** Warning cluster, Dashboard card, and status bar all show same health state

### session_duration

- **Source of truth:** Derived metric -- current time minus session_start event timestamp
- **Consumers:**
  - Gauge Cluster clock instrument
- **Owner:** norbert-usage plugin
- **Integration risk:** LOW -- single consumer, simple computation
- **Validation:** Clock shows correct elapsed time from session start

### token_rate_timeseries

- **Source of truth:** Rolling 60-second window of per-second token rate samples derived from session_events
- **Consumers:**
  - Oscilloscope token trace (waveform)
- **Owner:** norbert-usage plugin
- **Integration risk:** LOW -- single consumer
- **Validation:** Waveform shape matches actual event arrival pattern

### cost_rate_timeseries

- **Source of truth:** Rolling 60-second window of per-second cost rate samples derived from token_rate_timeseries + pricing model
- **Consumers:**
  - Oscilloscope cost trace (waveform)
- **Owner:** norbert-usage plugin
- **Integration risk:** LOW -- single consumer; must be consistent with session_cost accumulation
- **Validation:** Integral of cost rate over session duration approximately equals session_cost

### tool_call_count

- **Source of truth:** Count of tool_call_start events in session_events for current session
- **Consumers:**
  - Default Dashboard tool calls card
- **Owner:** norbert-usage plugin
- **Integration risk:** LOW -- single consumer, simple count
- **Validation:** Count matches number of tool_call_start events in SQLite

### daily_cost_history

- **Source of truth:** Aggregated daily cost from session_events grouped by date over last 7 days
- **Consumers:**
  - Default Dashboard 7-day burn chart
- **Owner:** norbert-usage plugin
- **Integration risk:** LOW -- single consumer
- **Validation:** Sum of daily costs matches total cost for the 7-day period

---

## Integration Consistency Rules

| Rule | Artifacts | Validation |
|---|---|---|
| Cost consistency | session_cost across broadcast bar, Gauge Cluster, Dashboard, floating pill | All display same dollar value at all times |
| Session scope consistency | session_id across all subscribed views | All views respond to broadcast context changes |
| Rate consistency | token_burn_rate between Gauge Cluster tachometer and Oscilloscope | Same numeric rate displayed |
| Context pct consistency | context_window_pct between Gauge Cluster fuel gauge and Dashboard | Same percentage displayed |
| Agent count consistency | active_agent_count between Gauge Cluster RPM and Dashboard | Same count displayed |
| Health consistency | hook_health across Gauge Cluster warnings, Dashboard card, status bar | Same state (green/amber/red) |
