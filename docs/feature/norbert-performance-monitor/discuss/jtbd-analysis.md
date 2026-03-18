# JTBD Analysis: Performance Monitor

## Job Classification

**Job Type**: Build Something New (Greenfield) on Brownfield Foundation
**Workflow**: `[research] -> discuss -> design -> distill -> baseline -> roadmap -> split -> execute -> review`

The Performance Monitor expands an existing single-view oscilloscope into a multi-metric, multi-scope monitoring dashboard. The existing data pipeline (US-002: token/cost extraction) and oscilloscope rendering (US-005) provide the foundation. New jobs center on aggregate visibility, cross-session awareness, and metric scope navigation.

---

## Persona

**Ravi Patel** -- Claude Code power user running long autonomous multi-agent sessions. Monitors 2-5 concurrent sessions daily. Uses Opus 4 for complex tasks, Sonnet 4 for routine work. Average daily spend: $15-25. Runs Norbert on a second monitor as an ambient observability surface.

**Elena Vasquez** -- Claude Code team lead overseeing 3 developers each running independent sessions. Needs aggregate cost awareness across all team activity. Opens Norbert periodically to check total burn rate and identify which sessions are consuming the most resources.

---

## Job Stories

### JS-PM-1: Aggregate Resource Awareness

**When** I have multiple Claude Code sessions running simultaneously across different projects,
**I want to** see total resource consumption at a glance without switching between sessions,
**so I can** understand my overall burn rate and make informed decisions about which sessions to prioritize or pause.

#### Three Dimensions

- **Functional**: View aggregate tokens/s, cost/min, and active agent count across all sessions simultaneously.
- **Emotional**: Feel in control of total expenditure rather than anxious about invisible costs accumulating in background sessions.
- **Social**: Demonstrate to team leads and budget owners that AI resource usage is monitored and managed responsibly.

#### Forces Analysis

- **Push**: Current oscilloscope shows only one session at a time. With 3 sessions running, Ravi must click between them to estimate total burn. He missed a runaway session last week that burned $8 before he noticed.
- **Pull**: A single dashboard showing total tokens/s, total cost/min, and per-session breakdown would eliminate blind spots. Like Windows Task Manager showing total CPU while listing per-process usage.
- **Anxiety**: Will the aggregate view be too noisy with many sessions? Will it obscure the per-session detail that the oscilloscope currently provides?
- **Habit**: Ravi currently glances at the oscilloscope waveform shape to assess session health. A numbers-heavy dashboard might lose that perceptual quality.
- **Assessment**: Switch likelihood HIGH. Push is strong (real cost incident). Key blocker: anxiety about losing waveform-based pattern recognition. Design implication: aggregate view must coexist with per-session waveform detail, not replace it.

### JS-PM-2: Metric Scope Navigation

**When** I notice an anomaly in aggregate metrics (e.g., total tokens/s spikes),
**I want to** drill from total view down to per-session and per-agent breakdown,
**so I can** pinpoint which specific session or agent is causing the spike and decide whether to intervene.

#### Three Dimensions

- **Functional**: Navigate from aggregate metrics to session-level to agent-level detail without losing context.
- **Emotional**: Feel confident that I can find the source of any anomaly quickly rather than playing a guessing game across session tabs.
- **Social**: Be seen as someone who can diagnose and explain resource consumption to stakeholders with specific evidence.

#### Forces Analysis

- **Push**: When total cost spikes, Ravi has no way to identify which session caused it without clicking through each session in the broadcast bar. This takes 30-60 seconds per session with 5 running.
- **Pull**: Click on "tokens/s total" to see per-session breakdown, then click a session to see per-agent breakdown. Three clicks from symptom to root cause.
- **Anxiety**: Will drilling down lose the aggregate context? Will navigating back reset the view?
- **Habit**: Currently uses broadcast bar session picker to manually switch context. Familiar but slow.
- **Assessment**: Switch likelihood HIGH. Push is strong (diagnosis latency). Key blocker: anxiety about navigation complexity. Design implication: drill-down must preserve aggregate context (perhaps split view or breadcrumb).

### JS-PM-3: Extended Time Window Analysis

**When** I am reviewing a session that ran for 45 minutes and want to understand its resource consumption pattern over the full duration,
**I want to** adjust the monitoring time window beyond the current 60-second view,
**so I can** see trends, identify cost spikes, and correlate resource usage with specific work phases.

#### Three Dimensions

- **Functional**: Switch between time windows (1m, 5m, 15m, 1h, full session) on any metric graph.
- **Emotional**: Feel oriented in time rather than trapped in a narrow 60-second viewport that hides the larger pattern.
- **Social**: Share session consumption reports showing full-session resource profiles with team.

#### Forces Analysis

- **Push**: The 60-second oscilloscope window is excellent for real-time anomaly detection but useless for understanding a 45-minute session's overall pattern. Ravi cannot tell if current burn rate is normal for this phase of work or anomalous.
- **Pull**: A time window selector (1m, 5m, 15m, 1h, session) would let Ravi zoom out to see the full story, then zoom in to investigate specific moments.
- **Anxiety**: Will wider time windows lose the 10Hz real-time feel? Will the graph become an unreadable mess at 1-hour scale?
- **Habit**: The 60-second window is familiar and useful for live monitoring. It should remain the default.
- **Assessment**: Switch likelihood HIGH. Push is strong (temporal blindness). Key blocker: anxiety about losing real-time granularity at wide time scales. Design implication: time window selection should offer appropriate resolution per window (10Hz for 1m, 1Hz for 5m, 0.1Hz for 1h).

### JS-PM-4: Context Window Pressure Monitoring

**When** I am running a long autonomous session where the agent is building up context,
**I want to** see context window utilization as a percentage that updates in real time,
**so I can** anticipate compaction events and understand how much headroom remains before the agent is forced to compress.

#### Three Dimensions

- **Functional**: Display context window % per session, updated in real time, with historical trend visible.
- **Emotional**: Feel proactively aware of context pressure rather than surprised by sudden compaction that disrupts agent flow.
- **Social**: Demonstrate awareness of context economics when discussing session efficiency with team.

#### Forces Analysis

- **Push**: Compaction events currently happen without warning. The agent's behavior changes after compaction (it may forget earlier context), and Ravi has no way to predict when compaction will occur.
- **Pull**: A context pressure gauge showing 0-100% with amber/red zones would give advance warning. Like a fuel gauge -- you do not wait until empty to plan a refuel.
- **Anxiety**: Is context utilization data even available in the event stream? How accurate can it be if Claude Code does not report exact context usage?
- **Habit**: Currently ignores context pressure entirely because there is no visibility into it.
- **Assessment**: Switch likelihood MEDIUM. Push is moderate (compaction is disruptive but intermittent). Key blocker: data availability (existing gauge cluster already tracks this but accuracy depends on payload data). Design implication: must handle cases where context data is unavailable gracefully.

### JS-PM-5: Cost Rate Trending

**When** I am managing a budget for AI-assisted development and need to understand my spending velocity,
**I want to** see cost/min as a rolling metric with historical trend across sessions,
**so I can** predict daily/weekly spend and make informed decisions about model selection and session intensity.

#### Three Dimensions

- **Functional**: Display rolling cost/min with trend line, daily/weekly projections, and per-model cost breakdown.
- **Emotional**: Feel financially informed rather than anxious about surprise bills.
- **Social**: Report AI spending to management with data-backed projections rather than rough estimates.

#### Forces Analysis

- **Push**: Ravi currently has session-level cost (odometer in gauge cluster) but no velocity metric. He cannot answer "At this rate, how much will today cost?" without mental arithmetic.
- **Pull**: A cost/min metric with rolling trend and projected daily cost would turn cost from a lagging number into a leading indicator.
- **Anxiety**: Will cost projections be accurate enough to be useful, or will they be misleading during bursty workloads?
- **Habit**: Currently checks the session cost odometer periodically and does mental math.
- **Assessment**: Switch likelihood HIGH. Push is strong (budget accountability). Key blocker: projection accuracy during bursty patterns. Design implication: projections should show confidence range, not point estimate.

### JS-PM-6: Operational Health Metrics

**When** I am debugging why a session feels sluggish or an agent seems stuck,
**I want to** see operational metrics like response latency, tool call rate, error rate, and cache hit rate,
**so I can** distinguish between "agent is thinking" and "something is broken" without switching to terminal logs.

#### Three Dimensions

- **Functional**: Display time-to-first-token latency, tool calls/s, failed tool call rate, and cache hit rate.
- **Emotional**: Feel diagnostic confidence -- able to quickly distinguish normal pauses from actual problems.
- **Social**: Provide specific evidence when reporting issues ("latency spiked to 8s at 14:32") rather than vague "it felt slow."

#### Forces Analysis

- **Push**: When the oscilloscope shows a flat line, Ravi cannot tell if the agent is processing (normal), waiting for a tool result (normal), or stuck/erroring (abnormal). He must switch to the terminal to check.
- **Pull**: Operational metrics alongside the waveform would make the flat-line diagnostic instant: flat line + 0 tool calls/s + rising latency = likely stuck.
- **Anxiety**: Too many metrics could create information overload. Which ones are actually useful vs noise?
- **Habit**: Currently uses terminal logs for diagnosis. Familiar but high-effort context switch.
- **Assessment**: Switch likelihood MEDIUM. Push is moderate (diagnostic ambiguity is annoying but not costly). Key blocker: metric overload anxiety. Design implication: start with a focused set (latency, tool calls/s, error rate) and add others later. Progressive disclosure.

---

## Opportunity Scoring

Scored using team estimates (source: user-provided feature context and existing usage patterns).

| # | Outcome Statement | Imp. (%) | Sat. (%) | Score | Priority |
|---|-------------------|----------|----------|-------|----------|
| 1 | Minimize the time to identify which session is consuming the most resources | 95 | 20 | 16.5 | Extremely Underserved |
| 2 | Minimize the likelihood of missing a runaway session cost | 90 | 25 | 15.5 | Extremely Underserved |
| 3 | Minimize the time to diagnose why a session feels sluggish | 85 | 30 | 13.5 | Underserved |
| 4 | Minimize the likelihood of being surprised by context compaction | 80 | 15 | 14.5 | Underserved |
| 5 | Minimize the time to understand resource consumption pattern over a full session | 85 | 20 | 14.5 | Underserved |
| 6 | Minimize the time to predict daily AI spending from current velocity | 80 | 10 | 14.0 | Underserved |
| 7 | Minimize the number of clicks to drill from symptom to root cause agent | 90 | 15 | 15.5 | Extremely Underserved |
| 8 | Minimize the likelihood of information overload from too many metrics | 70 | 50 | 9.0 | Overserved |

### Scoring Method

- Importance: team estimate, % rating 4+ on 5-point scale
- Satisfaction: team estimate of current state with existing oscilloscope + gauge cluster
- Score: Importance + max(0, Importance - Satisfaction)
- Data quality: team estimates, confidence MEDIUM

### Top Opportunities (Score >= 12)

1. Aggregate resource visibility (16.5) -- JS-PM-1
2. Drill-down navigation (15.5) -- JS-PM-2
3. Runaway session detection (15.5) -- JS-PM-1
4. Context compaction prediction (14.5) -- JS-PM-4
5. Full-session time window (14.5) -- JS-PM-3
6. Cost velocity trending (14.0) -- JS-PM-5
7. Diagnostic metrics (13.5) -- JS-PM-6

### Overserved Areas (Score < 10)

1. Information overload prevention (9.0) -- Design carefully but do not over-invest in metric hiding/filtering

---

## MVP vs Later Prioritization

### MVP (Must Have) -- Performance Monitor v1

Metrics:
- tokens/s total (across all sessions) -- JS-PM-1
- tokens/s per session -- JS-PM-2
- active agents total -- JS-PM-1
- context window % per session -- JS-PM-4
- cost/min rolling -- JS-PM-5

Capabilities:
- Multi-metric grid layout (small charts, not single oscilloscope) -- JS-PM-1
- Per-session drill-down from aggregate view -- JS-PM-2
- Time window selector (1m, 5m, 15m) -- JS-PM-3
- Subsumes existing oscilloscope (token rate waveform becomes one chart in the grid)

### Later (Should Have) -- Performance Monitor v2

Metrics:
- tokens/s per agent -- requires agent-level event attribution
- agents per session -- already in gauge cluster, promote to PM
- response latency (time to first token) -- JS-PM-6
- tool calls/s -- JS-PM-6
- error rate (failed tool calls) -- JS-PM-6
- compression events -- JS-PM-4 extension

### Future (Could Have) -- Performance Monitor v3

Metrics:
- model distribution (% Opus vs Sonnet vs Haiku over time)
- queue depth (agents waiting vs active)
- cache hit rate (prompt caching effectiveness)
- daily/weekly cost projections with confidence range

---

## Relationship to Existing Views

### Oscilloscope (US-005) -- Subsumed

The Performance Monitor subsumes the oscilloscope. The token rate waveform becomes one chart in the Performance Monitor grid. The oscilloscope view registration remains for backward compatibility but routes to the Performance Monitor with "Token Rate" chart focused.

### Gauge Cluster (US-003) -- Complementary

The Gauge Cluster remains as the ambient HUD (floating panel, cost pill). The Performance Monitor is the deep-dive diagnostic view. They share the same data pipeline but serve different attention modes: Gauge Cluster for peripheral awareness, Performance Monitor for focused investigation.

### Usage Dashboard (US-006) -- Complementary

The Usage Dashboard shows session-level summary metrics and 7-day history. The Performance Monitor shows real-time streaming metrics. Dashboard is retrospective; Performance Monitor is live.

---

## Data Quality Notes

- Source: team estimates based on user-provided feature context
- Sample size: 1 (product owner providing feature specification)
- Confidence: MEDIUM -- well-articulated needs with existing code context
- Re-score recommended after first user testing with Performance Monitor v1
