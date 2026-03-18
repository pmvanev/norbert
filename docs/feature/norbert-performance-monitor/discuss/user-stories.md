<!-- markdownlint-disable MD024 -->

# norbert-performance-monitor User Stories

---

## US-PM-001: Performance Monitor View Registration

### Problem
Ravi Patel is a Claude Code power user who monitors multiple concurrent sessions. He finds it impossible to see aggregate resource consumption because the existing oscilloscope shows only one session at a time -- he must click through each session in the broadcast bar to estimate total burn rate, which took him 3 minutes last Tuesday when he had 5 sessions running.

### Who
- Claude Code power user | Runs 2-5 concurrent sessions daily | Needs aggregate observability without per-session context switching

### Solution
The norbert-usage plugin registers a new "Performance Monitor" mode view that displays a multi-metric grid showing aggregate and per-session metrics. The view is registered alongside the existing Oscilloscope and Usage Dashboard, accessible via the Usage tab toolbar.

### Domain Examples

#### 1: Happy Path -- Performance Monitor loads with aggregate grid
Ravi Patel opens the Usage tab and selects the Performance Monitor mode. The view renders a 2x2+1 grid: tokens/s (total), cost/min, active agents, context window %, and a per-session breakdown panel. All 3 of his active sessions appear in the breakdown with their individual rates summing to the total.

#### 2: Edge Case -- Single session active
Elena Vasquez has only 1 active session. The Performance Monitor renders the same grid layout but the aggregate metrics equal the single session's metrics. The per-session breakdown shows one row. The view is useful but the aggregate vs detail distinction is minimal.

#### 3: Error -- No active sessions
Marcus Chen opens the Performance Monitor with no active Claude Code sessions. The grid shows an empty state: "No active sessions. Start a Claude Code session with hooks enabled to see live performance metrics here." A link to the most recent session's historical data is provided.

### UAT Scenarios (BDD)

#### Scenario: Performance Monitor registers as a mode view
Given the norbert-usage plugin is loaded
When the plugin registers its views during onLoad
Then a "Performance Monitor" mode is registered in the Usage tab toolbar
And the Performance Monitor is accessible alongside the Oscilloscope and Dashboard modes

#### Scenario: Performance Monitor displays aggregate metric grid
Given Ravi Patel has 3 active sessions: "refactor-auth" at 312 tok/s, "migrate-db" at 185 tok/s, "test-coverage" at 30 tok/s
When Ravi opens the Performance Monitor view
Then the tokens/s total chart shows approximately 527 tok/s
And the cost/min chart shows the aggregate cost rate
And the active agents card shows the total agent count
And the per-session breakdown lists all 3 sessions sorted by rate descending

#### Scenario: Single session shows consistent aggregate and detail
Given Elena Vasquez has 1 active session "user-auth" at 280 tok/s
When Elena opens the Performance Monitor
Then the total tokens/s matches the single session rate of 280 tok/s
And the per-session breakdown shows one row for "user-auth"

#### Scenario: Empty state shown when no sessions active
Given Marcus Chen has no active Claude Code sessions
And the most recent session "refactor-auth" ended 2 hours ago
When Marcus opens the Performance Monitor
Then an empty state message appears with onboarding guidance
And a link to view historical data for "refactor-auth" is provided

### Acceptance Criteria
- [ ] Performance Monitor registered as a mode view in the Usage tab toolbar
- [ ] Aggregate metric grid displays: tokens/s total, cost/min, active agents, context window %
- [ ] Per-session breakdown lists all active sessions with individual metrics
- [ ] Sessions sorted by token rate descending in breakdown panel
- [ ] Empty state with guidance shown when no sessions are active
- [ ] View coexists with existing Oscilloscope and Dashboard modes

### Technical Notes
- Registered via api.ui.registerView as a new mode in the usage plugin
- Uses the same MetricsAggregator and data pipeline as existing views
- Aggregate metrics computed by summing across per-session SessionMetrics snapshots
- Must not break existing oscilloscope or dashboard view registrations

### Job Story Traceability
- JS-PM-1 (aggregate resource awareness)

### MoSCoW: Must Have

---

## US-PM-002: Multi-Session Aggregate Metrics

### Problem
Ravi Patel is a Claude Code power user who runs 3-5 concurrent sessions. He finds it stressful that he has no single number for total resource consumption -- he mentally adds up per-session values from the broadcast bar, which is error-prone and slow. Last week he missed a runaway session burning $8 because it was not the currently broadcast session.

### Who
- Claude Code power user | Runs multiple concurrent sessions on Opus 4 and Sonnet 4 | Needs cross-session aggregate metrics updated in real time

### Solution
The Performance Monitor computes and displays aggregate metrics across all active sessions: total tokens/s, total cost/min, total active agents, and per-session context window %. Aggregation happens in the domain layer by summing across per-session SessionMetrics snapshots.

### Domain Examples

#### 1: Happy Path -- Aggregate across 3 mixed-model sessions
Ravi Patel has 3 sessions: "refactor-auth" on Opus 4 at 312 tok/s ($0.18/min), "migrate-db" on Opus 4 at 185 tok/s ($0.11/min), "test-coverage" on Sonnet 4 at 30 tok/s ($0.004/min). The Performance Monitor shows: total 527 tok/s, total $0.29/min, 3 active agents. The per-session breakdown shows each session with its rate and proportional bar.

#### 2: Edge Case -- Session starts while PM is open
Elena Vasquez is viewing the Performance Monitor showing 2 sessions totaling 400 tok/s. A third session "deploy-staging" starts with hooks enabled. Within 2 seconds, the PM updates: total rises to approximately 400 tok/s (new session's rate ramps up from 0), and a third row appears in the per-session breakdown.

#### 3: Error -- Session ends while PM is open
Marcus Chen is viewing the PM with 3 sessions. Session "quick-fix" ends. The PM updates within 2 seconds: total drops by the ended session's contribution, the session row disappears from the breakdown, and active agent count decreases.

### UAT Scenarios (BDD)

#### Scenario: Aggregate tokens/s equals sum of per-session rates
Given Ravi Patel has 3 active sessions with rates 312, 185, and 30 tok/s
When the Performance Monitor renders the aggregate metrics
Then the total tokens/s shows 527 tok/s
And the per-session breakdown shows 312, 185, and 30 tok/s respectively
And the visual sum of per-session bars is proportional to the total

#### Scenario: Aggregate cost/min reflects mixed model pricing
Given Ravi has sessions: Opus 4 at $0.18/min and Sonnet 4 at $0.004/min
When the PM renders cost/min
Then the total cost/min reflects the sum of per-session cost rates
And the per-session breakdown shows cost rate per session

#### Scenario: New session appears in aggregate within 2 seconds
Given Elena Vasquez has 2 sessions totaling 400 tok/s
When a new session "deploy-staging" starts with hooks enabled
Then within 2 seconds a third row appears in the per-session breakdown
And the aggregate total updates to include the new session's contribution

#### Scenario: Ended session removed from aggregate
Given Marcus Chen has 3 sessions with total 500 tok/s
And session "quick-fix" was contributing 100 tok/s
When session "quick-fix" ends
Then the total drops to approximately 400 tok/s
And "quick-fix" is removed from the per-session breakdown

#### Scenario: Per-session breakdown sorted by rate descending
Given Ravi has sessions at 30, 312, and 185 tok/s
When the per-session breakdown renders
Then sessions are listed in order: 312, 185, 30 tok/s

### Acceptance Criteria
- [ ] Total tokens/s computed as sum of all active session burn rates
- [ ] Total cost/min computed as sum of all active session cost rates
- [ ] Total active agents computed as sum of per-session agent counts
- [ ] Per-session breakdown lists each session with individual metrics
- [ ] Breakdown sorted by token rate descending
- [ ] New sessions appear in aggregate within 2 seconds of first event
- [ ] Ended sessions removed from aggregate within 2 seconds of session_end event
- [ ] Aggregate always equals sum of parts (no visible rounding discrepancy)

### Technical Notes
- Aggregate computation is a new domain function: input is array of SessionMetrics, output is AggregateMetrics
- Session lifecycle events (session_start, session_end) drive addition/removal from aggregate
- Must handle concurrent updates from multiple sessions without race conditions
- Per-session data uses existing SessionMetrics type; aggregate is a new type

### Job Story Traceability
- JS-PM-1 (aggregate resource awareness), JS-PM-2 (metric scope navigation)

### MoSCoW: Must Have

---

## US-PM-003: Session Drill-Down Navigation

### Problem
Ravi Patel is monitoring aggregate metrics and notices a spike in total tokens/s. He finds it frustrating that identifying which session caused the spike requires clicking through each session in the broadcast bar -- a 30-60 second process per session when 5 are running, during which the spike may already have subsided.

### Who
- Claude Code power user | Investigating resource anomalies across multiple sessions | Needs fast symptom-to-root-cause navigation

### Solution
The Performance Monitor supports drill-down navigation: clicking a session in the per-session breakdown transitions to a session detail view showing that session's metrics, agent breakdown, and operational indicators. A back button returns to the aggregate view with state preserved.

### Domain Examples

#### 1: Happy Path -- Drill into session causing a spike
Ravi Patel sees the total tokens/s spike to 800 tok/s. He looks at the per-session breakdown and sees "refactor-auth" jumped to 520 tok/s. He clicks "refactor-auth" and sees the session detail: token rate waveform showing the spike, 2 agents (coordinator at 350 tok/s, file-reader at 170 tok/s), context at 74% (amber zone), tool calls at 5.1/s.

#### 2: Edge Case -- Drill into session then navigate back
Elena Vasquez drills into "migrate-db" to check context pressure. She sees context at 45%, confirming no pressure. She clicks Back. The aggregate view restores with the same 5-minute time window she had selected before drilling down.

#### 3: Error -- Session ends while viewing detail
Marcus Chen is viewing detail for "quick-fix". The session ends. Charts freeze at final values with a "Session ended at 14:32" indicator. Time controls remain functional for reviewing history. Back button returns to aggregate without the ended session in the active list.

### UAT Scenarios (BDD)

#### Scenario: Click session row to drill into detail
Given Ravi is viewing the aggregate Performance Monitor
And session "refactor-auth" shows 312 tok/s in the breakdown
When Ravi clicks on "refactor-auth" in the session list
Then the view transitions to session detail for "refactor-auth"
And the header shows "Performance Monitor > refactor-auth"
And the token rate chart shows the session-specific waveform
And a Back button is visible

#### Scenario: Session detail shows agent breakdown
Given Ravi is viewing session detail for "refactor-auth"
And the session has 2 agents: coordinator at 185 tok/s and file-reader at 127 tok/s
When the agent breakdown panel renders
Then each agent is listed with its individual token rate and cost rate
And the sum of agent rates approximates the session total

#### Scenario: Session detail shows context with headroom estimate
Given Ravi is viewing session detail for "refactor-auth"
And the session has consumed 134,000 of 200,000 context tokens
When the context panel renders
Then it shows 67% utilization and "134k / 200k tokens"
And it shows an estimated time to compaction

#### Scenario: Back button preserves aggregate view state
Given Ravi selected the 5-minute time window on the aggregate view
And then drilled into "refactor-auth"
When Ravi clicks the Back button
Then the aggregate view is restored with the 5-minute time window
And all session data is current

#### Scenario: Session ends during detail view
Given Ravi is viewing session detail for "quick-fix"
When the session ends at 14:32
Then charts freeze at final values
And a "Session ended at 14:32" indicator appears
And time window controls remain functional for historical review
And the Back button returns to aggregate without "quick-fix" in active count

### Acceptance Criteria
- [ ] Clicking a session row in the breakdown transitions to session detail view
- [ ] Session detail header shows breadcrumb: "Performance Monitor > {session_name}"
- [ ] Agent breakdown lists per-agent metrics when available
- [ ] Context panel shows utilization percentage, token counts, and compaction estimate
- [ ] Back button restores aggregate view with preserved time window and scroll position
- [ ] Session ending during detail view handled gracefully (freeze, indicator, functional controls)

### Technical Notes
- Drill-down is a view-level navigation within the Performance Monitor component (not a plugin mode switch)
- Agent breakdown requires agent-level event attribution from payloads (may not be available for all events)
- Compaction time estimate is approximate: based on current burn rate and remaining context headroom
- Back navigation must preserve React component state (time window, scroll position)

### Job Story Traceability
- JS-PM-2 (metric scope navigation)

### MoSCoW: Must Have

---

## US-PM-004: Configurable Time Window

### Problem
Ravi Patel is reviewing a session that ran for 45 minutes and wants to understand its resource consumption over the full duration. He finds it limiting that the oscilloscope shows only a 60-second window -- he cannot see the broader pattern of burn rate spikes and dips across the session's lifecycle, making it impossible to correlate resource consumption with specific work phases.

### Who
- Claude Code power user | Reviewing session history or investigating trends | Needs adjustable time windows from 1 minute to full session duration

### Solution
The Performance Monitor provides a time window selector (1m, 5m, 15m, Session) that applies to all charts in the grid. Each time window uses an appropriate sample resolution to maintain chart readability. The 1-minute window preserves the existing oscilloscope's 10Hz feel.

### Domain Examples

#### 1: Happy Path -- Switch from 1m to 15m window
Ravi Patel is viewing the Performance Monitor at the default 1-minute window. He selects "15m" to see the broader trend. All charts expand: the token rate chart shows a 15-minute history with 1-second resolution, revealing a pattern of 3 cost spikes separated by 4-minute intervals -- a tool-call-heavy agent running periodic batch operations.

#### 2: Edge Case -- Session window for 42-minute session
Elena Vasquez drills into a session detail for "refactor-auth" which has been running 42 minutes. She selects "Session" to see the full history. The chart shows 42 minutes of data with approximately 3-second resolution. She sees that burn rate was highest in the first 10 minutes (initial exploration) and stabilized after.

#### 3: Boundary -- 1-minute window preserves 10Hz feel
Marcus Chen returns to the 1-minute window after reviewing broader trends. The charts resume showing live data at approximately 10Hz, indistinguishable from the existing oscilloscope experience. The transition between time windows is smooth with no data gap.

### UAT Scenarios (BDD)

#### Scenario: Default time window is 1 minute
Given Ravi opens the Performance Monitor for the first time
Then the time window selector shows "1m" as active
And all charts display the last 60 seconds of data
And the update frequency is approximately 10Hz

#### Scenario: Switch to 5-minute window
Given Ravi is viewing the PM with 1-minute window
When Ravi selects "5m"
Then all charts expand to show the last 5 minutes
And the stats bar shows "Window: 5m"
And the sample resolution is approximately 500ms

#### Scenario: Switch to 15-minute window
Given Ravi is viewing the PM with 1-minute window
When Ravi selects "15m"
Then all charts show the last 15 minutes
And the stats bar shows "Window: 15m"
And the sample resolution is approximately 1 second

#### Scenario: Session-length window shows full history
Given Ravi is viewing session detail for a session running 42 minutes
When Ravi selects "Session"
Then the chart shows the full 42 minutes of data
And the stats bar shows "Window: 42m"
And the resolution adjusts to maintain 300-900 data points

#### Scenario: Time window persists across drill-down
Given Ravi has selected the 15-minute window
When Ravi drills into a session and then navigates back
Then the 15-minute window is preserved in both views

#### Scenario: Stats reflect selected window
Given Ravi has selected the 5-minute window
When the stats bar renders
Then peak rate is the maximum across the 5-minute window
And average rate is the mean across the 5-minute window
And total tokens is the sum across the 5-minute window

### Acceptance Criteria
- [ ] Time window selector offers: 1m, 5m, 15m, Session
- [ ] All charts in the grid respond to time window changes
- [ ] Sample resolution adapts: 1m at 100ms, 5m at 500ms, 15m at 1s, Session at dynamic
- [ ] Stats bar (peak, avg, total, window) reflects selected window
- [ ] 1-minute window preserves approximately 10Hz update frequency
- [ ] Time window persists across aggregate/detail navigation
- [ ] Transition between windows is smooth (no data gap or flash)

### Technical Notes
- 1m window uses existing TimeSeriesBuffer ring buffer (600 samples at 10Hz)
- Wider windows require either a larger ring buffer or downsampled historical query
- Session-length window requires loading historical data from SQLite
- Resolution computation: target 300-900 data points per chart for readability
- Time window is view-level state, not global state

### Job Story Traceability
- JS-PM-3 (extended time window analysis)

### MoSCoW: Must Have

---

## US-PM-005: Context Window Pressure Monitoring

### Problem
Elena Vasquez is running a long autonomous session where the agent has been building context for 25 minutes. She finds it alarming when compaction events happen without warning -- the agent suddenly loses earlier context and its behavior changes. She has no way to predict when compaction will occur because context utilization is not visible as a trend.

### Who
- Claude Code user | Runs long sessions with context-heavy agents | Needs advance warning of context compaction to make informed decisions about session management

### Solution
The Performance Monitor includes a context window chart showing per-session context utilization as a percentage with trend lines, urgency coloring (amber at 70%, red at 90%), and an estimated time-to-compaction based on current consumption rate.

### Domain Examples

#### 1: Happy Path -- Context pressure climbing with advance warning
Elena Vasquez sees the context chart showing session "refactor-auth" at 67%, climbing steadily. The trend line suggests it will hit 70% (amber) in about 2 minutes. She recognizes this and starts wrapping up the current task before compaction occurs.

#### 2: Edge Case -- Multiple sessions at different pressure levels
Ravi Patel views the context chart with 3 sessions: one at 45% (normal), one at 67% (approaching amber), one at 82% (amber zone). The chart clearly distinguishes the three levels with color coding. He prioritizes checking the 82% session.

#### 3: Error -- Context data unavailable
Marcus Chen's session is using a model or configuration where context utilization data is not reported in event payloads. The context chart slot shows "Data unavailable -- context utilization data is not available for this session" rather than showing a misleading 0%.

### UAT Scenarios (BDD)

#### Scenario: Context chart shows per-session trend lines
Given Ravi has 3 sessions with context: 45%, 67%, 82%
When the context window chart renders
Then 3 trend lines are visible, one per session
And each line is labeled with session name and current percentage

#### Scenario: Amber urgency at 70% threshold
Given session "test-coverage" has context at 72%
When the context chart renders
Then the "test-coverage" trend line uses amber coloring
And a dashed line marks the 70% threshold

#### Scenario: Red urgency at 90% threshold
Given session "refactor-auth" has context at 93%
When the context chart renders
Then the "refactor-auth" trend line uses red coloring
And a dashed line marks the 90% threshold

#### Scenario: Estimated time to compaction
Given Elena is viewing session detail for "refactor-auth"
And context is at 67% (134k / 200k tokens)
And the current context consumption rate is approximately 500 tokens per event
When the context panel renders
Then an estimated time to compaction is displayed
And the estimate is based on current consumption rate and remaining headroom

#### Scenario: Context data unavailable handled gracefully
Given Marcus has a session where context data is not in event payloads
When the context chart renders for that session
Then the chart slot shows "Data unavailable" with explanation
And the layout remains stable
And other sessions with available data render normally

### Acceptance Criteria
- [ ] Per-session context utilization displayed as trend lines in chart
- [ ] Amber coloring applied at 70% threshold
- [ ] Red coloring applied at 90% threshold
- [ ] Dashed threshold lines visible at 70% and 90%
- [ ] Thresholds match Gauge Cluster fuel gauge zones (shared configuration)
- [ ] Time-to-compaction estimate shown in session detail view
- [ ] Graceful "Data unavailable" message when context data is missing
- [ ] Chart layout stable regardless of data availability

### Technical Notes
- Context data sourced from SessionMetrics.contextWindowPct and related fields
- Thresholds must be defined in shared configuration, not hardcoded in view
- Time-to-compaction is an estimate: (remaining_tokens / recent_consumption_rate)
- Context data accuracy depends on Claude Code reporting context usage in payloads (Assumption A1)

### Job Story Traceability
- JS-PM-4 (context window pressure monitoring)

### MoSCoW: Must Have

---

## US-PM-006: Cost Rate Trending

### Problem
Ravi Patel manages a development budget that includes AI tool costs. He finds it difficult to predict daily spend because the existing cost display shows only cumulative session cost -- a lagging indicator. He cannot answer "At this rate, how much will today cost?" without doing mental arithmetic, which is unreliable during bursty workloads.

### Who
- Claude Code power user | Managing AI development budget | Needs cost velocity as a leading indicator, not just cumulative total

### Solution
The Performance Monitor includes a cost/min chart showing rolling cost rate as a time-series waveform. The chart displays cost velocity across all active sessions with per-session breakdown, enabling users to see spending rate trends and identify cost spikes in real time.

### Domain Examples

#### 1: Happy Path -- Cost rate trending during mixed-model session
Ravi Patel views the cost/min chart. It shows $0.42/min total across 3 sessions. The Opus 4 sessions contribute $0.18/min and $0.11/min, while the Sonnet 4 session adds $0.004/min. The cost rate waveform shows a steady trend with a visible dip 3 minutes ago when one agent paused for a tool result.

#### 2: Edge Case -- Cost spike from high-output Opus response
Elena Vasquez sees the cost/min chart spike to $0.85/min for 15 seconds when an Opus 4 agent generates a large code block (3,400 output tokens at $0.075/1k). The spike is clearly visible in the waveform and the per-session breakdown shows which session caused it.

#### 3: Boundary -- Zero cost rate when all sessions idle
Marcus Chen has 2 sessions running but both agents are waiting for tool results. The cost/min chart shows a flat baseline at $0.00/min. The flat line correctly reflects zero token consumption, not a data error.

### UAT Scenarios (BDD)

#### Scenario: Cost rate chart shows rolling cost/min
Given Ravi has 3 active sessions with varying cost rates
When the cost/min chart renders
Then a time-series waveform shows rolling cost rate
And the current rate is displayed as a numeric label

#### Scenario: Cost rate reflects per-model pricing
Given Ravi has an Opus 4 session at $0.18/min and a Sonnet 4 session at $0.004/min
When the cost chart renders
Then the total cost rate reflects the sum ($0.184/min)
And per-session breakdown shows individual cost rates with correct model pricing

#### Scenario: Cost spike visible in waveform
Given Elena has a session where an Opus 4 agent generates 3,400 output tokens
When the event arrives and cost is computed
Then the cost/min chart shows a visible spike
And the spike amplitude reflects the Opus 4 output pricing

#### Scenario: Zero cost rate during idle periods
Given Marcus has sessions running but no events arriving
When the cost chart renders
Then the waveform shows a flat baseline at zero
And the numeric label shows "$0.00/min"

### Acceptance Criteria
- [ ] Cost/min displayed as rolling time-series waveform in the PM grid
- [ ] Cost rate computed using per-model pricing (same PricingTable as US-002)
- [ ] Per-session cost rate breakdown visible
- [ ] Cost spikes visible as distinct peaks in the waveform
- [ ] Zero cost correctly displayed during idle (not data error)
- [ ] Cost rate updates within 1 second of new token events

### Technical Notes
- Cost rate derived from existing CostResult computation (US-002) over rolling time window
- Uses same PricingTable configuration as existing cost computation
- Waveform rendering can reuse oscilloscope.ts pure functions (prepareWaveformPoints)
- Cost rate unit is $/min (cost per second * 60) for human readability

### Job Story Traceability
- JS-PM-5 (cost rate trending)

### MoSCoW: Must Have

---

## US-PM-007: Oscilloscope Backward Compatibility

### Problem
Ravi Patel has configured a floating panel with the oscilloscope view and relies on its ambient waveform for perceptual anomaly detection. He would find it frustrating if the Performance Monitor replaced the oscilloscope entirely -- the PM grid view serves a different attention mode (focused investigation) than the single-trace waveform (peripheral awareness).

### Who
- Claude Code power user | Has existing oscilloscope configuration | Needs the Performance Monitor to coexist with, not replace, the oscilloscope

### Solution
The Performance Monitor is registered as a new view mode alongside the existing Oscilloscope. Both views share the same data pipeline. The Oscilloscope view registration is preserved so floating panel configurations and user preferences continue to work. The oscilloscope's waveform rendering functions are reused by the PM's token rate chart.

### Domain Examples

#### 1: Happy Path -- Both views operational simultaneously
Ravi Patel has the oscilloscope in a floating panel and the Performance Monitor in the main zone. Both update in real time from the same data. The oscilloscope shows the familiar dual-trace P31 phosphor waveform for the broadcast session. The PM shows the aggregate grid across all sessions.

#### 2: Edge Case -- Switching between PM and oscilloscope modes
Elena Vasquez is in Performance Monitor mode and switches to Oscilloscope mode via the toolbar. The oscilloscope renders with its existing full-width waveform. She switches back to PM. Both transitions are instant with no data loss.

#### 3: Boundary -- Oscilloscope waveform data shared with PM token rate chart
Marcus Chen compares the oscilloscope floating panel with the PM's token rate chart for the same session. The waveform shape is identical because both use the same TimeSeriesBuffer and rendering functions.

### UAT Scenarios (BDD)

#### Scenario: Oscilloscope continues to render after PM installation
Given Ravi has configured a floating panel with the Oscilloscope view
When the Performance Monitor is registered during plugin load
Then the floating Oscilloscope panel continues to render the dual-trace waveform
And no existing view registrations are removed

#### Scenario: Both views use same data pipeline
Given Ravi has the oscilloscope in a floating panel and the PM in the main zone
When a new token event arrives for the broadcast session
Then both views update within 1 second
And the token rate shown in the oscilloscope matches the broadcast session rate in the PM

#### Scenario: Mode switching between PM and oscilloscope
Given Elena is viewing the Performance Monitor in the main zone
When she switches to Oscilloscope mode via the toolbar
Then the oscilloscope renders with full-width waveform
And switching back to PM mode restores the aggregate grid

### Acceptance Criteria
- [ ] Oscilloscope view registration preserved (not removed or replaced)
- [ ] Both views share the same MetricsStore and TimeSeriesBuffer data
- [ ] Floating panel configurations with oscilloscope continue to work
- [ ] Mode switching between PM and oscilloscope is instant
- [ ] Token rate waveform in PM reuses oscilloscope rendering functions

### Technical Notes
- No changes to existing OscilloscopeView.tsx component
- PM token rate chart calls the same prepareWaveformPoints/computeGridLines functions
- Both views subscribe to the same MetricsStore instance
- The PM is additive -- it does not modify or remove any existing registrations

### Job Story Traceability
- JS-PM-1 (subsumption strategy -- coexistence, not replacement)

### MoSCoW: Must Have

---

## Definition of Ready Validation

### US-PM-001: Performance Monitor View Registration

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "impossible to see aggregate consumption, must click through each session" |
| User/persona identified | PASS | Ravi Patel, 2-5 concurrent sessions, aggregate observability need |
| 3+ domain examples | PASS | Aggregate grid, single session, no sessions |
| UAT scenarios (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 6 acceptance criteria from scenarios |
| Right-sized (1-3 days) | PASS | ~2 days -- view registration + grid layout + empty state |
| Technical notes | PASS | registerView, MetricsAggregator reuse, coexistence constraint |
| Dependencies tracked | PASS | Depends on norbert-usage plugin infrastructure (US-001, US-002 -- complete) |

### DoR Status: PASSED

---

### US-PM-002: Multi-Session Aggregate Metrics

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "no single number for total consumption, missed runaway $8 session" |
| User/persona identified | PASS | Ravi Patel, 3-5 concurrent sessions, Opus + Sonnet mix |
| 3+ domain examples | PASS | 3-session aggregate, session starts during view, session ends during view |
| UAT scenarios (3-7) | PASS | 5 scenarios |
| AC derived from UAT | PASS | 8 acceptance criteria covering all scenarios |
| Right-sized (1-3 days) | PASS | ~2 days -- aggregate computation + lifecycle handling |
| Technical notes | PASS | New AggregateMetrics type, session lifecycle events, race condition handling |
| Dependencies tracked | PASS | Depends on US-PM-001 (view), US-002 (SessionMetrics data) |

### DoR Status: PASSED

---

### US-PM-003: Session Drill-Down Navigation

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "identifying spike source requires 30-60s per session in broadcast bar" |
| User/persona identified | PASS | Ravi Patel, investigating anomalies, needs fast root-cause navigation |
| 3+ domain examples | PASS | Spike investigation drill-down, round-trip navigation, session ends during detail |
| UAT scenarios (3-7) | PASS | 5 scenarios |
| AC derived from UAT | PASS | 6 acceptance criteria from scenarios |
| Right-sized (1-3 days) | PASS | ~2 days -- detail view + navigation state + agent breakdown |
| Technical notes | PASS | View-level navigation, agent attribution, compaction estimate, state preservation |
| Dependencies tracked | PASS | Depends on US-PM-001 (view), US-PM-002 (aggregate data) |

### DoR Status: PASSED

---

### US-PM-004: Configurable Time Window

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "60-second window useless for understanding 45-minute session pattern" |
| User/persona identified | PASS | Ravi Patel, reviewing session history, needs temporal context |
| 3+ domain examples | PASS | 1m-to-15m switch, session-length window, return to 1m |
| UAT scenarios (3-7) | PASS | 6 scenarios |
| AC derived from UAT | PASS | 7 acceptance criteria from scenarios |
| Right-sized (1-3 days) | PASS | ~3 days -- multi-resolution buffers + historical loading + state persistence |
| Technical notes | PASS | Ring buffer sizing, downsampled queries, 300-900 point target, view-level state |
| Dependencies tracked | PASS | Depends on US-PM-001 (view), existing TimeSeriesBuffer infrastructure |

### DoR Status: PASSED

---

### US-PM-005: Context Window Pressure Monitoring

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "compaction events happen without warning, agent behavior changes suddenly" |
| User/persona identified | PASS | Elena Vasquez, long sessions, context-heavy agents |
| 3+ domain examples | PASS | Climbing pressure with warning, multi-session pressure levels, data unavailable |
| UAT scenarios (3-7) | PASS | 5 scenarios |
| AC derived from UAT | PASS | 8 acceptance criteria from scenarios |
| Right-sized (1-3 days) | PASS | ~2 days -- context chart + threshold coloring + compaction estimate |
| Technical notes | PASS | Shared threshold config, compaction estimate formula, Assumption A1 dependency |
| Dependencies tracked | PASS | Depends on US-PM-001 (view), US-002 (SessionMetrics.contextWindowPct) |

### DoR Status: PASSED

---

### US-PM-006: Cost Rate Trending

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "cannot predict daily spend, cumulative cost is lagging indicator" |
| User/persona identified | PASS | Ravi Patel, budget management, needs leading cost indicator |
| 3+ domain examples | PASS | Mixed-model cost trending, cost spike from Opus output, zero rate during idle |
| UAT scenarios (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 6 acceptance criteria from scenarios |
| Right-sized (1-3 days) | PASS | ~1 day -- cost rate derivation + waveform reuse + per-session breakdown |
| Technical notes | PASS | CostResult reuse, PricingTable sharing, oscilloscope function reuse |
| Dependencies tracked | PASS | Depends on US-PM-001 (view), US-002 (cost computation pipeline) |

### DoR Status: PASSED

---

### US-PM-007: Oscilloscope Backward Compatibility

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "PM replacing oscilloscope would lose ambient waveform for peripheral awareness" |
| User/persona identified | PASS | Ravi Patel, existing oscilloscope floating panel configuration |
| 3+ domain examples | PASS | Both views operational, mode switching, shared waveform data |
| UAT scenarios (3-7) | PASS | 3 scenarios |
| AC derived from UAT | PASS | 5 acceptance criteria from scenarios |
| Right-sized (1-3 days) | PASS | ~1 day -- verify no regressions, shared data pipeline |
| Technical notes | PASS | No changes to OscilloscopeView, shared MetricsStore, additive registration |
| Dependencies tracked | PASS | Depends on existing oscilloscope (US-005 -- complete) |

### DoR Status: PASSED

---

## Story Dependency Graph

```
norbert-usage foundation (US-001, US-002) -- complete
   |
   v
US-PM-001 Performance Monitor View Registration
   |
   +------+------+
   |      |      |
   v      v      v
US-PM-002  US-PM-005  US-PM-006
Aggregate  Context    Cost Rate
Metrics    Pressure   Trending
   |
   v
US-PM-003 Session Drill-Down Navigation
   |
   v
US-PM-004 Configurable Time Window

US-PM-007 Oscilloscope Backward Compat (independent, parallel with any)
```

## Story Summary

| ID | Title | Size | Scenarios | MoSCoW | Job Stories |
|----|-------|------|-----------|--------|-------------|
| US-PM-001 | Performance Monitor View Registration | 2 days | 4 | Must Have | JS-PM-1 |
| US-PM-002 | Multi-Session Aggregate Metrics | 2 days | 5 | Must Have | JS-PM-1, JS-PM-2 |
| US-PM-003 | Session Drill-Down Navigation | 2 days | 5 | Must Have | JS-PM-2 |
| US-PM-004 | Configurable Time Window | 3 days | 6 | Must Have | JS-PM-3 |
| US-PM-005 | Context Window Pressure Monitoring | 2 days | 5 | Must Have | JS-PM-4 |
| US-PM-006 | Cost Rate Trending | 1 day | 4 | Must Have | JS-PM-5 |
| US-PM-007 | Oscilloscope Backward Compatibility | 1 day | 3 | Must Have | JS-PM-1 |

**Total estimated effort**: 13 days
**Total scenarios**: 32
