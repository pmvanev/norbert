# Journey: Usage Monitoring -- Visual Map

## Journey Flow

```
[TRIGGER]              [STEP 1]               [STEP 2]              [STEP 3]              [STEP 4]              [STEP 5]
User opens      -->  Broadcast bar     -->  Gauge Cluster    -->  Oscilloscope     -->  Default           -->  Floating
Norbert during       shows live cost        shows 6 gauges       shows live            Dashboard              panel mode
active session       + session context      at a glance          waveform              shows full metrics     for ambient
                                                                                                              monitoring

Feels: Curious       Feels: Oriented        Feels: Informed      Feels: Aware         Feels: Empowered      Feels: Confident
       "What's       "I know which          "I see the big       "I can read          "I have the           "I can work
        happening?"   session and cost"      picture"             the texture"          full picture"          and monitor"
```

## Emotional Arc

```
Confident  |                                                          ***********
           |                                                    *****           ************
Informed   |                                              *****
           |                                        *****
Oriented   |                                  *****
           |                            *****
Curious    |                      *****
           |                *****
Anxious    |  *************
           +---+----------+----------+-----------+----------+-----------+---->
              Open      Broadcast   Gauge       Oscilloscope Dashboard  Floating
              Norbert   Bar         Cluster                             Panel
```

**Arc Pattern:** Confidence Building
- Start: Anxious/Curious -- "What is this session costing me?"
- Middle: Oriented/Informed -- "I see the numbers, I see the patterns"
- End: Confident/Empowered -- "I can monitor without losing focus on my work"

---

## Step 1: Broadcast Bar -- Session Context and Cost Ticker

The broadcast bar is always visible. It orients the user immediately upon opening Norbert.

```
+==========================================================================================+
| [# Context: cc:opus-4 -- refactor-auth v]  [* live]          [$1.47  | 87k tokens]      |
+==========================================================================================+
```

**What the user sees:**
- Session context picker on the left (which session is being monitored)
- Live indicator dot in the middle
- Cost ticker on the right: current session cost + total token count
- Cost ticker updates in real time with odometer digit-roll animation

**Shared Artifacts:**
- `${session_id}` -- from broadcast bar selection, consumed by all subscribed views
- `${session_cost}` -- aggregated from hook event token counts, displayed in broadcast bar and Gauge Cluster
- `${total_tokens}` -- sum of input + output tokens for broadcast session

**Emotional Transition:** Anxious -> Oriented
- User sees cost immediately without navigating anywhere
- Live dot confirms the session is actively being tracked

---

## Step 2: Gauge Cluster -- Instrument Panel Overview

The Gauge Cluster is the signature floating HUD. It can render as a floating panel or in a zone.

```
+-------------------------------------------------------+
|  GAUGE CLUSTER                                  [_][x] |
+-------------------+-------------------+-----------------+
|   TACHOMETER      |   FUEL GAUGE      |   ODOMETER      |
|                   |                   |                  |
|   .-~~~-.         |   .---.           |   [  $01.47  ]  |
|  /  327  \        |   |###|  43%      |    rolling      |
| |  tok/s  |       |   |###|           |    digits       |
|  \ _____ /        |   |   |           |                  |
|   redline @500    |   amber @70%      |   session cost   |
+-------------------+-------------------+-----------------+
|   RPM COUNTER     |  WARNING CLUSTER  |   CLOCK          |
|                   |                   |                  |
|   .-~~~-.         |  [*] Hook OK      |   00:23:47       |
|  /   2   \        |  [*] DES OK       |   elapsed        |
| | agents  |       |  [ ] No anomalies |                  |
|  \ _____ /        |                   |                  |
+-------------------+-------------------+-----------------+
```

**Six instruments, each communicating urgency through form:**

| Instrument | Metric | Reading | Urgency Signal |
|---|---|---|---|
| Tachometer | Token burn rate | 327 tok/s | Redline sweep at sustained high rate |
| Fuel Gauge | Context window % | 43% | Arc fills, amber at 70%, red at 90% |
| Odometer | Session cost | $1.47 | Rolling digits tumble as cost increments |
| RPM Counter | Active agents | 2 | Spikes when agents spawn |
| Warning Cluster | Health status | All green | Indicator lights: green/amber/red |
| Clock | Session duration | 00:23:47 | Elapsed time display |

**Minimized state (floating pill):**
```
+-------------+
| $1.47       |
+-------------+
```

**Shared Artifacts:**
- `${token_burn_rate}` -- derived: tokens per second over rolling window
- `${context_window_pct}` -- derived: current tokens / model context limit
- `${session_cost}` -- same value as broadcast bar (single source)
- `${active_agent_count}` -- count of agents without agent_complete event
- `${hook_health}` -- derived from hook event latency/error rates
- `${session_duration}` -- elapsed time since session_start event

**Emotional Transition:** Oriented -> Informed
- User absorbs 6 metrics simultaneously through gauge forms
- Urgency zones (amber, red) draw attention only when warranted
- No reading of numbers required for quick health check

---

## Step 3: Oscilloscope -- Live Token Flow Waveform

The Oscilloscope shows the texture of agent activity over the last 60 seconds.

```
+====================================================================+
|  TOKEN BURN OSCILLOSCOPE                    [Live *]  327 tok/s    |
+--------------------------------------------------------------------+
|  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |
|  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |
|  . .  . .. .  .  . .  .  .  .  .  . .  .  . . ..  .  .  .  .  .  |
|  ...  ..... .  . .. .. . .  .  .  . .. .  .....~.. .  .  .  .  .  |
|  ~~~~~ ~~~~~ ~~ ~~~~ ~~~~ ~~~ ~~~~~ ~~~~~ ~~~~~ ~~~~~___ ____ ___ |
|  ______ ______ ___ _____ ____ _____ _____ _____ _____ ____________ |
|  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  |
+--------------------------------------------------------------------+
|  [-] tokens (cyan)   [-] cost (amber)                              |
+--------------------------------------------------------------------+
| PEAK        | AVG RATE     | TOTAL        | WINDOW        |
| 512 tok/s   | 327 tok/s    | 87,241 tok   | 60s           |
+--------------------------------------------------------------------+
```

**What the waveform patterns mean:**
- **Flat baseline** = idle, waiting for tool result
- **Sharp spike** = tool call fired or response chunk arrived
- **Sustained plateau** = long streaming response in progress
- **Rapid repeated spikes** = tool calls hammering (bash loops, file reads)
- **Flat line when activity expected** = something hung

**Two simultaneous traces:**
- Token rate trace (cyan/brand color)
- Cost rate trace (amber)
- Same time axis so relationship between volume and cost is visible

**Shared Artifacts:**
- `${token_rate_timeseries}` -- rolling 60s window of tokens-per-second samples
- `${cost_rate_timeseries}` -- rolling 60s window of cost-per-second samples
- `${peak_rate}` -- maximum token rate in current window
- `${avg_rate}` -- mean token rate in current window

**Emotional Transition:** Informed -> Aware
- User develops intuition for what "normal" activity looks like
- Anomalies (flat lines, sustained spikes) are perceptually obvious
- Two traces reveal cost/volume relationship (model switching visible)

---

## Step 4: Default Dashboard -- Full Metrics View

The default dashboard is the primary zone view. It shows all key metrics in a hand-tuned layout.

```
+====================================================================+
|  // USAGE DASHBOARD                                                |
+--------------------------------------------------------------------+
|  +------------------+  +------------------+  +------------------+  |
|  | RUNNING COST     |  | TOKEN COUNT      |  | ACTIVE AGENTS    |  |
|  |      $1.47       |  |    87,241        |  |       2          |  |
|  | +12c last 60s    |  | 47k in / 40k out |  | coordinator +1   |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
|  +------------------+  +------------------+  +------------------+  |
|  | TOOL CALLS       |  | CONTEXT WINDOW   |  | HOOK HEALTH      |  |
|  |      143         |  |    43% (87k/200k)|  |  [*] ALL OK      |  |
|  | 12 in last 60s   |  | agent: opus-4    |  |  latency: 3ms    |  |
|  +------------------+  +------------------+  +------------------+  |
|                                                                    |
|  +--------------------------------------------------------------+  |
|  | 7-DAY BURN CHART                                             |  |
|  |  $                                                           |  |
|  |  8 |          *                                              |  |
|  |  6 |    *           *                                        |  |
|  |  4 | *     *     *     *                                     |  |
|  |  2 |                       *  *                              |  |
|  |  0 +--+--+--+--+--+--+--+                                   |  |
|  |     M  T  W  T  F  S  S                                     |  |
|  +--------------------------------------------------------------+  |
+====================================================================+
```

**Emotional Transition:** Aware -> Empowered
- User has complete picture: what it costs, how fast it burns, how full the context is
- Historical trend (7-day chart) adds temporal context
- All derived from the same hook event data, consistent with other views

---

## Step 5: Floating Panel Mode -- Ambient Monitoring

User drags Gauge Cluster to a screen corner. Continues working in terminal/editor.

```
                                        +-------------------+
                                        |  GAUGE CLUSTER    |
  +----------------------------------+  +---+---+---+---+---+
  | ~/project $ claude                |  |TCH|FUL|ODO|RPM|WRN|
  | > Refactoring auth module...      |  |327| 43|1.4| 2 | * |
  | ...                               |  +---+---+---+---+---+
  |                                   |
  +----------------------------------+

  Or minimized to pill:

  +----------------------------------+  +----------+
  | ~/project $ claude                |  | $1.47    |
  | > Refactoring auth module...      |  +----------+
  +----------------------------------+
```

**Emotional Transition:** Empowered -> Confident
- User can focus on primary work
- Peripheral vision catches urgency changes (amber/red zones, digit roll speed)
- Quick glance confirms "everything is fine" or "something needs attention"
- No context switch required

---

## Error Paths

### E1: No Active Session
User opens Norbert with no session running. Broadcast bar shows "No active session." Gauge Cluster shows zeroed instruments with dim state. Dashboard shows historical data and onboarding prompt: "Start a Claude Code session to see live metrics."

### E2: Hook Events Not Arriving
Hooks are configured but events stop arriving. Warning cluster in Gauge Cluster turns amber after 30s silence, red after 60s. Oscilloscope waveform flatlines. Status bar shows "Hook events: stale (last received 45s ago)."

### E3: Token Data Missing from Events
Some hook events may not include token counts (e.g., tool_call_start). Plugin gracefully handles missing fields -- only updates metrics when complete data is available. Dashboard shows "Tokens: --" for metrics that cannot be calculated.

### E4: Session Context Mismatch
User selects a session in the broadcast bar that has already ended. Views switch to playback mode. Oscilloscope shows historical waveform (not live). Gauge Cluster shows final session values.

---

## Integration Points

| From | To | Data | Validation |
|---|---|---|---|
| SQLite session_events | norbert-usage plugin | Raw hook events | Events have session_id, timestamp, event_type |
| Hook event processor | session_events table | session_start, session_end, tool_call_start, tool_call_end, agent_complete, prompt_submit | Six canonical event types stored |
| norbert-usage metrics | Broadcast bar cost ticker | ${session_cost} | Updates within 1s of event arrival |
| norbert-usage metrics | Gauge Cluster instruments | ${token_burn_rate}, ${context_window_pct}, ${session_cost}, ${active_agent_count}, ${hook_health}, ${session_duration} | All 6 instruments show consistent data |
| norbert-usage metrics | Oscilloscope traces | ${token_rate_timeseries}, ${cost_rate_timeseries} | 60s rolling window, ~10Hz sample rate |
| Context Broadcast Bar | All subscribed views | ${session_id} context | All views show data for same session |
| NorbertPlugin API | Plugin registration | registerView (3 views), registerTab (1 tab), registerStatusItem (cost ticker) | All registrations succeed in onLoad |
