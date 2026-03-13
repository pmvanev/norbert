<!-- markdownlint-disable MD024 -->

# norbert-usage User Stories

---

## US-001: Plugin Registration and Lifecycle

### Problem
Ravi Patel is a Claude Code power user who wants to see token and cost data inside Norbert. He finds it impossible to get this data because the norbert-usage plugin does not yet exist -- there is no plugin registering the views, tabs, and hooks needed to surface usage metrics.

### Who
- Claude Code power user | Has Norbert installed with plugin system active | Wants usage observability without additional tooling

### Solution
The norbert-usage plugin implements the NorbertPlugin interface, registering its three views (Gauge Cluster, Oscilloscope, Usage Dashboard), one sidebar tab, one status bar item (cost ticker), and a hook processor for session events during onLoad. It cleans up all registrations during onUnload.

### Domain Examples

#### 1: Happy Path -- Plugin loads and registers all components
Ravi Patel launches Norbert. The plugin system resolves norbert-usage (no dependencies on other plugins). During onLoad, the plugin calls api.ui.registerView three times, api.ui.registerTab once, api.ui.registerStatusItem once, and api.hooks.register to process session events. All registrations succeed. Ravi sees a "Usage" tab icon in the sidebar.

#### 2: Edge Case -- Plugin reloads after disable/enable cycle
Elena Vasquez disables norbert-usage in Norbert settings to troubleshoot a different plugin. She re-enables it. onUnload runs cleanly, then onLoad runs again. All views and tabs re-register. Elena sees the Usage tab icon reappear with no stale state.

#### 3: Error -- Plugin encounters API version mismatch
Marcus Chen runs an older version of Norbert core that does not support registerStatusItem. The plugin's onLoad attempts to register a status item and receives an error result. The plugin logs the issue and continues with degraded functionality (views and tab still register; status bar item missing).

### UAT Scenarios (BDD)

#### Scenario: Plugin registers all views and tab on load
Given the Norbert plugin system has loaded the norbert-usage manifest
And the manifest declares id "norbert-usage" and norbert_api ">=1.0"
When the plugin system calls onLoad with the NorbertAPI
Then the plugin registers view "gauge-cluster" with label "Gauge Cluster" and floatMetric "session_cost"
And the plugin registers view "oscilloscope" with label "Oscilloscope"
And the plugin registers view "usage-dashboard" with label "Usage Dashboard" and primaryView true
And the plugin registers tab "usage" with icon and label "Usage"
And the plugin registers status item "cost-ticker" with position "right"

#### Scenario: Plugin registers hook processor for session events
Given norbert-usage is loaded
When onLoad completes
Then the plugin has registered a hook processor via api.hooks.register
And the hook processor will be called for incoming session events

#### Scenario: Plugin cleans up on unload
Given norbert-usage is loaded and all registrations are active
When the plugin system calls onUnload
Then the plugin releases all resources
And no stale event listeners remain

#### Scenario: Plugin handles partial API availability
Given Norbert core does not support the registerStatusItem method
When norbert-usage attempts to register the cost ticker status item
Then the plugin logs a warning about the unsupported API
And the plugin continues operating with views and tab registered

### Acceptance Criteria
- [ ] Plugin implements NorbertPlugin interface with manifest, onLoad, and onUnload
- [ ] onLoad registers 3 views, 1 tab, 1 status item, and 1 hook processor
- [ ] onUnload cleans up all registrations and listeners
- [ ] Plugin operates with degraded functionality when optional API methods are unavailable

### Technical Notes
- Must conform to NorbertPlugin interface in src/plugins/types.ts
- Views registered via RegisterViewInput; tab via RegisterTabInput; status item via RegisterStatusItemInput
- Hook processor receives raw event payloads from the session_events stream
- Plugin has zero dependencies on other plugins (dependencies: {} in manifest)

### Job Story Traceability
- JS-1, JS-2, JS-3, JS-4 (all jobs require the plugin to be registered)

### MoSCoW: Must Have

---

## US-002: Token and Cost Data Extraction from Hook Events

### Problem
Ravi Patel is a Claude Code power user who runs long autonomous sessions. He finds it frustrating that raw hook events in the session_events table contain token data but nothing aggregates or computes costs from that data -- he has numbers in a database but no way to see them as meaningful metrics.

### Who
- Claude Code power user | Runs multi-agent sessions with Opus and Sonnet models | Needs accurate, real-time cost calculation

### Solution
The norbert-usage plugin processes hook events from the session_events table, extracts token counts (input and output), applies a pricing model to compute dollar costs, and maintains running aggregates (session cost, token totals, burn rate, tool call count) that all views consume.

### Domain Examples

#### 1: Happy Path -- Computing cost from a prompt_submit event
Ravi Patel's session "refactor-auth" on Opus 4 generates a prompt_submit event with 1,200 input tokens and 3,400 output tokens. The plugin computes: cost = (1200 * $0.015/1k) + (3400 * $0.075/1k) = $0.018 + $0.255 = $0.273. Running session cost updates from $1.20 to $1.47.

#### 2: Edge Case -- Mixed model session
Elena Vasquez runs a session where the coordinator uses Opus 4 and specialists use Sonnet 4. A specialist event arrives with 800 input tokens at the Sonnet price ($0.003/1k). The plugin applies the correct model pricing: cost = (800 * $0.003/1k) + (2000 * $0.015/1k) = $0.0024 + $0.030 = $0.032. The total accurately reflects mixed-model pricing.

#### 3: Error -- Event arrives with missing token fields
Marcus Chen's session produces a tool_call_start event that does not include token count fields (tool calls do not always carry token data). The plugin increments the tool call counter but does not modify token or cost aggregates. No false zero is injected.

### UAT Scenarios (BDD)

#### Scenario: Computing session cost from token events
Given Ravi Patel has an active session "refactor-auth" using Opus 4
And the session has accumulated $1.20 in cost from previous events
When a prompt_submit event arrives with 1,200 input tokens and 3,400 output tokens
Then the session cost updates to $1.47
And the total token count increases by 4,600
And the input/output breakdown reflects 1,200 in and 3,400 out

#### Scenario: Applying correct pricing for mixed-model sessions
Given Elena Vasquez has a session with coordinator on Opus 4 and specialist on Sonnet 4
When a specialist event arrives with 800 input tokens and 2,000 output tokens
Then the cost for that event is calculated at Sonnet 4 pricing
And the running session cost accumulates the Sonnet-priced amount

#### Scenario: Handling events without token data
Given Marcus Chen has an active session
When a tool_call_start event arrives without input_tokens or output_tokens fields
Then the tool call count increments by 1
And the session cost remains unchanged
And the total token count remains unchanged

#### Scenario: Computing token burn rate from event stream
Given Ravi Patel has an active session generating events
And 3 events arrived in the last second totaling 1,500 tokens
When the burn rate is recalculated
Then the token burn rate shows approximately 1,500 tokens per second
And the rate is based on a rolling time window

#### Scenario: Deriving active agent count from events
Given Ravi Patel has a session with events: 2 session_start events and 0 agent_complete events
When the active agent count is calculated
Then the count shows 2 active agents

### Acceptance Criteria
- [ ] Token counts extracted from hook event payloads (input_tokens, output_tokens)
- [ ] Cost calculated by applying per-model pricing to token counts
- [ ] Running session cost accumulates correctly across all events in a session
- [ ] Token burn rate derived from rolling time window of recent events
- [ ] Tool call count derived from tool_call_start events
- [ ] Active agent count derived from session_start minus agent_complete events
- [ ] Events without token data handled gracefully (no false zeros)

### Technical Notes
- Six canonical event types: session_start, session_end, tool_call_start, tool_call_end, agent_complete, prompt_submit
- Pricing model must be configurable (model prices change over time)
- Token data may be in event payload as nested JSON fields
- Burn rate window size should be configurable (default: rolling 10s)

### Job Story Traceability
- JS-1 (cost awareness), JS-2 (consumption patterns)

### MoSCoW: Must Have

---

## US-003: Gauge Cluster Dashboard View

### Problem
Ravi Patel is a Claude Code power user who monitors long autonomous sessions. He finds it tedious to check multiple separate metrics one by one -- he wants a single instrument panel where he can absorb session health in a quick glance, the way a driver reads a car dashboard without conscious effort.

### Who
- Claude Code power user | Monitors sessions in peripheral vision | Values urgency-aware visual communication over raw numbers

### Solution
The Gauge Cluster is a purpose-built view displaying 6 instruments (Tachometer, Fuel Gauge, Odometer, RPM Counter, Warning Cluster, Clock) in a 3x2 grid. Each instrument maps a metric to a gauge form that communicates urgency through shape, not just numbers. The view registers with floatMetric support so it can operate as a floating panel, minimizing to a cost pill.

### Domain Examples

#### 1: Happy Path -- All instruments green, nominal session
Ravi Patel is running a standard Opus 4 session. The tachometer shows 150 tok/s (well below redline), fuel gauge at 25% (cool zone), odometer at $0.83, RPM at 1 agent, all warning indicators green, clock at 00:12:30. Ravi glances at the cluster and confirms everything is normal in under 2 seconds.

#### 2: Edge Case -- Context window approaching limit
Elena Vasquez has a session where the agent has consumed 142k of 200k context tokens. The fuel gauge is in the amber zone at 71%. She recognizes the amber color in peripheral vision and decides to check whether the agent will hit compaction soon.

#### 3: Boundary -- Multiple urgency signals simultaneously
Marcus Chen has a session with 3 agents, burn rate at 520 tok/s (above redline), context at 92% (red zone), and hook latency spiking. The tachometer is in redline, fuel gauge is red, warning cluster shows amber for latency. Marcus immediately intervenes -- the simultaneous urgency signals are impossible to miss.

### UAT Scenarios (BDD)

#### Scenario: Gauge Cluster displays all six instruments
Given Ravi Patel has an active session "refactor-auth" broadcast in context
And current metrics are: 150 tok/s burn rate, 25% context, $0.83 cost, 1 agent, hooks healthy, 12m 30s elapsed
When Ravi opens the Gauge Cluster view
Then the tachometer displays 150 tok/s
And the fuel gauge displays 25%
And the odometer displays $0.83 with rolling digits
And the RPM counter displays 1 agent
And the warning cluster shows all indicators green
And the clock displays 00:12:30

#### Scenario: Fuel gauge transitions to amber at 70% threshold
Given Elena Vasquez has a session with context utilization climbing
When context utilization reaches 70%
Then the fuel gauge transitions to amber zone coloring
And the amber zone is visually distinct from the normal cool zone

#### Scenario: Fuel gauge transitions to red at 90% threshold
Given Elena Vasquez has a session with context utilization at 89%
When context utilization reaches 90%
Then the fuel gauge transitions to red zone coloring

#### Scenario: Tachometer enters redline at sustained high rate
Given Marcus Chen has a session with token burn rate at 520 tok/s
When the sustained high rate exceeds the redline threshold
Then the tachometer sweep enters the redline zone

#### Scenario: Gauge Cluster minimizes to cost pill
Given Ravi Patel has the Gauge Cluster as a floating panel showing $0.83
When Ravi minimizes the floating panel
Then the panel collapses to a pill showing "$0.83"
And the pill continues to update as cost changes

#### Scenario: Gauge Cluster responds to broadcast context change
Given Ravi Patel has the Gauge Cluster showing metrics for session "refactor-auth"
When Ravi selects session "migrate-db" in the broadcast bar
Then all six instruments update to show metrics for "migrate-db"

### Acceptance Criteria
- [ ] 6 instruments displayed in 3x2 grid layout
- [ ] Tachometer shows token burn rate with redline zone at sustained high rate
- [ ] Fuel gauge shows context utilization with amber at 70% and red at 90%
- [ ] Odometer shows session cost with rolling digit animation
- [ ] RPM counter shows active agent count
- [ ] Warning cluster shows hook health/DES/anomaly indicators as colored lights
- [ ] Clock shows session elapsed time
- [ ] View registers with floatMetric "session_cost" for floating panel support
- [ ] Floating panel minimizes to pill showing current session cost
- [ ] All instruments respond to broadcast context session changes

### Technical Notes
- Registered via api.ui.registerView with floatMetric: "session_cost"
- 3x2 grid layout at approximately 330px width
- Urgency thresholds: fuel gauge amber at 70%, red at 90%; tachometer redline is configurable
- All instrument data sourced from norbert-usage computed metrics (same data as Dashboard)

### Job Story Traceability
- JS-4 (ambient monitoring without context switching), JS-1 (cost awareness)

### MoSCoW: Must Have

---

## US-004: Cost Burn Ticker in Broadcast Bar and Status Bar

### Problem
Ravi Patel is a Claude Code power user who wants cost awareness without navigating to a specific view. He finds it disorienting that cost information disappears when he switches between views -- he needs a persistent, always-visible cost number regardless of which plugin is active.

### Who
- Claude Code power user | Switches between multiple Norbert views during a session | Needs persistent ambient cost awareness

### Solution
The norbert-usage plugin registers a status bar item (cost ticker) that displays the current session cost persistently at the bottom of the Norbert window. This supplements the broadcast bar cost ticker (which is part of Norbert core). The status item updates in real time with odometer-style digit roll animation.

### Domain Examples

#### 1: Happy Path -- Cost visible across all views
Ravi Patel switches from the Oscilloscope to the Configuration Viewer. The status bar cost ticker continues to show "$1.47" and increments to "$1.51" as a new response completes. He never loses sight of cost.

#### 2: Edge Case -- Cost color shift at session average
Elena Vasquez has a session where her average session cost is $3.00. The current session reaches $2.80 and the cost ticker subtly shifts from brand color toward amber, indicating she is approaching her average. At $4.50 it shifts toward red.

#### 3: Error -- No active session
Marcus Chen opens Norbert with no session running. The status bar cost ticker shows "$0.00" in dim text. No animation runs.

### UAT Scenarios (BDD)

#### Scenario: Status bar cost ticker persists across view changes
Given Ravi Patel has an active session with cost "$1.47"
And the cost ticker is visible in the status bar
When Ravi switches from the Oscilloscope view to the Configuration Viewer
Then the status bar still shows "$1.47"
And the ticker continues to update as new events arrive

#### Scenario: Cost ticker updates with digit roll animation
Given Ravi Patel has the cost ticker showing "$1.47"
When a new event adds $0.04 to the session cost
Then the cost ticker rolls to "$1.51" with odometer-style animation
And individual digit columns animate upward

#### Scenario: Cost ticker color shifts at session average
Given Elena Vasquez has a historical session average cost of $3.00
And her current session cost is $2.79
When the session cost crosses $3.00
Then the cost ticker color shifts from brand toward amber

#### Scenario: Cost ticker shows zero for no active session
Given Marcus Chen has no active Claude Code session
When he views the Norbert status bar
Then the cost ticker shows "$0.00" in dim text

### Acceptance Criteria
- [ ] Cost ticker registered via api.ui.registerStatusItem with position "right"
- [ ] Ticker displays current session cost and updates within 1 second of new events
- [ ] Odometer-style digit roll animation on value change
- [ ] Color shifts subtly from brand toward amber (approaching average) and red (exceeding average)
- [ ] Persists at bottom of window regardless of which view is active
- [ ] Shows "$0.00" in dim state when no session is active

### Technical Notes
- Registered via api.ui.registerStatusItem: { id: "cost-ticker", position: "right" }
- StatusItemHandle.update() called on each cost change with new label
- Animation is a UX detail for DESIGN wave; requirement is that the value updates visibly and smoothly
- Color shift thresholds based on user's rolling session average (computed by plugin)

### Job Story Traceability
- JS-1 (cost awareness), JS-4 (ambient monitoring)

### MoSCoW: Must Have

---

## US-005: Token Burn Oscilloscope View

### Problem
Ravi Patel is a Claude Code power user who runs long autonomous sessions with multiple agents. He finds it impossible to tell from numbers alone whether a session's activity pattern is normal -- a flat "327 tok/s" average hides whether the agent is steadily streaming, looping tool calls, or stuck idle. He needs to see the texture of activity.

### Who
- Claude Code power user | Monitors autonomous sessions for anomalies | Needs perceptual anomaly detection, not just metrics

### Solution
The Token Burn Oscilloscope renders a continuous waveform scrolling right-to-left at ~10Hz showing token burn rate and cost burn rate as two simultaneous traces over a 60-second window. The waveform shape makes activity patterns (idle, streaming, bursting, hung) perceptually obvious without reading numbers.

### Domain Examples

#### 1: Happy Path -- Reading a normal session waveform
Ravi Patel views the Oscilloscope during a session where the agent is alternating between reading files (short spikes) and writing code (sustained plateaus). The waveform shows a pattern of: spike-plateau-dip-spike-plateau. Ravi recognizes this as normal productive activity.

#### 2: Edge Case -- Detecting a hung agent from flat waveform
Elena Vasquez glances at the Oscilloscope and sees a completely flat baseline for the last 20 seconds during what should be an active session. The flat line is immediately alarming -- something has hung. She switches to the terminal and finds the agent waiting for a permission prompt.

#### 3: Boundary -- Rapid tool call looping visible as dense spikes
Marcus Chen sees the Oscilloscope showing rapid, dense, repeated spikes at approximately 200ms intervals. The pattern is distinctly different from a steady stream. He recognizes the agent is in a bash loop making many quick file reads. The cost trace (amber) stays low despite high token throughput because the reads are small.

### UAT Scenarios (BDD)

#### Scenario: Oscilloscope renders dual-trace waveform
Given Ravi Patel has an active session with token events arriving
When Ravi views the Oscilloscope
Then a token rate trace renders in brand color scrolling right-to-left
And a cost rate trace renders in amber on the same time axis
And both traces cover a 60-second window

#### Scenario: Oscilloscope stats bar shows summary metrics
Given Ravi Patel has an active session with peak rate 512 tok/s and average 327 tok/s
When Ravi views the Oscilloscope stats bar
Then it shows peak rate "512 tok/s"
And average rate "327 tok/s"
And total tokens "87,241"
And window duration "60s"

#### Scenario: Flat baseline visible during idle period
Given Elena Vasquez has an active session where no events arrive for 15 seconds
When she views the Oscilloscope
Then the last 15 seconds of the waveform show a flat baseline
And the flat pattern is perceptually distinct from active periods

#### Scenario: Sharp spikes visible during rapid tool calls
Given Marcus Chen has a session with tool calls arriving every 200ms
When he views the Oscilloscope
Then the waveform shows rapid repeated sharp spikes
And the spike pattern is perceptually distinct from a sustained plateau

#### Scenario: Sustained plateau visible during streaming response
Given Ravi Patel has a session with a steady 400 tok/s stream for 15 seconds
When he views the Oscilloscope
Then the waveform shows a sustained plateau at the 400 tok/s level

#### Scenario: Oscilloscope shows current rate overlay
Given Ravi Patel has an active session with current burn rate 327 tok/s
When he views the Oscilloscope
Then the current rate "327 tok/s" is displayed as an overlay on the waveform

### Acceptance Criteria
- [ ] Continuous waveform scrolls right-to-left at approximately 10Hz refresh rate
- [ ] Two simultaneous traces: token rate (brand color) and cost rate (amber)
- [ ] 60-second rolling window
- [ ] Stats bar shows peak rate, average rate, total tokens, and window duration
- [ ] Flat baseline, sharp spikes, sustained plateaus, and rapid bursts are perceptually distinct
- [ ] Current rate displayed as overlay
- [ ] View responds to broadcast context session changes
- [ ] Grid lines at time intervals visible on waveform background

### Technical Notes
- Rendered on HTML canvas (not SVG for performance at 10Hz update rate)
- Registered via api.ui.registerView without primaryView (secondary/floating view)
- In Norbert theme: P31 phosphor green trace with persistence/afterglow effect; in other themes: clean line
- Canvas must handle window resize gracefully

### Job Story Traceability
- JS-3 (detecting anomalous behavior in real time)

### MoSCoW: Must Have

---

## US-006: Default Usage Dashboard View

### Problem
Elena Vasquez is a Claude Code user who has just opened Norbert. She finds it overwhelming to piece together session health from multiple separate instruments -- she wants a single, well-designed overview that shows her the metrics that matter most without any configuration or setup.

### Who
- Claude Code user (new or experienced) | Opens Norbert to check on session status | Values a curated, hand-tuned layout over customization

### Solution
The norbert-usage plugin registers a primary view "Usage Dashboard" showing 6 metric cards (Running Cost, Token Count, Active Agents, Tool Calls, Context Window, Hook Health) and a 7-day burn chart in a fixed, hand-tuned layout. This is the default view when Norbert opens.

### Domain Examples

#### 1: Happy Path -- Complete dashboard for active session
Elena Vasquez opens Norbert during an active Opus 4 session. The dashboard shows: running cost $2.30, tokens 112,400 (62k in / 50k out), 1 active agent, 89 tool calls, context at 56%, hooks healthy. The 7-day chart shows this is her third day of heavy usage this week.

#### 2: Edge Case -- Dashboard for historical review (no active session)
Ravi Patel opens Norbert in the evening with no active session. The metric cards show the most recent session's final values. The 7-day chart is fully populated. A subtle label indicates "Last session: 2h ago."

#### 3: Error -- First-time user with no data
Marcus Chen installs Norbert for the first time. The dashboard shows zeroed/placeholder metric cards and an onboarding prompt: "Start a Claude Code session with hooks enabled to see live metrics here." The 7-day chart is empty.

### UAT Scenarios (BDD)

#### Scenario: Dashboard displays six metric cards for active session
Given Elena Vasquez has an active session "user-auth-rewrite" with $2.30 cost, 112,400 tokens, 1 agent, 89 tool calls, 56% context, healthy hooks
When Elena opens the Usage Dashboard
Then the running cost card shows "$2.30"
And the token count card shows "112,400" with breakdown "62k in / 50k out"
And the active agents card shows "1"
And the tool calls card shows "89"
And the context window card shows "56%"
And the hook health card shows "OK"

#### Scenario: Dashboard shows 7-day burn chart
Given Elena Vasquez has daily costs over the past 7 days: $4.20, $6.10, $3.80, $8.50, $5.20, $2.90, $3.10
When Elena views the Usage Dashboard
Then the 7-day burn chart shows one bar per day
And the bars are proportional to daily cost values

#### Scenario: Dashboard shows onboarding state for new user
Given Marcus Chen has no session history in Norbert
When Marcus opens the Usage Dashboard
Then the metric cards show placeholder values
And an onboarding prompt explains how to configure hooks and start a session

#### Scenario: Dashboard updates metric cards in real time
Given Elena Vasquez has the Usage Dashboard open showing cost "$2.30"
When a new event adds $0.15 to the session cost
Then the running cost card updates to "$2.45"

#### Scenario: Dashboard is the primary view
Given norbert-usage has registered the "usage-dashboard" view with primaryView: true
When the user opens the Usage tab
Then the Usage Dashboard is the default view displayed

### Acceptance Criteria
- [ ] 6 metric cards displayed in a fixed layout: Running Cost, Token Count, Active Agents, Tool Calls, Context Window, Hook Health
- [ ] Token count card includes input/output breakdown
- [ ] 7-day burn chart shows daily cost history as bars
- [ ] All cards update in real time during active sessions
- [ ] Onboarding state shown when no session history exists
- [ ] View registered as primaryView: true (default when Usage tab selected)
- [ ] Layout is hand-tuned (not generated from configuration)

### Technical Notes
- Registered via api.ui.registerView with primaryView: true
- Purpose-built React component, not derived from widget registry
- Exposes live metrics via api.data for other plugins to consume (good plugin citizenship)
- Does not depend on norbert-dashboard plugin

### Job Story Traceability
- JS-2 (understanding token consumption patterns), JS-1 (cost awareness)

### MoSCoW: Must Have

---

## Definition of Ready Validation

### US-001: Plugin Registration and Lifecycle

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "norbert-usage plugin does not yet exist -- no views, tabs, or hooks registered" |
| User/persona identified | PASS | Ravi Patel, Claude Code power user wanting usage observability |
| 3+ domain examples | PASS | Happy path (full registration), edge (disable/enable cycle), error (API mismatch) |
| UAT scenarios (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 4 acceptance criteria from scenarios |
| Right-sized (1-3 days) | PASS | ~1 day -- plugin skeleton with registrations |
| Technical notes | PASS | NorbertPlugin interface, RegisterViewInput, RegisterTabInput, zero dependencies |
| Dependencies tracked | PASS | No plugin dependencies; depends on Norbert core plugin system (Phase 3, complete) |

### DoR Status: PASSED

---

### US-002: Token and Cost Data Extraction

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "raw hook events contain token data but nothing aggregates or computes costs" |
| User/persona identified | PASS | Ravi Patel, multi-agent sessions with Opus and Sonnet |
| 3+ domain examples | PASS | Opus cost calculation, mixed-model pricing, missing token fields |
| UAT scenarios (3-7) | PASS | 5 scenarios |
| AC derived from UAT | PASS | 7 acceptance criteria covering all scenarios |
| Right-sized (1-3 days) | PASS | ~2 days -- event processing + metric computation |
| Technical notes | PASS | 6 canonical event types, configurable pricing, nested JSON fields, burn rate window |
| Dependencies tracked | PASS | Depends on US-001 (plugin registration). session_events table exists (core). |

### DoR Status: PASSED

---

### US-003: Gauge Cluster Dashboard View

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "tedious to check multiple metrics one by one" -- needs single instrument panel |
| User/persona identified | PASS | Ravi Patel, monitors in peripheral vision, values urgency-aware visuals |
| 3+ domain examples | PASS | Nominal session, amber zone context, multiple simultaneous urgency signals |
| UAT scenarios (3-7) | PASS | 6 scenarios |
| AC derived from UAT | PASS | 10 acceptance criteria covering all instruments and floating behavior |
| Right-sized (1-3 days) | PASS | ~3 days -- 6 instrument components + floating panel support |
| Technical notes | PASS | RegisterViewInput with floatMetric, 330px width, urgency thresholds |
| Dependencies tracked | PASS | Depends on US-001 (registration) and US-002 (metric computation) |

### DoR Status: PASSED

---

### US-004: Cost Burn Ticker

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "cost disappears when switching between views" -- needs persistent display |
| User/persona identified | PASS | Ravi Patel, switches between views, needs ambient awareness |
| 3+ domain examples | PASS | Persistent across views, color shift at average, no active session |
| UAT scenarios (3-7) | PASS | 4 scenarios |
| AC derived from UAT | PASS | 6 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~1 day -- status item registration + update logic |
| Technical notes | PASS | RegisterStatusItemInput, StatusItemHandle.update(), animation detail for DESIGN |
| Dependencies tracked | PASS | Depends on US-001 (registration) and US-002 (cost computation) |

### DoR Status: PASSED

---

### US-005: Token Burn Oscilloscope

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "impossible to tell from numbers alone whether activity pattern is normal" |
| User/persona identified | PASS | Ravi Patel, monitors autonomous sessions, needs perceptual anomaly detection |
| 3+ domain examples | PASS | Normal waveform reading, hung agent detection, rapid loop pattern |
| UAT scenarios (3-7) | PASS | 6 scenarios |
| AC derived from UAT | PASS | 8 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~3 days -- canvas waveform with dual trace, 10Hz rendering |
| Technical notes | PASS | Canvas rendering, 10Hz refresh, phosphor effect in Norbert theme, resize handling |
| Dependencies tracked | PASS | Depends on US-001 (registration) and US-002 (timeseries data) |

### DoR Status: PASSED

---

### US-006: Default Usage Dashboard

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "overwhelming to piece together health from multiple instruments" |
| User/persona identified | PASS | Elena Vasquez, new or experienced user, values curated overview |
| 3+ domain examples | PASS | Active session dashboard, historical review, first-time user |
| UAT scenarios (3-7) | PASS | 5 scenarios |
| AC derived from UAT | PASS | 7 acceptance criteria |
| Right-sized (1-3 days) | PASS | ~2 days -- 6 metric cards + 7-day chart |
| Technical notes | PASS | primaryView: true, React component, api.data exposure, no norbert-dashboard dependency |
| Dependencies tracked | PASS | Depends on US-001 (registration) and US-002 (all metric data) |

### DoR Status: PASSED

---

## Story Dependency Graph

```
US-001 Plugin Registration
   |
   v
US-002 Token/Cost Data Extraction
   |
   +------+------+------+
   |      |      |      |
   v      v      v      v
US-003 US-004 US-005 US-006
Gauge  Cost   Osc.   Default
Cluster Ticker        Dashboard
```

## Story Summary

| ID | Title | Size | Scenarios | MoSCoW | Job Stories |
|----|-------|------|-----------|--------|-------------|
| US-001 | Plugin Registration and Lifecycle | 1 day | 4 | Must Have | JS-1,2,3,4 |
| US-002 | Token/Cost Data Extraction | 2 days | 5 | Must Have | JS-1,2 |
| US-003 | Gauge Cluster Dashboard View | 3 days | 6 | Must Have | JS-4,1 |
| US-004 | Cost Burn Ticker | 1 day | 4 | Must Have | JS-1,4 |
| US-005 | Token Burn Oscilloscope | 3 days | 6 | Must Have | JS-3 |
| US-006 | Default Usage Dashboard | 2 days | 5 | Must Have | JS-2,1 |
