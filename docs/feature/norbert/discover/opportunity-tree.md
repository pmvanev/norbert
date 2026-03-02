# Opportunity Solution Tree: Norbert

**Feature ID**: norbert
**Phase**: 2 - Opportunity Mapping
**Date**: 2026-03-02
**Status**: VALIDATED -- proceed to Phase 3

---

## Desired Outcome

> Minimize the time and effort required for Claude Code power users to understand, optimize, and debug their agentic workflows.

---

## Job Map: Managing Agentic Claude Code Workflows

| Step | Job Step Description | Desired Outcome Statement |
|------|---------------------|--------------------------|
| Define | Determine what the multi-agent workflow should accomplish | Minimize the time to define clear task boundaries and agent responsibilities |
| Locate | Find the right context files, skills, and configurations | Minimize the likelihood of using incorrect or missing context |
| Prepare | Configure agents, context files, and workflow parameters | Minimize the likelihood of misconfigured agent dependencies |
| Confirm | Verify the workflow is set up correctly before execution | Minimize the likelihood of launching a workflow with undetected errors |
| Execute | Run the multi-agent workflow | Minimize the time from workflow start to quality completion |
| Monitor | Track progress, token usage, and agent behavior during execution | Minimize uncertainty about what agents are doing and what they cost |
| Modify | Adjust the workflow when something goes wrong or needs change | Minimize the effort to correct mid-execution problems |
| Conclude | Complete the workflow and understand what happened | Minimize the time from completion to actionable understanding of results |

---

## Opportunity Identification

From Phase 1 evidence, 8 distinct opportunities emerged across the job map.

### Opportunity 1: Token Cost Attribution and Optimization
**Job step**: Monitor, Conclude
**Description**: Enable users to see exactly how many tokens each agent, task, and subtask consumed, with cost estimates in real time and historically.
**Evidence**: Signal 1 ($47 mystery charge), Signal 3 ($3,400 unexplained spend), Signal 5 (market validation of LLM cost tools)
**Customer words**: "I ran a refactor task and it cost $47 -- I have no idea which subtask ate the tokens"

### Opportunity 2: Agent Execution Tracing
**Job step**: Monitor, Modify, Conclude
**Description**: Provide a real-time and post-hoc view of the agent execution graph -- which agents ran, in what order, what decisions they made, what tools they called.
**Evidence**: Signal 1 (debugging blind), Signal 2 (custom logging middleware), Signal 6 (community log parsers)
**Customer words**: "When something goes wrong, I'm debugging blind"

### Opportunity 3: Context File Resolution Visibility
**Job step**: Locate, Prepare, Confirm
**Description**: Show which CLAUDE.md files, skills, and context configurations are active for each agent at each point in execution.
**Evidence**: Signal 2 (15 CLAUDE.md files and prayer), Signal 2 (30+ min debugging wrong context)
**Customer words**: "Context file resolution is a black box -- I configure 15 CLAUDE.md files and pray the right one wins"

### Opportunity 4: Workflow Failure Recovery
**Job step**: Modify, Execute
**Description**: Enable users to understand where a workflow failed, inspect intermediate state, and resume or retry from that point.
**Evidence**: Signal 1 (re-run entire workflow), Signal 4 (abandoned multi-agent due to failure anxiety)
**Customer words**: "When a multi-agent workflow fails at step 6 of 10, I have to re-run the whole thing"

### Opportunity 5: Team Usage Analytics
**Job step**: Monitor, Conclude
**Description**: Provide team-level dashboards for usage patterns, cost attribution by developer/project/task, and optimization recommendations.
**Evidence**: Signal 3 (shared doc for manual logging), Signal 3 (considering limiting access)
**Customer words**: "I approved $2,000/month. Three weeks in, we've spent $3,400 and I can't tell anyone why"

### Opportunity 6: Prompt/Configuration Effectiveness
**Job step**: Confirm, Conclude
**Description**: Enable users to compare outcomes across different prompts, configurations, and agent setups to learn what works.
**Evidence**: Signal 1 (switched to conservative patterns), Signal 4 (self-limited to simple usage)
**Customer words**: "I know multi-agent could be more powerful, but the lack of visibility makes it feel dangerous"

### Opportunity 7: Pre-Execution Validation
**Job step**: Prepare, Confirm
**Description**: Before running a complex workflow, validate configuration, estimate cost, and preview the execution plan.
**Evidence**: Signal 4 (fear of unpredictable runs), Signal 3 (no guardrails data)
**Customer words**: "I don't trust what I can't see"

### Opportunity 8: Workflow Orchestration Control
**Job step**: Execute, Modify
**Description**: Enable users to pause, redirect, cancel, or modify running multi-agent workflows.
**Evidence**: Signal 4 (abandonment due to lack of control), original project brief mentions this
**Customer words**: Inferred from avoidance behavior -- users want control but evidence is thinner here than for observation.

### Opportunity 9: MCP Server Connectivity and Health Monitoring (Added 2026-03-02)
**Job step**: Confirm, Monitor, Modify
**Description**: Provide real-time visibility into MCP server connection status, health history, silent failure detection, and reconnection events. Surface connection drops immediately rather than letting users discover them mid-conversation.
**Evidence**: MCP Research Finding 4 (silent failures -- GitHub #12086, #27159, #29730), Finding 2 (minimal runtime visibility), Signal 7 (MCP power user), 28 cross-referenced sources
**Customer words**: "When external MCP servers fail to load, no error messages are shown to the user" (GitHub #12086)
**Competitive gap**: Zero tools at Norbert's tier. MCP Inspector is dev-time only. Enterprise solutions (Datadog, Grafana) require cloud setup.

### Opportunity 10: MCP Tool Call Routing Transparency (Added 2026-03-02)
**Job step**: Monitor, Conclude
**Description**: Show which MCP server handled each tool call, with attribution metadata (server name, tool name, timestamp, latency, success/fail). Resolve the "which server did Claude use?" black box.
**Evidence**: MCP Research Finding 11 (routing transparency gap -- Cursor forum, MCP architecture docs), Finding 1 (1:1 isolation means no cross-server visibility), Signal 7
**Customer words**: "MCP tool routing ignores server name when multiple servers expose same tool name" (Cursor forum)
**Competitive gap**: No existing tool provides tool-to-server attribution for Claude Code users. MCPcat provides server-author analytics only.

### Opportunity 11: MCP Token Overhead Attribution (Added 2026-03-02)
**Job step**: Monitor, Conclude
**Description**: Attribute token consumption to individual MCP servers -- tool description overhead, tool call input/output tokens, and Tool Search impact. Show users which MCP servers are the most expensive.
**Evidence**: MCP Research Finding 3 (67K+ token overhead from 4 servers -- GitHub #3406), Finding 13 (community demand), multiple blog posts documenting workarounds
**Customer words**: "67,000 tokens consumed just from connecting four MCP servers to Claude Code, with context gone before writing a single prompt" (GitHub #3406)
**Competitive gap**: No per-server token attribution exists. Anthropic billing dashboard shows only aggregate usage.

### Opportunity 12: MCP Error Timeline and Diagnostics (Added 2026-03-02)
**Job step**: Monitor, Modify, Conclude
**Description**: Provide a chronological view of MCP failures, silent drops, registration issues, and recovery events. Enable post-hoc diagnosis of "what went wrong with my MCP servers during this session."
**Evidence**: MCP Research Finding 4 (silent failures), Finding 2 (debug logs not user-friendly), Finding 13 (community demand for debugging), multiple GitHub issue threads
**Customer words**: "MCPs Failing every time, but found a quirky workaround" (GitHub #29730)
**Competitive gap**: Debug logs exist at `~/.claude/logs/mcp-debug.log` but require manual inspection. No structured error timeline exists.

### Opportunity 13: MCP Data Flow Inspection (Added 2026-03-02)
**Job step**: Monitor, Conclude
**Description**: Enable inspection of data flowing through MCP tool calls -- what inputs were sent, what outputs were received, what resources were accessed. Provide the "Network tab" experience for MCP.
**Evidence**: MCP Research Finding 9 (hooks capture inputs/outputs), Finding 5 (Inspector is dev-time only), Concept A analogy ("Chrome DevTools Network tab but for agents")
**Customer words**: "Show me the actual prompt each agent received, not just the summary" (Phase 3, User 2 feature request -- extends to MCP data flow)
**Competitive gap**: MCP Inspector provides this for single-server dev-time testing. Nothing provides runtime, multi-server data flow inspection.

---

## Opportunity Scoring

Using Opportunity Algorithm: Score = Importance + Max(0, Importance - Satisfaction)

Importance and Satisfaction ratings derived from synthesized evidence (weighted across 6 stakeholder signals).

| # | Opportunity | Importance (1-10) | Satisfaction (1-10) | Score | Rank |
|---|------------|-------------------|---------------------|-------|------|
| O2 | Agent Execution Tracing | 9 | 1 | 9 + 8 = **17** | 1 |
| O1 | Token Cost Attribution | 9 | 2 | 9 + 7 = **16** | 2 |
| O9 | MCP Server Connectivity and Health | 9 | 1 | 9 + 8 = **17** | tied-1 |
| O10 | MCP Tool Call Routing Transparency | 8 | 1 | 8 + 7 = **15** | tied-3 |
| O3 | Context File Resolution Visibility | 8 | 1 | 8 + 7 = **15** | tied-3 |
| O11 | MCP Token Overhead Attribution | 8 | 1 | 8 + 7 = **15** | tied-3 |
| O12 | MCP Error Timeline and Diagnostics | 8 | 1 | 8 + 7 = **15** | tied-3 |
| O4 | Workflow Failure Recovery | 7 | 1 | 7 + 6 = **13** | 8 |
| O13 | MCP Data Flow Inspection | 7 | 1 | 7 + 6 = **13** | tied-8 |
| O5 | Team Usage Analytics | 7 | 2 | 7 + 5 = **12** | 10 |
| O6 | Prompt/Config Effectiveness | 6 | 2 | 6 + 4 = **10** | 11 |
| O7 | Pre-Execution Validation | 6 | 3 | 6 + 3 = **9** | 12 |
| O8 | Workflow Orchestration Control | 5 | 2 | 5 + 3 = **8** | 13 |

### Scoring Rationale

**O1 -- Token Cost Attribution (16)**: Importance 9 because cost directly impacts budget decisions and is raised by every stakeholder. Satisfaction 2 because only crude billing dashboard exists with no per-task granularity.

**O2 -- Agent Execution Tracing (17)**: Importance 9 because this is the foundational observability need -- without it, debugging is impossible. Satisfaction 1 because no native solution exists; workarounds are log grep and custom scripts.

**O3 -- Context File Resolution (15)**: Importance 8 because this is a unique-to-Claude-Code problem that causes unpredictable behavior and erodes trust. Satisfaction 1 because this is completely opaque today.

**O4 -- Failure Recovery (13)**: Importance 7 because re-running failed workflows wastes time and money. Satisfaction 1 because no checkpoint/resume exists, but impact is somewhat mitigated by users avoiding long workflows.

**O5 -- Team Analytics (12)**: Importance 7 because teams need this for budget management, but smaller market segment than individual users. Satisfaction 2 because manual tracking exists.

**O6 -- Prompt Effectiveness (10)**: Importance 6 because useful but not urgent -- more of a "learn over time" need. Satisfaction 2 because A/B testing of prompts exists in some LLM tools.

**O7 -- Pre-Execution Validation (9)**: Importance 6 because prevention is valuable but users currently mitigate by using simpler workflows. Satisfaction 3 because some estimation is possible through experience.

**O8 -- Orchestration Control (8)**: Importance 5 because users want this conceptually but evidence of actual past behavior seeking control is thinner than for observation. Most users have adapted by using shorter workflows. Satisfaction 2 because cancellation (Ctrl+C) exists but nothing more granular.

#### MCP Opportunity Scoring Rationale (Added 2026-03-02)

**O9 -- MCP Server Connectivity and Health (17)**: Importance 9 because silent MCP failures directly cause conversation quality degradation -- users get inferior results without knowing why. Multiple GitHub issues with active discussion. Satisfaction 1 because `/mcp` command shows only a snapshot of connection status with no history, no alerts, no metrics. The only alternative is manual checking.

**O10 -- MCP Tool Call Routing Transparency (15)**: Importance 8 because users with 3-7+ MCP servers cannot determine which server handled a request. Tool name collisions are undetected. This is critical for debugging and trust. Satisfaction 1 because zero routing attribution exists in any user-facing tool.

**O11 -- MCP Token Overhead Attribution (15)**: Importance 8 because MCP token overhead is the #1 documented surprise cost for MCP users (67K+ tokens from 4 servers). Directly amplifies P1 (token opacity) at the MCP layer. Satisfaction 1 because no per-server token attribution exists. Users resort to manually enabling/disabling servers to measure impact.

**O12 -- MCP Error Timeline and Diagnostics (15)**: Importance 8 because MCP failures are frequent and silent. Post-hoc diagnosis requires reading raw debug logs not designed for user consumption. Satisfaction 1 because `mcp-debug.log` exists but is unstructured and requires manual inspection.

**O13 -- MCP Data Flow Inspection (13)**: Importance 7 because understanding what data flows through MCP tool calls enables debugging and trust, but this is a secondary need after connectivity and routing transparency. Satisfaction 1 because MCP Inspector serves dev-time single-server testing only, not runtime multi-server inspection.

---

## Opportunity Solution Tree

```
Desired Outcome: Minimize time/effort to understand, optimize, and debug agentic Claude Code workflows
|
+== CORE AGENT OBSERVABILITY ================================================
|
+-- [17] O2: Agent Execution Tracing
|     +-- S2a: Real-time execution graph (live DAG visualization)
|     +-- S2b: Post-hoc execution timeline (session replay)
|     +-- S2c: CLI-native structured logging with trace IDs
|     +-- S2d: Agent decision audit trail (what context led to what action)
|
+-- [16] O1: Token Cost Attribution
|     +-- S1a: Per-agent/per-task token counters (real-time)
|     +-- S1b: Cost estimation before execution (budget preview)
|     +-- S1c: Historical cost analysis dashboard (trends, anomalies)
|     +-- S1d: Token budget alerts and guardrails
|
+== MCP OBSERVABILITY (P0 -- Added 2026-03-02) ==============================
|
+-- [17] O9: MCP Server Connectivity and Health
|     +-- S9a: MCP server health dashboard (connection status, uptime, reconnection history)
|     +-- S9b: Silent failure detection with immediate alerts
|     +-- S9c: Server lifecycle timeline (connect/disconnect/reconnect events)
|     +-- S9d: Tool registration monitoring (ghost tool detection)
|
+-- [15] O10: MCP Tool Call Routing Transparency
|     +-- S10a: Tool-to-server attribution panel ("Tool X from Server Y at timestamp Z")
|     +-- S10b: Tool name collision detection across servers
|     +-- S10c: Routing decision visualization (why did Claude pick Server A over B?)
|
+-- [15] O11: MCP Token Overhead Attribution
|     +-- S11a: Per-server token cost breakdown (tool descriptions + tool calls)
|     +-- S11b: Tool Search impact visualization (before/after overhead)
|     +-- S11c: Server-level cost ranking ("your most expensive MCP server is...")
|
+-- [15] O12: MCP Error Timeline and Diagnostics
|     +-- S12a: Chronological error/failure view across all MCP servers
|     +-- S12b: Error categorization (connection, registration, timeout, silent drop)
|     +-- S12c: Diagnostic recommendations per error type
|
+-- [13] O13: MCP Data Flow Inspection
|     +-- S13a: Tool call input/output viewer per MCP server
|     +-- S13b: Resource access log (what data MCP servers touched)
|     +-- S13c: Latency waterfall per MCP tool call
|
+== CLAUDE CODE SPECIFIC ====================================================
|
+-- [15] O3: Context File Resolution Visibility
|     +-- S3a: "Active context" indicator showing resolved CLAUDE.md hierarchy
|     +-- S3b: Context diff viewer (what changed between agent invocations)
|     +-- S3c: Context resolution debugger (step through resolution order)
|
+== WORKFLOW MANAGEMENT =====================================================
|
+-- [13] O4: Workflow Failure Recovery
|     +-- S4a: Checkpoint/snapshot of intermediate workflow state
|     +-- S4b: Failure point diagnosis with context dump
|     +-- S4c: Retry-from-point capability
|
+-- [12] O5: Team Usage Analytics
|     +-- S5a: Team dashboard with per-developer/per-project cost views
|     +-- S5b: Usage pattern benchmarking (what does "good" look like)
|     +-- S5c: Budget management with alerts and limits
|
+-- [10] O6: Prompt/Config Effectiveness
|     +-- S6a: Outcome tracking across prompt variations
|     +-- S6b: Configuration comparison tool
|
+-- [9] O7: Pre-Execution Validation
|     +-- S7a: Dry-run mode with cost estimate
|     +-- S7b: Configuration linter
|
+-- [8] O8: Orchestration Control
|     +-- S8a: Pause/resume workflow controls
|     +-- S8b: Agent-level intervention (redirect, cancel individual agents)
```

---

## Top Priorities -- Updated with MCP Observability (2026-03-02)

MCP research validated MCP observability as P0 core feature. The top opportunities now span two pillars: agent observability and MCP observability. These are complementary -- both use the same data capture infrastructure (Claude Code hooks) and serve the same user (Claude Code power user managing multi-agent + multi-MCP workflows).

### Priority 1: Agent Execution Tracing (Score: 17)
**Why first**: This is the foundational capability. Without being able to see what agents did, no other feature is fully useful. Token attribution needs tracing. Context debugging needs tracing. Failure recovery needs tracing. This is the platform layer.

**Strategic value**: This is technically the hardest but creates the most leverage. Everything else builds on top of a tracing/observability backbone.

**Differentiation**: No existing tool provides this for Claude Code. LangSmith/Langfuse work for LangChain, not for Claude Code's native architecture.

### Priority 1 (tied): MCP Server Connectivity and Health (Score: 17) -- NEW
**Why tied-first**: MCP silent failures are the most immediately damaging problem -- they degrade conversation quality without any user awareness. This is the MCP equivalent of "agent execution blindness" and carries the same urgency. The research documents multiple GitHub issues with active community engagement, confirming this is a real, frequent pain point.

**Strategic value**: Immediate, visible value on first use. A user connects Norbert, sees their MCP server health for the first time, and immediately understands what they have been missing. This is the "aha moment" for MCP users.

**Differentiation**: Zero competition. No tool at any tier provides Claude Code-specific MCP server health monitoring. MCP Inspector is dev-time single-server only. Enterprise tools (Datadog, Grafana) require infrastructure setup. Norbert fills a genuine gap.

### Priority 2: Token Cost Attribution (Score: 16)
**Why second**: Highest emotional pain point. Cost surprises drive immediate behavior change (users stop using features). This also has the clearest monetization path -- users will pay for a tool that saves them money.

**Strategic value**: Clear ROI story: "Norbert paid for itself in the first week by showing me I was wasting $X on Y." This drives adoption through word-of-mouth.

**Differentiation**: Existing LLM cost tools (Helicone, etc.) work at the API level. Norbert would work at the workflow/task level -- a more meaningful abstraction for users. Now enhanced with per-MCP-server token attribution (O11).

### Priority 3: MCP Observability Cluster (Scores: 15 each) -- NEW
O10 (Tool Call Routing), O11 (Token Overhead Attribution), O12 (Error Timeline), and O3 (Context Resolution) all score 15. For MCP users, O10-O12 form a natural cluster that should be delivered together as the "MCP Observatory" panel within Norbert's dashboard.

**Why clustered**: These three MCP opportunities share the same data source (hook-captured MCP events), the same UI location (MCP panel in dashboard), and the same user need (understand my MCP servers). Delivering them individually provides partial value; delivered together, they provide the complete MCP observability experience that no other tool offers.

**Strategic value**: This cluster represents Norbert's strongest competitive position. The research confirms zero tools exist at this tier with this scope. The competitive vacuum is complete.

**Differentiation**: Zero competition at Norbert's tier. MCPcat serves server authors. MetaMCP is infrastructure. Datadog/Grafana are enterprise. Norbert is the first and only local-first, Claude Code-specific MCP observatory.

### Priority 4 (retained): Context File Resolution Visibility (Score: 15)
**Why fourth**: This is a uniquely Claude Code problem. No competitor addresses it because it's specific to Claude Code's CLAUDE.md architecture. Highest defensibility and clearest unique value proposition.

**Strategic value**: Solves a problem that increases with Claude Code sophistication -- the more advanced the user, the more they need this. Ensures Norbert grows with user complexity.

**Differentiation**: Zero competition. This problem literally does not exist outside the Claude Code ecosystem.

---

## Job Step Coverage (Updated with MCP Opportunities)

| Job Step | Covered by Top Priorities | Gap |
|----------|--------------------------|-----|
| Define | Partial (O3 context) | Low priority -- creative/human step |
| Locate | Yes (O3) | -- |
| Prepare | Yes (O3) | -- |
| Confirm | Yes (O3, O9 MCP health) | O9 adds MCP server readiness check before execution |
| Execute | Yes (O2) | -- |
| Monitor | Yes (O1, O2, O9, O10, O11) | MCP opportunities significantly strengthen Monitor coverage |
| Modify | Partial (O2 diagnosis, O12 MCP errors) | O12 adds MCP error diagnostics for mid-session correction |
| Conclude | Yes (O1, O2, O10, O11, O12, O13) | MCP opportunities add rich post-hoc analysis for MCP layer |

**Coverage**: 7 of 8 job steps fully covered = 87.5%. MCP opportunities (O9-O13) significantly improved coverage of Monitor, Modify, and Conclude steps. Only "Define" remains partially covered (low priority, creative/human step).

---

## Gate G2 Evaluation (Updated 2026-03-02)

| G2 Criterion | Threshold | Result | Verdict |
|-------------|-----------|--------|---------|
| Opportunities identified | 5+ distinct | 13 identified (8 original + 5 MCP) | PASS |
| Top scores | >8 / max 20 | 17, 17, 16, 15, 15, 15, 15 | PASS |
| Job step coverage | 80%+ | 87.5% (7 of 8 steps fully covered) | PASS |
| Strategic alignment | Stakeholder confirmed | Aligned with project brief vision + MCP research validation | PASS |

**G2 Decision: PROCEED to Phase 3 -- Solution Testing** (confirmed, strengthened by MCP research)

The addition of MCP opportunities significantly strengthens the opportunity map. Job step coverage improved from 75% to 87.5% -- the MCP opportunities filled previous gaps in Confirm, Modify, and Conclude steps. The top priorities now span two pillars (agent observability + MCP observability) that share the same infrastructure and serve the same user.

**Key strategic insight (updated)**: Norbert should be an **observation-first** product covering **both agent workflows AND MCP server interactions**. The MCP research validates that these are two sides of the same coin for Claude Code power users. MCP observability is not a separate product -- it is a core pillar of the same observatory. The evidence from 28 cross-referenced sources confirms a complete competitive vacuum at Norbert's tier for MCP observability.

**Key architectural insight (new)**: Claude Code hooks are the proven data capture mechanism for both agent events AND MCP tool calls. The `disler/claude-code-hooks-multi-agent-observability` project demonstrates that hooks carry `mcp_server` and `mcp_tool_name` fields. This means a single data collection pipeline serves both observability pillars. Architecture: hooks --> local SQLite --> web dashboard + Norbert-as-MCP-server for in-conversation queries.

---

## Recommendations for Phase 3 (Updated 2026-03-02)

1. **Test O2 + O1 as a combined "Trace + Cost" experience** -- these are naturally intertwined. You cannot attribute cost without tracing.
2. **Test O9 + O10 + O11 + O12 as a combined "MCP Observatory" panel** -- these form a natural cluster. Users managing multiple MCP servers need connectivity health, routing transparency, token attribution, and error diagnostics together.
3. **Test O3 as a standalone differentiator** -- unique value, test whether it is compelling enough to drive initial adoption on its own.
4. **Test delivery model** (A6 assumption): CLI overlay vs. web dashboard vs. IDE extension. Past behavior from developer tools suggests CLI-adjacent tools with a web view (like Vite's dev server, or Docker Desktop) have the highest adoption.
5. **Validate A3 early**: Technical feasibility of accessing Claude Code runtime data is an existential assumption. Phase 3 must include a technical spike. **MCP research de-risked this significantly** -- hooks proven to capture MCP data (Finding 9).
6. **Test Norbert-as-MCP-server concept**: The research recommends hooks for data capture + MCP server for in-conversation queries. Test whether users value asking "What MCP errors occurred?" within their Claude Code session versus checking a separate dashboard.
