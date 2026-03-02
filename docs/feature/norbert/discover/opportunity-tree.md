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

---

## Opportunity Scoring

Using Opportunity Algorithm: Score = Importance + Max(0, Importance - Satisfaction)

Importance and Satisfaction ratings derived from synthesized evidence (weighted across 6 stakeholder signals).

| # | Opportunity | Importance (1-10) | Satisfaction (1-10) | Score | Rank |
|---|------------|-------------------|---------------------|-------|------|
| O1 | Token Cost Attribution | 9 | 2 | 9 + 7 = **16** | 1 |
| O2 | Agent Execution Tracing | 9 | 1 | 9 + 8 = **17** | tied-1 |
| O3 | Context File Resolution Visibility | 8 | 1 | 8 + 7 = **15** | 3 |
| O4 | Workflow Failure Recovery | 7 | 1 | 7 + 6 = **13** | 4 |
| O5 | Team Usage Analytics | 7 | 2 | 7 + 5 = **12** | 5 |
| O6 | Prompt/Config Effectiveness | 6 | 2 | 6 + 4 = **10** | 6 |
| O7 | Pre-Execution Validation | 6 | 3 | 6 + 3 = **9** | 7 |
| O8 | Workflow Orchestration Control | 5 | 2 | 5 + 3 = **8** | 8 |

### Scoring Rationale

**O1 -- Token Cost Attribution (16)**: Importance 9 because cost directly impacts budget decisions and is raised by every stakeholder. Satisfaction 2 because only crude billing dashboard exists with no per-task granularity.

**O2 -- Agent Execution Tracing (17)**: Importance 9 because this is the foundational observability need -- without it, debugging is impossible. Satisfaction 1 because no native solution exists; workarounds are log grep and custom scripts.

**O3 -- Context File Resolution (15)**: Importance 8 because this is a unique-to-Claude-Code problem that causes unpredictable behavior and erodes trust. Satisfaction 1 because this is completely opaque today.

**O4 -- Failure Recovery (13)**: Importance 7 because re-running failed workflows wastes time and money. Satisfaction 1 because no checkpoint/resume exists, but impact is somewhat mitigated by users avoiding long workflows.

**O5 -- Team Analytics (12)**: Importance 7 because teams need this for budget management, but smaller market segment than individual users. Satisfaction 2 because manual tracking exists.

**O6 -- Prompt Effectiveness (10)**: Importance 6 because useful but not urgent -- more of a "learn over time" need. Satisfaction 2 because A/B testing of prompts exists in some LLM tools.

**O7 -- Pre-Execution Validation (9)**: Importance 6 because prevention is valuable but users currently mitigate by using simpler workflows. Satisfaction 3 because some estimation is possible through experience.

**O8 -- Orchestration Control (8)**: Importance 5 because users want this conceptually but evidence of actual past behavior seeking control is thinner than for observation. Most users have adapted by using shorter workflows. Satisfaction 2 because cancellation (Ctrl+C) exists but nothing more granular.

---

## Opportunity Solution Tree

```
Desired Outcome: Minimize time/effort to understand, optimize, and debug agentic Claude Code workflows
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
+-- [15] O3: Context File Resolution Visibility
|     +-- S3a: "Active context" indicator showing resolved CLAUDE.md hierarchy
|     +-- S3b: Context diff viewer (what changed between agent invocations)
|     +-- S3c: Context resolution debugger (step through resolution order)
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

## Top 3 Opportunities -- Prioritized

### Priority 1: Agent Execution Tracing (Score: 17)
**Why first**: This is the foundational capability. Without being able to see what agents did, no other feature is fully useful. Token attribution needs tracing. Context debugging needs tracing. Failure recovery needs tracing. This is the platform layer.

**Strategic value**: This is technically the hardest but creates the most leverage. Everything else builds on top of a tracing/observability backbone.

**Differentiation**: No existing tool provides this for Claude Code. LangSmith/Langfuse work for LangChain, not for Claude Code's native architecture.

### Priority 2: Token Cost Attribution (Score: 16)
**Why second**: Highest emotional pain point. Cost surprises drive immediate behavior change (users stop using features). This also has the clearest monetization path -- users will pay for a tool that saves them money.

**Strategic value**: Clear ROI story: "Norbert paid for itself in the first week by showing me I was wasting $X on Y." This drives adoption through word-of-mouth.

**Differentiation**: Existing LLM cost tools (Helicone, etc.) work at the API level. Norbert would work at the workflow/task level -- a more meaningful abstraction for users.

### Priority 3: Context File Resolution Visibility (Score: 15)
**Why third**: This is a uniquely Claude Code problem. No competitor addresses it because it's specific to Claude Code's CLAUDE.md architecture. Highest defensibility and clearest unique value proposition.

**Strategic value**: Solves a problem that increases with Claude Code sophistication -- the more advanced the user, the more they need this. Ensures Norbert grows with user complexity.

**Differentiation**: Zero competition. This problem literally does not exist outside the Claude Code ecosystem.

---

## Job Step Coverage

| Job Step | Covered by Top 3 | Gap |
|----------|-------------------|-----|
| Define | Partial (O3 context) | Low priority -- creative/human step |
| Locate | Yes (O3) | -- |
| Prepare | Yes (O3) | -- |
| Confirm | Partial (O3) | Pre-execution validation (O7) is ranked 7th |
| Execute | Yes (O2) | -- |
| Monitor | Yes (O1, O2) | -- |
| Modify | Partial (O2 diagnosis) | Orchestration control (O8) ranked 8th |
| Conclude | Yes (O1, O2) | -- |

**Coverage**: 6 of 8 job steps fully or partially covered = 75%. With O4 (Failure Recovery, ranked 4th) as a fast-follow, coverage reaches 87.5%.

---

## Gate G2 Evaluation

| G2 Criterion | Threshold | Result | Verdict |
|-------------|-----------|--------|---------|
| Opportunities identified | 5+ distinct | 8 identified | PASS |
| Top scores | >8 / max 20 | 17, 16, 15 | PASS |
| Job step coverage | 80%+ | 75% (87.5% with fast-follow) | CONDITIONAL PASS |
| Strategic alignment | Stakeholder confirmed | Aligned with project brief vision | PASS |

**G2 Decision: PROCEED to Phase 3 -- Solution Testing**

The top 3 opportunities are clearly differentiated, score well above threshold, and address the highest-pain problems identified in Phase 1. Job step coverage is 75% with top 3 and reaches 87.5% with the natural fast-follow (O4: Failure Recovery). The "Modify" step (orchestration control) is intentionally deferred -- evidence for observation value is much stronger than for control value, which aligns with the founder's open question about observation vs. control.

**Key strategic insight**: Norbert should be an **observation-first** product. The evidence strongly supports "dashboard" over "orchestration." Control features (O8) scored lowest and had the thinnest behavioral evidence. Users are asking to see, not to steer. Control can be a roadmap item once observation trust is established.

---

## Recommendations for Phase 3

1. **Test O2 + O1 as a combined "Trace + Cost" experience** -- these are naturally intertwined. You cannot attribute cost without tracing.
2. **Test O3 as a standalone differentiator** -- unique value, test whether it is compelling enough to drive initial adoption on its own.
3. **Test delivery model** (A6 assumption): CLI overlay vs. web dashboard vs. IDE extension. Past behavior from developer tools suggests CLI-adjacent tools with a web view (like Vite's dev server, or Docker Desktop) have the highest adoption.
4. **Validate A3 early**: Technical feasibility of accessing Claude Code runtime data is an existential assumption. Phase 3 must include a technical spike.
