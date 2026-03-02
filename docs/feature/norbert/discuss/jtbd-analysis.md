# JTBD Analysis: Norbert -- The Agentic Workflow Observatory

**Feature ID**: norbert
**Date**: 2026-03-02
**Phase**: Product Owner Phase 1 -- Job Discovery
**Status**: COMPLETE -- feeds into Journey Design and Requirements

---

## Job Type Classification

**Classification**: Job 1 -- Build Something New (Greenfield)
**Rationale**: No `src/` code exists. Norbert is a new product with validated discovery artifacts (7/7 pain signals, 13 opportunities scored, 4 solution concepts tested). The DISCOVER wave is complete; we are entering the DISCUSS wave.

**Workflow**:
```
[research: DONE] -> discuss (THIS PHASE) -> design -> distill -> baseline -> roadmap -> split -> execute -> review
```

---

## Personas

### Persona 1: Rafael Oliveira ("The Power User")

**Who**: Senior full-stack developer who runs multi-agent Claude Code workflows daily, managing 3-7 subagents and 4+ MCP servers across complex refactoring and feature development tasks.

**Demographics**:
- Technical proficiency: Expert (8+ months daily Claude Code usage)
- Frequency: Daily, 6-10 Claude Code sessions/day
- Environment: macOS terminal, iTerm2, 2-3 projects active simultaneously
- Primary motivation: Speed and cost efficiency -- wants to ship faster without burning budget

**Pain Points**:
- P1: Token/cost opacity -- cannot attribute $47 refactoring cost to specific subtask
- P2: Agent execution blindness -- debugging multi-agent failures is guesswork
- P6: MCP silent failures -- spent 30 minutes debugging why GitHub MCP server silently disconnected

**Success Metrics**:
- Diagnose cost spike root cause in < 2 minutes (currently 60+ minutes)
- Identify failed MCP server connection in < 30 seconds (currently 30+ minutes)
- Reduce per-session token waste by > 20% through optimization insights

### Persona 2: Priya Chakraborty ("The Framework Developer")

**Who**: Lead developer building a multi-agent orchestration framework on Claude Code, managing 15+ CLAUDE.md files, 8+ skills, 3 custom agents, and 7 MCP servers.

**Demographics**:
- Technical proficiency: Expert (framework author, contributes to Claude Code ecosystem)
- Frequency: Daily, 12+ hours active usage
- Environment: Linux workstation, tmux, monorepo with 50+ CLAUDE.md files across directories
- Primary motivation: Framework reliability -- needs to verify her abstractions work correctly

**Pain Points**:
- P3: Context file resolution mystery -- "I configure 15 CLAUDE.md files and pray the right one wins"
- P2: Agent execution blindness -- cannot trace inter-agent message passing
- P6: MCP token overhead -- 7 MCP servers consuming 67K+ tokens before first prompt

**Success Metrics**:
- Identify which CLAUDE.md is active for any agent in < 1 minute (currently 30+ minutes)
- Trace agent delegation chain end-to-end in < 2 minutes (currently impossible)
- Attribute token overhead per MCP server in < 30 seconds (currently zero visibility)

### Persona 3: Marcus Chen ("The Team Lead")

**Who**: Engineering manager overseeing 4 developers using Claude Code, responsible for AI tooling budget and developer productivity metrics.

**Demographics**:
- Technical proficiency: Intermediate (uses Claude Code weekly, not daily)
- Frequency: Weekly dashboard review, monthly budget reconciliation
- Environment: macOS, Chrome browser, Slack for team communication
- Primary motivation: Budget control and team optimization -- needs data for decisions

**Pain Points**:
- P1: Token/cost opacity -- approved $2,000/month, spent $3,400 with no attribution
- P5: Usage pattern blindness -- cannot establish baselines or identify optimization opportunities
- P6: MCP failures -- developer Alice's sessions failing silently due to MCP server instability

**Success Metrics**:
- Attribute costs to specific sessions/tasks in < 5 minutes (currently impossible)
- Identify top 3 cost-driving sessions per week in < 2 minutes
- Reduce team Claude Code spend by > 15% through data-driven optimization

---

## Job Map: Observing and Optimizing Agentic Claude Code Workflows

| Step | Job Step Description | Desired Outcome Statement |
|------|---------------------|--------------------------|
| 1. Define | Determine what to observe and why | Minimize the time to identify which sessions, agents, or MCP servers need attention |
| 2. Locate | Find the relevant session, trace, or metric | Minimize the likelihood of looking at the wrong data when diagnosing an issue |
| 3. Prepare | Set up Norbert to capture data from Claude Code | Minimize the number of steps from install to first captured event |
| 4. Confirm | Verify that Norbert is receiving data correctly | Minimize the likelihood of proceeding with incomplete or stale data capture |
| 5. Execute | Observe the workflow -- review traces, costs, MCP health | Minimize the time to extract actionable insight from observed data |
| 6. Monitor | Track ongoing health of agents and MCP servers | Minimize the likelihood of an undetected agent failure or MCP disconnection |
| 7. Modify | Act on insights -- adjust config, optimize prompts, fix MCP | Minimize the effort to translate an observation into a corrective action |
| 8. Conclude | Summarize session or period, establish baselines | Minimize the likelihood of losing historical insight when moving to next session |

---

## Job Stories

### Job Story 1: Cost Spike Diagnosis

**When** I finish a Claude Code session that ran 8 subagents across a complex refactoring task and my Anthropic billing shows an unexpectedly high charge,
**I want to** see exactly which agent, tool call, or MCP server consumed the most tokens,
**so I can** identify the specific waste point and restructure my workflow to avoid it next time.

#### Functional Job
Attribute token consumption to specific agents, tool calls, and MCP servers within a completed session.

#### Emotional Job
Feel in control of my AI spend -- shift from "billing anxiety" to "informed optimization."

#### Social Job
Be seen by my team as someone who uses AI tools responsibly and optimizes costs proactively.

#### Forces Analysis
- **Push**: Rafael spent $47 on a single refactoring task with no idea which subtask consumed the tokens. His bash-script grep workaround takes 60+ minutes and gives incomplete answers.
- **Pull**: A token cost waterfall showing per-agent attribution would let him pinpoint the waste in under 2 minutes. He could restructure his file-migrator prompt to avoid 14 redundant file reads.
- **Anxiety**: "Will the token counts be accurate enough to trust? What if Norbert's estimates don't match my actual bill?"
- **Habit**: Rafael currently checks the Anthropic billing dashboard (aggregated, no per-task detail) and greps Claude Code logs manually.

**Assessment**: Switch likelihood HIGH. Push is intense (daily frustration, $$ impact). Pull is concrete and immediately actionable. Anxiety addressable by showing Norbert estimates alongside actual billing correlation. Habit is weak (no one likes grepping logs).

---

### Job Story 2: Agent Trace Debugging

**When** my multi-agent workflow produces incorrect output and I need to find where the chain broke,
**I want to** see the complete execution graph showing which agents ran, in what order, what inputs they received, and where the failure propagated,
**so I can** trace the root cause to a specific agent and fix it without re-running the entire workflow.

#### Functional Job
Trace agent execution chains end-to-end with inter-agent data flow visibility.

#### Emotional Job
Feel confident when debugging -- shift from "flying blind" to "systematic diagnosis."

#### Social Job
Demonstrate technical mastery to colleagues by efficiently diagnosing complex multi-agent failures.

#### Forces Analysis
- **Push**: Priya built custom logging middleware (40+ hours invested) that still cannot show the full agent delegation graph. When Agent 5 receives wrong context from Agent 3, she has to manually trace through JSON conversation files.
- **Pull**: A visual execution DAG showing the complete agent topology with expandable detail per node. "This replaces my entire custom logging system."
- **Anxiety**: "Will Norbert show enough detail about inter-agent message passing? What if it captures the trace but not the actual prompts?"
- **Habit**: Priya's custom logging middleware is deeply embedded in her framework. Switching requires trust that Norbert captures equivalent or better data.

**Assessment**: Switch likelihood HIGH. Push is extreme (40+ hours of workaround investment). Pull is strong ("replaces my entire custom logging system"). Anxiety manageable by ensuring trace detail includes inputs/outputs. Habit is high but push overwhelms it.

---

### Job Story 3: MCP Server Health Monitoring

**When** I am working in a Claude Code session with 5+ MCP servers connected and Claude suddenly cannot access my GitHub data,
**I want to** immediately see which MCP server failed, when it disconnected, and what error caused the failure,
**so I can** fix the connection and resume my work without spending 30 minutes guessing what went wrong.

#### Functional Job
Monitor MCP server connectivity in real-time with failure detection and attribution.

#### Emotional Job
Feel safe and supported -- shift from "silent failure anxiety" to "observable reliability."

#### Social Job
Maintain professional credibility by not wasting meeting time on preventable MCP failures.

#### Forces Analysis
- **Push**: Rafael's GitHub MCP server silently failed mid-session. He spent 30 minutes wondering why Claude could not find his repos before checking `/mcp`. No alert, no log, nothing.
- **Pull**: A health dashboard showing all MCP servers with real-time status, reconnection events, and immediate failure alerts. Diagnosis drops from 30+ minutes to < 1 minute.
- **Anxiety**: "Will Norbert itself add token overhead? Does another MCP server (Norbert-as-MCP-server) make the problem worse?"
- **Habit**: Rafael manually runs `/mcp` 5-10 times per day to check connection status.

**Assessment**: Switch likelihood VERY HIGH. Push is acute (silent failures cause immediate productivity loss). Pull is compelling (30x improvement in diagnosis time). Anxiety is low (Norbert's hook-based capture has zero token overhead; MCP server interface is Phase 2). Habit is weak (nobody enjoys running `/mcp` repeatedly).

---

### Job Story 4: MCP Token Overhead Attribution

**When** I notice my context window filling up faster than expected with 7 MCP servers connected,
**I want to** see exactly how many tokens each MCP server's tool descriptions consume and which server is the most expensive,
**so I can** trim my tool surface area or enable Tool Search to reclaim context space.

#### Functional Job
Attribute token overhead from MCP tool descriptions to individual MCP servers.

#### Emotional Job
Feel informed and empowered -- shift from "mysterious context pressure" to "data-driven configuration."

#### Social Job
Share optimization knowledge with community ("I reduced my MCP overhead by 60% using Norbert's attribution").

#### Forces Analysis
- **Push**: Priya discovered her mcp-omnisearch server consumed 14,214 tokens (20 tools) just for tool descriptions. Four servers total consumed 67,000+ tokens -- a third of her context window gone before writing a single prompt. She found this through trial-and-error manual server enable/disable.
- **Pull**: A per-server token breakdown showing tool description overhead, ranked by cost. "I'd trim my tool surface area on mcp-omnisearch immediately."
- **Anxiety**: "Does Tool Search change these numbers? Will Norbert show both raw and Tool Search-optimized overhead?"
- **Habit**: Priya manually enables/disables MCP servers one at a time to measure impact. This takes 10-15 minutes per server.

**Assessment**: Switch likelihood HIGH. Push is data-driven (67K tokens wasted). Pull is specific and actionable. Anxiety addressable (show both raw and Tool Search modes). Habit is painful (manual enable/disable is tedious).

---

### Job Story 5: Context Window Pressure Monitoring

**When** I am mid-session in a complex workflow and notice Claude's responses becoming shorter or less detailed,
**I want to** see my context window utilization in real-time -- how much is consumed by system prompts, CLAUDE.md, MCP tool descriptions, conversation history, and file contents,
**so I can** take proactive action (compact conversation, reduce MCP servers, restructure prompts) before context pressure degrades output quality.

#### Functional Job
Visualize real-time context window composition and pressure level.

#### Emotional Job
Feel aware and proactive -- shift from "sudden quality degradation confusion" to "anticipated and managed."

#### Social Job
Be the team member who understands context dynamics and can teach others to manage them.

#### Forces Analysis
- **Push**: Rafael notices Claude's responses becoming shorter mid-session but has zero visibility into why. He suspects context pressure but cannot confirm. By the time he notices, output quality has already degraded.
- **Pull**: A context window pressure gauge showing composition (system prompt, CLAUDE.md, MCP tools, conversation, files) with a warning threshold. "I'd compact the conversation before quality drops."
- **Anxiety**: "Will real-time monitoring slow down my workflow? Is the overhead worth it?"
- **Habit**: Currently Rafael just starts a new conversation when quality degrades, losing all session context.

**Assessment**: Switch likelihood HIGH. Push is subtle but impactful (quality degradation without understanding). Pull is unique (no competitor offers this). Anxiety low (hook-based, negligible overhead). Habit is destructive (starting new conversations is wasteful).

**Competitive note**: This is a KILLER DIFFERENTIATOR. Zero competitors offer context window pressure visualization for Claude Code. Feature gap analysis confirms this is a unique opportunity.

---

### Job Story 6: Session History and Baseline Establishment

**When** I want to understand how my Claude Code usage has changed over the past week or compare today's session costs to my historical average,
**I want to** search and filter my session history by date, cost, duration, agent count, and MCP server involvement,
**so I can** establish baselines for "normal" usage and quickly identify anomalies.

#### Functional Job
Search, filter, and analyze historical session data with trend visualization.

#### Emotional Job
Feel grounded in data -- shift from "every session feels unpredictable" to "I know my patterns."

#### Social Job
Present data-driven usage reports to team lead / stakeholders to justify AI tooling investment.

#### Forces Analysis
- **Push**: Marcus approved $2,000/month for Claude Code. Three weeks in, spent $3,400. He has zero data to explain why or identify optimization targets. His team manually logs "expensive sessions" in a shared doc.
- **Pull**: A searchable session archive with cost trends, sortable by cost/duration/complexity. "Finally, I can have a data-driven conversation with my team."
- **Anxiety**: "Will historical data accumulate and slow things down? How much disk space does this need?"
- **Habit**: Shared doc for manual session logging. Weekly 30-minute team "cost review" meeting based on anecdotes.

**Assessment**: Switch likelihood HIGH. Push is organizational (budget overruns). Pull is clear (data replaces anecdotes). Anxiety low (SQLite is efficient, 30-day free retention is generous). Habit is weak (nobody likes manual logging).

---

### Job Story 7: Walking Skeleton Validation

**When** I first install Norbert and want to verify it works before trusting it with my real workflows,
**I want to** see one captured hook event flow through the entire pipeline -- from Claude Code hook to SQLite storage to web dashboard display,
**so I can** confirm the architecture works end-to-end and begin using Norbert with confidence.

#### Functional Job
Validate the complete data pipeline with minimal setup and immediate visible result.

#### Emotional Job
Feel welcomed and reassured -- shift from "will this even work?" to "it works, I can trust it."

#### Social Job
Be able to recommend Norbert to colleagues after confirming first-hand that setup is painless.

#### Forces Analysis
- **Push**: Developer tools have notoriously high install-drop-off. If Norbert does not produce visible value within 5 minutes, Rafael will abandon it.
- **Pull**: `npm install -g norbert && norbert serve` produces a dashboard showing a captured event within 60 seconds. Time to first insight < 5 minutes.
- **Anxiety**: "Will this conflict with my existing hooks? Will it slow down Claude Code?"
- **Habit**: Rafael's existing workflow has zero observability. Adding a new tool requires zero disruption to his current process.

**Assessment**: Switch likelihood depends entirely on first-run experience. Push + Pull are neutral until activation happens. Anxiety is the dominant force -- must be addressed by frictionless install and zero-disruption hook setup.

---

## Opportunity Scoring (ODI)

Outcome statements derived from job map steps, rated against discovery evidence. Importance and Satisfaction percentages synthesized from 7 stakeholder signals + 3 research reports.

| # | Outcome Statement | Imp. (%) | Sat. (%) | Score | Priority |
|---|-------------------|----------|----------|-------|----------|
| OS-1 | Minimize the time to attribute token cost to a specific agent or MCP server | 95 | 10 | 18.0 | Extremely Underserved |
| OS-2 | Minimize the likelihood of an undetected MCP server failure during a session | 90 | 5 | 17.6 | Extremely Underserved |
| OS-3 | Minimize the time to trace the root cause of an agent chain failure | 92 | 8 | 17.5 | Extremely Underserved |
| OS-4 | Minimize the likelihood of context window pressure degrading output quality unnoticed | 85 | 0 | 17.0 | Extremely Underserved |
| OS-5 | Minimize the time to identify which MCP server consumes the most tokens | 88 | 5 | 17.0 | Extremely Underserved |
| OS-6 | Minimize the time to determine which CLAUDE.md file is active for a given agent | 80 | 5 | 15.5 | Extremely Underserved |
| OS-7 | Minimize the time from Norbert install to first captured event displayed | 82 | 10 | 14.9 | Underserved |
| OS-8 | Minimize the likelihood of losing historical session data needed for trend analysis | 75 | 15 | 13.5 | Underserved |
| OS-9 | Minimize the effort to establish a cost/usage baseline for my team | 72 | 10 | 13.4 | Underserved |
| OS-10 | Minimize the time to correlate an MCP error with its impact on session quality | 78 | 5 | 15.1 | Extremely Underserved |
| OS-11 | Minimize the effort to translate an observation into a workflow optimization | 70 | 15 | 12.5 | Underserved |
| OS-12 | Minimize the likelihood of Norbert itself degrading Claude Code performance | 65 | 60 | 7.0 | Overserved (hook overhead is negligible) |

### Scoring Method
- Importance: synthesized % from 7 stakeholder signals + research evidence (weighted by signal confidence)
- Satisfaction: current state with existing tools/workarounds
- Score: Importance + max(0, Importance - Satisfaction)
- Data Quality: synthesized from discovery artifacts (not direct survey). Confidence: Medium-High.

### Top Opportunities (Score >= 15)
1. **OS-1** (18.0): Token cost attribution -- highest combined pain + gap
2. **OS-2** (17.6): MCP silent failure detection -- acute, documented, zero current solution
3. **OS-3** (17.5): Agent trace debugging -- foundational observability need
4. **OS-4** (17.0): Context window pressure -- killer differentiator, zero competition
5. **OS-5** (17.0): MCP token overhead attribution -- specific, actionable, high impact
6. **OS-10** (15.1): MCP error-to-quality correlation -- diagnostic depth
7. **OS-6** (15.5): CLAUDE.md resolution visibility -- unique to Claude Code

### Overserved Areas (Score < 10)
1. **OS-12** (7.0): Norbert performance overhead -- hooks are already proven to be negligible. Do not over-invest in optimization that is not needed.

---

## Four Forces Summary -- Will Users Switch to Norbert?

```
         PROGRESS (strong -- users will switch)
              ^
              |
 Push:   ----+---- Pull:
 $47 blind     |   Token waterfall,
 spending,     |   DAG visualization,
 30-min MCP    |   MCP health dashboard,
 debugging,    |   context pressure gauge
 log-grepping  |
              |
         NO PROGRESS (weak -- users will overcome these)
              ^
              |
 Anxiety: ----+---- Habit:
 Accuracy of   |   Billing dashboard,
 estimates,    |   grep scripts,
 Norbert's own |   manual /mcp checks,
 overhead,     |   shared doc logging
 hook API      |
 stability     |
```

**Overall Assessment**: STRONG switch motivation.
- Push + Pull dramatically exceed Anxiety + Habit
- Push is intense: daily frustration, financial impact, productivity loss
- Pull is concrete: 30x improvement in diagnosis time, zero-competition features
- Anxiety is manageable: hook overhead proven negligible, accuracy improvable iteratively
- Habit is weak: nobody likes their current workarounds

**Key design implication**: The walking skeleton (JS-7) is the critical anxiety reducer. If Norbert works on first use, all other anxieties dissolve. If first-run fails, no amount of feature richness matters.

---

## Job-to-Feature Mapping

| Job Story | Primary Feature(s) | MVP Phase |
|-----------|-------------------|-----------|
| JS-1: Cost Spike Diagnosis | Token cost waterfall, session history | Phase 1 (MVP) |
| JS-2: Agent Trace Debugging | Execution trace graph (DAG) | Phase 1 (MVP) |
| JS-3: MCP Health Monitoring | MCP server health dashboard | Phase 1 (MVP) |
| JS-4: MCP Token Overhead | MCP token overhead analyzer | Phase 1 (MVP) |
| JS-5: Context Pressure | Context window pressure gauge | Phase 1 (MVP) |
| JS-6: Session History | Session history + search/filter | Phase 1 (MVP) |
| JS-7: Walking Skeleton | Hook capture + SQLite + dashboard | Phase 1 (MVP, first story) |

### Phase 2 Features (from deferred opportunities)
- Extensibility inspector (CLAUDE.md resolution, skills, hooks, agents -- unified view)
- Norbert-as-MCP-server for in-conversation queries
- Compression event tracking
- File modification heatmaps
- Session replay

### Phase 3 Features
- Output quality scoring
- Regression detection across sessions
- Prompt versioning (configuration snapshots)
- Cost budgets and alerts (team features)

---

## Walking Skeleton Definition

The walking skeleton proves the complete architecture with minimal scope:

```
[Claude Code Hook Event] --> [Norbert Background Server] --> [SQLite Storage] --> [Web Dashboard]
         |                           |                            |                     |
    1 PreToolUse event       HTTP POST receiver          1 row stored           1 event rendered
    from any tool call       on localhost:PORT            in events table        in dashboard table
```

**Scope**: Capture a single `PreToolUse` hook event, store it, display it.
**NOT in scope**: Multiple event types, aggregation, visualization, filtering.
**Success criteria**: User installs Norbert, runs a Claude Code command, opens `localhost:PORT`, sees the captured event with timestamp, tool name, and raw data.

---

## Integration Points

| Integration | Data Flow | Risk |
|-------------|-----------|------|
| Claude Code Hooks --> Norbert Server | Hook scripts POST event data to localhost | MEDIUM: Hook API stability (Knowledge Gap 1) |
| Norbert Server --> SQLite | Server writes structured events to local DB | LOW: Well-understood technology |
| SQLite --> Web Dashboard | Dashboard reads from SQLite via API | LOW: Standard web architecture |
| SQLite --> CLI Queries | CLI reads directly from SQLite | LOW: Direct DB access |
| Norbert MCP Server --> SQLite (Phase 2) | MCP tools query local DB | LOW: Proven architecture (disler project) |

---

## Caveats

1. Opportunity scores are synthesized from discovery artifacts, not direct user surveys. Treat as relative rankings, not absolute values.
2. Persona characteristics are synthesized from 7 stakeholder signals and 3 research reports. Validate with real users before Phase 2 monetization decisions.
3. Walking skeleton scope is intentionally minimal. Feature richness comes after architecture validation.
4. Hook API stability (Knowledge Gap 1 from MCP research) remains the primary technical risk. Mitigate with Phase 0 technical spike.
