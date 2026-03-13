# JTBD Analysis: norbert-usage Plugin

## Job Classification

**Job Type:** Build Something New (Greenfield)
**Workflow:** research -> discuss -> design -> distill -> baseline -> roadmap -> split -> execute -> review
**Current Phase:** DISCUSS

---

## Job Stories

### JS-1: Cost Awareness During Active Sessions

**When** I am running a long autonomous Claude Code session that spawns multiple agents and makes dozens of tool calls,
**I want to** see exactly how much money the session is costing in real time,
**so I can** decide whether to let it continue, intervene, or set a mental budget for the task.

#### Functional Job
Track cumulative token consumption and translate it to dollar cost during a live session.

#### Emotional Job
Feel in control of spending rather than anxious about a surprise bill at the end.

#### Social Job
Be seen as a responsible engineer who manages AI costs rather than someone who lets sessions run unchecked.

#### Forces Analysis
- **Push**: Claude Code shows no cost during a session. End-of-session summaries arrive too late to act on. Monthly bills contain surprises.
- **Pull**: A live cost ticker makes each tool call and response tangible. Knowing the number right now replaces guessing.
- **Anxiety**: Will the tracking be accurate? Will it slow down my session? What if the numbers are wrong and I make bad decisions?
- **Habit**: Currently checking the Anthropic dashboard after the fact, or mentally estimating based on session length.

#### Assessment
- Switch likelihood: **High** -- push is very strong (no current real-time visibility)
- Key blocker: Trust in accuracy of displayed numbers
- Key enabler: Visceral, always-visible cost display
- Design implication: Cost must update in real time with sub-second latency. Numbers must be trustworthy (derived from actual hook event data, not estimates).

---

### JS-2: Understanding Token Consumption Patterns

**When** I have finished a Claude Code session or am reviewing my usage over the past week,
**I want to** see how tokens were consumed across sessions, agents, and models,
**so I can** optimize my workflow (e.g., use cheaper models for routine tasks, avoid patterns that burn context quickly).

#### Functional Job
Aggregate and break down token usage by session, agent, model, and time period.

#### Emotional Job
Feel informed and empowered to make better decisions rather than operating blind on cost.

#### Social Job
Demonstrate data-driven AI usage to team leads or budget owners.

#### Forces Analysis
- **Push**: No visibility into which agents or models consume the most. Monthly invoices are a single number with no breakdown.
- **Pull**: Per-agent and per-model breakdowns reveal optimization opportunities. Historical trends show whether usage is growing.
- **Anxiety**: Will the dashboard be too complex? Will I need to learn a new tool?
- **Habit**: Ignoring cost because there is no easy way to analyze it.

#### Assessment
- Switch likelihood: **High**
- Key blocker: Complexity of the dashboard overwhelming users
- Key enabler: Clear, at-a-glance metrics with drill-down available
- Design implication: Default dashboard must surface the 5-6 most important metrics immediately without configuration.

---

### JS-3: Detecting Anomalous Session Behavior in Real Time

**When** I have a Claude Code session running autonomously and I glance at Norbert periodically,
**I want to** instantly recognize when something abnormal is happening (e.g., unexpectedly high burn rate, hung agent, rapid tool call looping),
**so I can** intervene before the session wastes tokens or produces bad output.

#### Functional Job
Visualize token flow rate over time in a way that makes anomalies perceptually obvious.

#### Emotional Job
Feel confident that I can leave a session running and trust that a quick glance at Norbert will tell me if something is wrong.

#### Social Job
Be the developer who catches runaway sessions early rather than discovering wasted budget after the fact.

#### Forces Analysis
- **Push**: Cannot tell from Claude Code's terminal output whether activity patterns are normal or anomalous. Flat output hides the texture of agent activity.
- **Pull**: A waveform visualization encodes activity patterns in a way that numbers and tables cannot -- flat lines, spikes, plateaus, and rapid bursts are instantly recognizable.
- **Anxiety**: Is the visualization just eye candy? Will I actually understand what the waveform means?
- **Habit**: Currently watching terminal output scroll and guessing whether the agent is productive or stuck.

#### Assessment
- Switch likelihood: **High**
- Key blocker: Learning to read the waveform (mitigated by its intuitive nature)
- Key enabler: Perceptual anomaly detection -- patterns visible without conscious analysis
- Design implication: Oscilloscope must make flat baselines, spikes, plateaus, and repeated bursts visually distinct. Two traces (tokens + cost) on same time axis.

---

### JS-4: Ambient Monitoring Without Context Switching

**When** I am working in my terminal or editor and have Norbert running as a desktop companion,
**I want to** get at-a-glance awareness of session health without switching windows or reading detailed dashboards,
**so I can** stay focused on my primary work while maintaining peripheral awareness of session cost and health.

#### Functional Job
Display key session metrics (cost, token burn rate, context utilization, active agents, health status) in a compact, always-visible instrument panel.

#### Emotional Job
Feel like I have a trusted co-pilot monitoring the session while I focus on the work itself.

#### Social Job
Project professionalism by having a monitoring setup that shows I take observability seriously.

#### Forces Analysis
- **Push**: Current monitoring requires actively switching to Anthropic dashboard or reading terminal output. Full dashboards require too much attention.
- **Pull**: A floating gauge cluster is always visible in peripheral vision. Each gauge communicates urgency through form (radial sweep, arc fill, digit roll), not just numbers.
- **Anxiety**: Will floating panels be distracting? Will they take up too much screen space?
- **Habit**: Relying on post-session summaries because real-time monitoring has historically been too much effort.

#### Assessment
- Switch likelihood: **High**
- Key blocker: Floating panel must be non-intrusive yet informative
- Key enabler: Analog gauge metaphor communicates urgency without demanding attention
- Design implication: Gauge Cluster must work as a floating HUD. Minimized state shows single metric (session cost). Full state shows 6 instruments. Must not block primary work.

---

## Opportunity Scoring

| # | Outcome Statement | Imp. (%) | Sat. (%) | Score | Priority |
|---|-------------------|----------|----------|-------|----------|
| 1 | Minimize the time to determine current session cost | 95 | 10 | 18.0 | Extremely Underserved |
| 2 | Minimize the likelihood of a session exceeding budget without awareness | 90 | 15 | 16.5 | Extremely Underserved |
| 3 | Minimize the time to identify anomalous token consumption patterns | 85 | 10 | 15.5 | Extremely Underserved |
| 4 | Minimize the time to understand per-agent cost attribution | 80 | 10 | 14.0 | Underserved |
| 5 | Minimize the likelihood of missing a hung or looping agent | 82 | 15 | 14.9 | Underserved |
| 6 | Minimize the context switches needed to monitor session health | 88 | 20 | 15.6 | Extremely Underserved |
| 7 | Minimize the time to determine context window utilization | 75 | 12 | 13.8 | Underserved |
| 8 | Maximize the likelihood of recognizing activity texture (idle, streaming, burst) | 70 | 5 | 13.5 | Underserved |

### Scoring Method
- Importance: estimated % of Claude Code power users rating 4+ on 5-point scale
- Satisfaction: estimated % satisfied with current solutions (near zero -- no real-time tooling exists)
- Score: Importance + max(0, Importance - Satisfaction)
- Source: product spec analysis + domain knowledge (team estimate, not user survey)

### Top Opportunities (Score >= 15)
1. Current session cost visibility -- Score: 18.0 -- Maps to JS-1, US-001, US-004
2. Budget awareness -- Score: 16.5 -- Maps to JS-1, US-004
3. Context switch minimization -- Score: 15.6 -- Maps to JS-4, US-003
4. Anomaly detection -- Score: 15.5 -- Maps to JS-3, US-005

### Data Quality Notes
- Source: team estimates based on product spec analysis and Claude Code user patterns
- Confidence: Medium (no direct user survey; strong signal from product spec research)
