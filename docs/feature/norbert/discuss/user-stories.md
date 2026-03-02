# User Stories: Norbert Observatory MVP

**Feature ID**: norbert
**Date**: 2026-03-02
**Phase**: Product Owner Phase 3 -- Requirements Crafting
**Story count**: 8 MVP stories (walking skeleton + 7 feature stories)
**Total MVP scope**: ~16-20 days estimated effort

---

## Story Map

```
Workflow:  [Install]  -->  [Capture]  -->  [Observe]  -->  [Diagnose]  -->  [Optimize]  -->  [Review]
              |               |              |               |               |               |
Row 1      US-001          US-002          US-003          US-004          US-007          US-008
(MVP):     Walking         Event           Dashboard       Execution       Cost            Session
           Skeleton        Capture         Overview        Trace Graph     Comparison      History
              |               |              |               |
Row 1      (included       US-005          US-006
(MVP):      in US-001)     MCP Health      Cost
                           Dashboard       Waterfall

Row 2                                      US-XXX          US-XXX          US-XXX
(Phase 2):                                 Context         MCP Token       Extensibility
                                           Pressure        Overhead        Inspector
                                           Gauge           Analyzer
```

Note: Context Window Pressure Gauge (JS-5) and MCP Token Overhead Analyzer (JS-4) are deferred to Phase 2 stories to keep MVP right-sized. The walking skeleton + 7 feature stories form a coherent MVP that proves the architecture and delivers core value.

---

## US-001: Walking Skeleton -- First Captured Event on Dashboard

### Problem
Rafael Oliveira is a senior developer who runs multi-agent Claude Code workflows daily. He has never had any observability into his Claude Code sessions. He finds it impossible to know whether a new tool will actually work with his setup until he tries it -- and developer tools have notoriously high install-drop-off rates. If Norbert does not produce visible value within 5 minutes of install, Rafael will abandon it.

### Who
- Power user | First-time Norbert install | Needs immediate proof of value before trusting the tool

### Job Story Trace
- **JS-7**: Walking Skeleton Validation
- **Outcome**: OS-7 (14.9) -- Minimize the time from install to first captured event displayed

### Solution
A thin end-to-end slice that proves the complete architecture: `norbert init` configures hooks and starts the server, capturing one hook event from a Claude Code command, storing it in SQLite, and displaying it in a minimal web dashboard.

### Domain Examples
#### 1: Happy Path -- Rafael's First Install
Rafael opens his terminal, runs `npm install -g norbert && norbert init`. Norbert writes 7 hook entries to `.claude/settings.json`, creates `~/.norbert/norbert.db`, and starts a server on `localhost:7890`. Rafael then asks Claude Code to "read package.json" -- a simple command. He runs `norbert status` and sees "Events captured: 2" (PreToolUse + PostToolUse for the Read call). He opens `http://localhost:7890` and sees a table with the two events: timestamps, tool name "Read", and status "success".

#### 2: Edge Case -- Existing Hooks Present
Priya Chakraborty already has 5 custom hooks in her `.claude/settings.json` for her framework's logging middleware. She runs `norbert init`. Norbert appends its 7 hook entries to the existing hooks array without modifying Priya's entries. Both Norbert hooks and Priya's hooks fire independently during Claude Code execution.

#### 3: Error/Boundary -- Port Conflict
Marcus Chen has a local development server running on port 7890. He runs `norbert init`. Norbert detects the port conflict and reports: "Port 7890 is in use. Try: norbert init --port 7891". No partial configuration is written -- the init is atomic (either complete or rolled back).

### UAT Scenarios (BDD)

#### Scenario: Happy Path -- First event captured and displayed
```gherkin
Given Rafael has Node.js 18+ installed and Claude Code configured
When Rafael runs "npm install -g norbert && norbert init"
And Rafael asks Claude Code to read a file
And Rafael opens http://localhost:7890 in his browser
Then the dashboard displays at least 1 captured event
And each event shows timestamp, tool name, and status
And the total time from "norbert init" to seeing the event is under 5 minutes
```

#### Scenario: Existing hooks preserved
```gherkin
Given Priya has 5 custom hooks in .claude/settings.json
When Priya runs "norbert init"
Then .claude/settings.json contains Priya's 5 original hooks
And .claude/settings.json contains 7 new Norbert hooks
And both sets of hooks fire when Claude Code executes a tool call
```

#### Scenario: Port conflict handled gracefully
```gherkin
Given port 7890 is occupied by another process
When Marcus runs "norbert init"
Then Norbert reports "Port 7890 is in use"
And suggests using --port flag with an alternative port
And no hook configuration or database is created
```

#### Scenario: Server crash does not affect Claude Code
```gherkin
Given Norbert server is running and Rafael is using Claude Code
When the Norbert server process crashes
Then Claude Code continues operating without interruption
And hook scripts fail silently (non-blocking, async HTTP POST)
And Rafael can restart with "norbert serve" without data loss
```

### Acceptance Criteria
- [ ] `norbert init` completes in under 30 seconds
- [ ] Hook configuration is additive (does not modify existing hooks)
- [ ] Initialization is atomic (no partial state on failure)
- [ ] First captured event is visible on dashboard within 5 minutes of install
- [ ] Norbert server crash does not affect Claude Code operation
- [ ] Port conflict produces actionable error message

### Technical Notes
- Hook scripts use async HTTP POST (non-blocking) to Norbert server
- SQLite schema version tracked for future migrations
- Walking skeleton scope: minimal event table, no aggregation, no visualization beyond a list
- Dependency: Claude Code hooks API (12 lifecycle event types documented, community-validated)

### Dependencies
- Claude Code hooks API (validated by disler project and 3+ forks)
- Node.js 18+ runtime
- No external services required (local-first architecture)

### Size Estimate
- Effort: 3 days
- UAT scenarios: 4
- Demonstrable: Yes -- "look, it captured an event and showed it on a web page"

---

## US-002: Event Capture Pipeline -- All Hook Types Stored with MCP Attribution

### Problem
Rafael Oliveira runs Claude Code sessions with tool calls, subagent spawning, and MCP server interactions. After the walking skeleton proves the pipeline works, he needs all relevant event types captured -- not just tool calls but agent lifecycle events and MCP-specific data (which server, which tool, latency, success/failure). Without comprehensive capture, downstream features (trace graph, cost waterfall, MCP health) cannot function.

### Who
- Power user | Running multi-agent workflows with MCP servers | Needs comprehensive data capture

### Job Story Trace
- **JS-2**: Agent Trace Debugging (foundational data)
- **JS-3**: MCP Server Health Monitoring (MCP event capture)
- **Outcome**: OS-3 (17.5) -- foundational for all downstream features

### Solution
Expand the walking skeleton's single-event capture to handle all 7 configured hook types (PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, SessionStart, Stop). Store structured event data including MCP attribution fields (`mcp_server`, `mcp_tool_name`) when present. Schema aligned with OpenTelemetry MCP semantic conventions.

### Domain Examples
#### 1: Happy Path -- Multi-agent session with MCP calls
Rafael runs an 8-agent refactoring workflow. Norbert captures: 1 SessionStart, 4 SubagentStart, 4 SubagentStop, 23 PreToolUse, 22 PostToolUse, 1 PostToolUseFailure (sentry timeout), 1 Stop. MCP tool calls include `mcp_server: "github"` and `mcp_tool_name: "get_file"`. Each event has a session_id linking it to the same session and a trace_id linking parent/child agents.

#### 2: Edge Case -- Tool call with no MCP server (built-in tool)
Rafael's Claude Code uses the built-in Read tool (not an MCP tool). The PostToolUse event has `mcp_server: null` and `mcp_tool_name: null`. The event is still captured and stored with all other fields populated.

#### 3: Error/Boundary -- Hook fires but server is temporarily unreachable
The Norbert server restarts during a Claude Code session. Three hook events fire while the server is down. They are lost (async fire-and-forget). When the server comes back up, subsequent events are captured normally. No data corruption occurs.

### UAT Scenarios (BDD)

#### Scenario: All hook types captured from multi-agent session
```gherkin
Given Rafael has Norbert capturing events
When Rafael runs an 8-agent Claude Code workflow with MCP tool calls
Then Norbert stores SessionStart, SubagentStart, SubagentStop, PreToolUse, PostToolUse, and Stop events
And each event has a session_id, timestamp, and event_type
And MCP tool call events include mcp_server and mcp_tool_name fields
```

#### Scenario: Built-in tool calls stored without MCP attribution
```gherkin
Given Rafael runs a Claude Code command that uses the built-in Read tool
When the PostToolUse event is captured
Then the event is stored with mcp_server as null
And all other fields (timestamp, tool_name, session_id) are populated
```

#### Scenario: Events during server downtime are lost without corruption
```gherkin
Given the Norbert server restarts during a Claude Code session
When 3 hook events fire while the server is unreachable
Then those 3 events are not stored in the database
And events captured after server recovery are stored correctly
And the database remains consistent with no corrupted entries
```

#### Scenario: SubagentStart and SubagentStop events link parent-child agents
```gherkin
Given main-orchestrator spawns code-analyzer as a subagent
When Norbert captures SubagentStart for code-analyzer
Then the event includes the parent agent identifier (main-orchestrator)
And the corresponding SubagentStop event closes the span
And the parent-child relationship is queryable for trace graph construction
```

### Acceptance Criteria
- [ ] All 7 hook types are captured and stored
- [ ] MCP attribution fields (mcp_server, mcp_tool_name) are stored when present
- [ ] Parent-child agent relationships are captured via SubagentStart/SubagentStop
- [ ] Built-in tool calls are stored with null MCP fields (not dropped)
- [ ] Events lost during server downtime do not corrupt existing data
- [ ] Schema uses field names aligned with OTel MCP semantic conventions

### Technical Notes
- Schema fields aligned with OTel: `mcp.method.name`, `gen_ai.tool.name`, `mcp.session.id` (stored as snake_case equivalents)
- Token usage data: extract from PostToolUse event payload if available
- Hook API stability risk: document which fields are reliably present in each event type
- Dependency: US-001 (walking skeleton provides the base pipeline)

### Dependencies
- US-001 (Walking Skeleton) -- must be complete
- Claude Code hooks API providing structured event data

### Size Estimate
- Effort: 2 days
- UAT scenarios: 4
- Demonstrable: Yes -- "look, it captured agent lifecycle and MCP events with attribution"

---

## US-003: Dashboard Overview -- Sessions, MCP Health, and Key Metrics

### Problem
Rafael Oliveira opens the Norbert dashboard and currently sees only a raw event table (from the walking skeleton). He needs a summary view that answers his first question: "What happened today?" He needs to see session count, total token cost, MCP server health, and recent sessions at a glance -- without clicking into individual sessions. Priya Chakraborty needs to see which MCP servers are connected and their token overhead. Marcus Chen needs the cost summary for budget tracking.

### Who
- Power user | Opening dashboard after a day of Claude Code work | Needs at-a-glance summary
- Framework developer | Checking MCP server state | Needs health visibility
- Team lead | Weekly check-in | Needs cost summary

### Job Story Trace
- **JS-6**: Session History and Baseline Establishment
- **JS-3**: MCP Server Health Monitoring (health table)
- **Outcome**: OS-1 (18.0), OS-2 (17.6), OS-8 (13.5)

### Solution
Replace the walking skeleton's raw event table with a dashboard overview page showing: today's summary cards (sessions, tokens, estimated cost, MCP servers), a recent sessions table (sorted by start time, showing agents, tokens, cost, MCP errors, duration), and an MCP server health table (connection status, call count, error count, token overhead per server).

### Domain Examples
#### 1: Happy Path -- Rafael's End-of-Day Check
Rafael opens the dashboard at 5pm. He sees: "Sessions: 6 | Total Tokens: 142,847 | Est. Cost: $4.28 | MCP Servers: 4 connected, 0 failures." The recent sessions table shows 6 rows. Session #4 stands out with 67,234 tokens and $2.02. The MCP health table shows omni-search at 14,214 tokens of overhead.

#### 2: Edge Case -- No Sessions Today
Rafael opens the dashboard on a Saturday with no Claude Code usage. The overview shows: "Sessions: 0 | No sessions today." The MCP health table shows the last-known state of servers. A message says "Start a Claude Code session to see data here."

#### 3: Error/Boundary -- MCP Server with High Error Rate
Priya's sentry MCP server has failed 3 times today. The MCP health table shows sentry with a red status indicator, "3 errors" in the error column, and "94.2% uptime" computed from today's data.

### UAT Scenarios (BDD)

#### Scenario: Dashboard shows today's summary
```gherkin
Given Rafael completed 6 Claude Code sessions today totaling 142,847 tokens
When Rafael opens the Norbert dashboard
Then he sees "Sessions: 6" and "Total Tokens: 142,847"
And estimated cost is approximately $4.28
And 4 MCP servers are listed with "0 failures"
```

#### Scenario: Recent sessions table is clickable and sorted
```gherkin
Given 6 sessions exist with varying costs
When Rafael views the recent sessions table
Then sessions are sorted by start time descending (newest first)
And each row shows: session number, start time, agent count, tokens, cost, MCP errors, duration
And clicking a row navigates to the session detail page
```

#### Scenario: MCP health table highlights problematic servers
```gherkin
Given sentry MCP server has 3 errors today with 94.2% uptime
And omni-search has 14,214 tokens of tool description overhead
When Priya views the MCP server health table
Then sentry shows a warning indicator with "3 errors"
And omni-search shows "14,214 tokens" with a high-overhead indicator
And the total MCP token overhead is displayed below the table
```

#### Scenario: Empty state on first visit with no data
```gherkin
Given Norbert has been initialized but no Claude Code commands have been run
When Rafael opens the dashboard
Then the sessions area shows "No sessions captured yet"
And a guide says "Run any Claude Code command and data will appear here"
And the MCP health section shows "Waiting for first event..."
```

### Acceptance Criteria
- [ ] Dashboard loads in under 2 seconds with up to 100 sessions
- [ ] Summary cards show session count, total tokens, estimated cost, MCP server count
- [ ] Recent sessions table is sorted by start time, shows key metrics, and is clickable
- [ ] MCP health table shows per-server: status, call count, error count, token overhead
- [ ] Empty state provides helpful guidance (not a blank page or error)
- [ ] MCP servers with errors are visually highlighted

### Technical Notes
- Cost estimation: tokens * model-specific rate (Opus ~$15/M input, ~$75/M output)
- MCP token overhead: computed from tool description token counts captured by hooks
- Dashboard framework: lightweight web UI (React, Vue, or Svelte -- solution-architect decides)
- Dependency: US-002 (comprehensive event capture provides the data)

### Dependencies
- US-002 (Event Capture Pipeline) -- session and MCP data must be available

### Size Estimate
- Effort: 3 days
- UAT scenarios: 4
- Demonstrable: Yes -- "look, a real dashboard with today's sessions and MCP health"

---

## US-004: Execution Trace Graph -- Visual Agent Topology per Session

### Problem
Priya Chakraborty runs an 8-agent workflow that produces incorrect output. She needs to see which agents ran, in what order, which delegated to which, and where the chain broke. Currently she built custom logging middleware (40+ hours invested) that still cannot show the full agent delegation graph. When Agent 5 receives wrong context from Agent 3, she has to manually trace through JSON conversation files for 30+ minutes.

### Who
- Framework developer | Debugging multi-agent workflow failure | Needs visual execution trace

### Job Story Trace
- **JS-2**: Agent Trace Debugging
- **Outcome**: OS-3 (17.5) -- Minimize the time to trace root cause of agent chain failure

### Solution
A session detail page with a visual execution graph (DAG) showing the agent/subagent topology. Each node displays: agent name, token cost, tool call count, duration. Edges show parent-child delegation relationships. Nodes are expandable to show individual tool calls within that agent's execution.

### Domain Examples
#### 1: Happy Path -- Priya traces an 8-agent failure
Priya clicks on session #4. The execution graph shows main-orchestrator as root, with 3 child agents: code-analyzer, file-migrator, test-runner. file-migrator has a sub-agent for migration validation. Each node shows cost and tool calls. Priya clicks on file-migrator and sees 14 Read calls to `src/models/user.ts` and 6 Write calls to `src/models/user-v2.ts`. She identifies the redundant reads as the cost driver.

#### 2: Edge Case -- Single-agent session
Rafael runs a simple single-agent session. The execution graph shows a single node with no children. Tool calls are listed directly in the node detail. The visualization does not feel broken or sparse -- it adapts to the session complexity.

#### 3: Error/Boundary -- Agent fails mid-chain
test-runner agent fails after 3 of 8 test commands. The execution graph shows test-runner node with a red error indicator. Expanding the node shows the 3 successful Bash calls and the failing 4th call with error output. The downstream impact is visible: no agents were spawned after the failure.

### UAT Scenarios (BDD)

#### Scenario: Execution graph shows multi-agent topology
```gherkin
Given session #4 had main-orchestrator delegating to code-analyzer, file-migrator, and test-runner
When Priya opens the session #4 detail page
Then the execution graph shows main-orchestrator as root
And code-analyzer, file-migrator, and test-runner appear as child nodes
And each node displays agent name, token cost, and tool call count
```

#### Scenario: Node expansion shows individual tool calls
```gherkin
Given file-migrator made 14 Read calls and 6 Write calls in session #4
When Priya clicks on the file-migrator node
Then she sees a list of 20 tool calls with tool name, target file, and timestamp
And the 14 Read calls to src/models/user.ts are grouped with a redundancy indicator
```

#### Scenario: Single-agent session shows simplified view
```gherkin
Given session #5 had only a single agent with 12 tool calls
When Rafael opens the session #5 detail page
Then the execution graph shows a single node (no children)
And tool calls are listed directly without needing to expand
And the layout does not feel broken or sparse
```

#### Scenario: Failed agent shows error indicator with impact
```gherkin
Given test-runner failed at the 4th tool call in session #4
When Priya views the execution graph
Then test-runner node shows a red error indicator
And expanding the node shows 3 successful calls and 1 failed call with error output
And no downstream agents were spawned after the failure
```

### Acceptance Criteria
- [ ] Execution graph renders a DAG with correct parent-child relationships
- [ ] Each node shows agent name, token cost, tool call count, and duration
- [ ] Nodes are expandable to show individual tool calls
- [ ] Failed agents show error indicators with error details
- [ ] Single-agent sessions display cleanly (not broken layout)
- [ ] Graph renders in under 3 seconds for sessions with up to 20 agents

### Technical Notes
- DAG visualization: D3.js, Cytoscape.js, or Mermaid (solution-architect decides)
- Parent-child inference: SubagentStart events carry parent agent context
- Tool call grouping: repeated calls to same target file should be grouped with count
- Dependency: US-002 (agent lifecycle events and tool call data)

### Dependencies
- US-002 (Event Capture Pipeline) -- SubagentStart/SubagentStop and tool call events
- US-003 (Dashboard Overview) -- session detail page navigable from session list

### Size Estimate
- Effort: 3 days
- UAT scenarios: 4
- Demonstrable: Yes -- "look, a visual graph of my agent execution chain"

---

## US-005: MCP Server Health Dashboard -- Connectivity, Errors, and Diagnostics

### Problem
Rafael Oliveira has 5 MCP servers connected. One of them silently failed mid-session. He spent 30 minutes wondering why Claude could not access his database before he thought to check `/mcp`. There was no alert, no log, nothing. Silent MCP failures degrade conversation quality without any user awareness. The only current tool is `/mcp` which shows a point-in-time snapshot with no history, no metrics, and no failure timeline.

### Who
- Power user | 4+ MCP servers, mid-session failure | Needs immediate failure detection and history

### Job Story Trace
- **JS-3**: MCP Server Health Monitoring
- **Outcome**: OS-2 (17.6) -- Minimize the likelihood of an undetected MCP server failure

### Solution
A dedicated MCP panel in the dashboard showing: real-time connection status per server (connected/disconnected/error), historical status timeline (connect/disconnect/reconnect events), error timeline with categorization (connection, timeout, registration, silent drop), tool call explorer (which tool calls went to which server, with latency and success/fail), and diagnostic recommendations per error type.

### Domain Examples
#### 1: Happy Path -- Rafael detects silent MCP failure
Rafael opens the MCP panel during a session. His GitHub MCP server shows status "disconnected" with a red indicator. The timeline shows it disconnected at 14:23 after a connection timeout. The error detail says: "Connection timeout after 30s -- server process exited (exit code 1)." Rafael fixes the config and restarts the server.

#### 2: Edge Case -- Progressive latency degradation before failure
Priya's sentry MCP server shows latencies of 1.2s, 3.8s, then timeout. The MCP panel displays a latency trend visualization showing the degradation pattern. A warning suggests checking server resource allocation.

#### 3: Error/Boundary -- No MCP servers configured
Marcus has no MCP servers in his Claude Code configuration. The MCP panel shows "No MCP servers configured" with a brief explanation of what MCP servers are and a link to configuration docs.

### UAT Scenarios (BDD)

#### Scenario: MCP server failure detected with timeline
```gherkin
Given Rafael has 4 MCP servers and github disconnected at 14:23
When Rafael opens the MCP health dashboard
Then github shows status "disconnected" with a red indicator
And the timeline shows the disconnection event at 14:23
And the error detail shows "Connection timeout after 30s"
And a recommendation suggests checking server process health
```

#### Scenario: Tool call explorer shows per-server attribution
```gherkin
Given session #4 had 23 github calls, 8 sentry calls, and 15 postgres calls
When Rafael opens the tool call explorer in the MCP panel
Then each tool call shows: timestamp, server name, tool name, latency, and status
And calls are filterable by server name
And failed calls are highlighted with error details
```

#### Scenario: Progressive latency degradation visualized
```gherkin
Given sentry showed latencies of 1.2s, 3.8s, then timeout across 3 calls
When Priya views the sentry server detail
Then a latency trend shows the three data points with degradation pattern
And a warning states "Progressive latency degradation detected before failure"
And a recommendation suggests investigating server resource allocation
```

#### Scenario: No MCP servers shows helpful empty state
```gherkin
Given Marcus has no MCP servers configured in his Claude Code setup
When Marcus opens the MCP health dashboard
Then it shows "No MCP servers configured"
And explains what MCP servers are in 1-2 sentences
And links to Claude Code MCP documentation
```

### Acceptance Criteria
- [ ] Real-time connection status per MCP server (connected/disconnected/error)
- [ ] Historical timeline of connect/disconnect/reconnect events
- [ ] Error categorization: connection, timeout, registration, silent drop
- [ ] Tool call explorer with per-server attribution, latency, and success/fail
- [ ] Diagnostic recommendations per error type
- [ ] Helpful empty state when no MCP servers are configured

### Technical Notes
- MCP events derived from PostToolUse/PostToolUseFailure events with mcp_server field
- Connection status inferred from event patterns (no direct health check -- hooks observe tool call outcomes)
- Latency computed from PreToolUse to PostToolUse timestamp delta for MCP tool calls
- Dependency: US-002 (MCP event capture with attribution fields)

### Dependencies
- US-002 (Event Capture Pipeline) -- MCP-attributed events
- US-003 (Dashboard Overview) -- MCP health table in overview links to this panel

### Size Estimate
- Effort: 3 days
- UAT scenarios: 4
- Demonstrable: Yes -- "look, my MCP servers' health history and the exact failure timeline"

---

## US-006: Token Cost Waterfall -- Per-Agent and Per-Tool Cost Attribution

### Problem
Rafael Oliveira ran a refactoring task that cost $47 (from Anthropic billing). He has no idea which subtask ate the tokens. He built a bash script to grep Claude Code logs, but it takes 60+ minutes and gives incomplete answers. He needs to see per-agent, per-tool-call token consumption with cost estimates so he can identify waste points and optimize his workflows.

### Who
- Power user | Post-session cost analysis | Needs per-agent cost attribution

### Job Story Trace
- **JS-1**: Cost Spike Diagnosis
- **Outcome**: OS-1 (18.0) -- Minimize the time to attribute token cost to a specific agent or MCP server

### Solution
A token cost waterfall view within the session detail page showing: per-agent breakdown (input tokens, output tokens, estimated cost), per-tool-call breakdown (expandable within each agent), MCP tool calls attributed to their server, and a visual waterfall sorted by cost descending.

### Domain Examples
#### 1: Happy Path -- Rafael identifies cost-driving agent
Rafael opens session #4 cost waterfall. He sees: file-migrator $1.08 (53%), main-orchestrator $0.42 (21%), test-runner $0.22 (11%), code-analyzer $0.18 (9%), sentry:get_issues $0.12 (6%). He clicks file-migrator and sees 14 Read calls to the same file. Root cause identified in under 2 minutes.

#### 2: Edge Case -- MCP tool call costs attributed to server
Priya's session includes 23 GitHub MCP tool calls and 8 Sentry MCP tool calls. The waterfall shows MCP costs attributed to their servers: "github:get_file (x23) -- $0.34" and "sentry:get_issues (x8) -- $0.12". She can see MCP costs separately from built-in tool costs.

#### 3: Error/Boundary -- Cost estimate vs actual billing discrepancy
Rafael notices Norbert estimates $2.02 for session #4, but his Anthropic billing shows $2.15 for that time period. The waterfall displays a footnote: "Cost estimates use published model pricing. Actual billing may differ due to caching, rate changes, or API overhead." The 6% discrepancy is within expected tolerance.

### UAT Scenarios (BDD)

#### Scenario: Cost waterfall identifies most expensive agent
```gherkin
Given session #4 had file-migrator consuming 42,100 input tokens and 8,200 output tokens
When Rafael views the token cost waterfall for session #4
Then agents are listed in descending cost order
And file-migrator appears first with $1.08 and "53% of session cost"
And the waterfall shows both input and output token counts per agent
```

#### Scenario: Expanding agent shows per-tool-call breakdown
```gherkin
Given file-migrator made 14 Read calls and 6 Write calls
When Rafael expands the file-migrator entry in the waterfall
Then he sees individual tool calls with tool name, target, and token count
And the 14 Read calls to src/models/user.ts are grouped with a total
```

#### Scenario: MCP tool calls attributed to their server
```gherkin
Given Priya's session includes github:get_file (x23) and sentry:get_issues (x8)
When Priya views the cost waterfall
Then MCP tool calls show "server:tool_name" format
And github tool calls show aggregate cost of $0.34
And sentry tool calls show aggregate cost of $0.12
```

#### Scenario: Cost estimation footnote manages expectations
```gherkin
Given the waterfall displays estimated costs
When Rafael views the waterfall
Then a footnote explains cost estimation methodology
And states that actual billing may differ due to caching and API overhead
```

### Acceptance Criteria
- [ ] Per-agent cost breakdown showing input tokens, output tokens, and estimated cost
- [ ] Agents sorted by cost descending (most expensive first)
- [ ] Expandable agent entries showing per-tool-call breakdown
- [ ] MCP tool calls show server attribution (server:tool_name format)
- [ ] Agent costs sum to within 5% of session total (estimation tolerance)
- [ ] Cost estimation methodology footnote visible

### Technical Notes
- Token counts from PostToolUse event payloads (input_tokens, output_tokens fields)
- Cost estimation: published model pricing (Opus ~$15/M input, ~$75/M output; Sonnet ~$3/M input, ~$15/M output)
- Model identification from SessionStart event or hook metadata
- Dependency: US-002 (token data in PostToolUse events), US-004 (session detail page)

### Dependencies
- US-002 (Event Capture Pipeline) -- token usage data in events
- US-004 (Execution Trace Graph) -- session detail page hosts both views

### Size Estimate
- Effort: 2 days
- UAT scenarios: 4
- Demonstrable: Yes -- "look, every dollar attributed to a specific agent and tool call"

---

## US-007: Session Cost Comparison -- Before and After Optimization

### Problem
Rafael Oliveira restructured his file-migrator prompt after Norbert showed 14 redundant file reads costing $1.08. He needs to verify his optimization actually worked by comparing the new session to the old one. Currently he has no way to compare two sessions side-by-side to quantify improvement. Without this feedback loop, optimizations are based on gut feel rather than data.

### Who
- Power user | Post-optimization validation | Needs before/after comparison

### Job Story Trace
- **JS-1**: Cost Spike Diagnosis (the "act on insights" step)
- **Outcome**: OS-11 (12.5) -- Minimize the effort to translate observation into corrective action

### Solution
A comparison view (CLI and dashboard) that takes two sessions and displays side-by-side metrics: total tokens, total cost, per-agent breakdown, MCP errors, duration. Change percentages are computed and displayed. Projected monthly savings based on session frequency are estimated.

### Domain Examples
#### 1: Happy Path -- Rafael validates file-migrator optimization
Rafael runs `norbert cost --last --compare`. The output shows: tokens decreased 54% (67,234 to 31,200), cost decreased 53% ($2.02 to $0.94), file-migrator reads decreased 79% (14 to 3), MCP errors decreased from 1 to 0. Projected monthly savings: ~$97 at 3 sessions/day.

#### 2: Edge Case -- Sessions with different agent configurations
Priya compares two sessions where the second session has 2 additional agents. The comparison shows new agents that did not exist in the first session (marked as "new") and removed agents (marked as "removed"). Metrics for shared agents are compared directly.

#### 3: Error/Boundary -- Only one session exists
Rafael runs `norbert cost --last --compare` when only one session has been captured. The output states: "Only 1 session available. Run at least 2 sessions to compare."

### UAT Scenarios (BDD)

#### Scenario: Cost comparison shows improvement metrics
```gherkin
Given session #4 had 67,234 tokens, $2.02 cost, 14 file-migrator reads, 1 MCP error
And session #7 had 31,200 tokens, $0.94 cost, 3 file-migrator reads, 0 MCP errors
When Rafael runs "norbert cost --last --compare"
Then he sees total tokens decreased by 54%
And total cost decreased by 53%
And file-migrator reads decreased from 14 to 3
And projected monthly savings are approximately $97
```

#### Scenario: Comparison handles different agent configurations
```gherkin
Given session #4 had agents: orchestrator, analyzer, migrator
And session #7 had agents: orchestrator, analyzer, migrator, validator
When Priya views the comparison
Then shared agents (orchestrator, analyzer, migrator) show side-by-side metrics
And "validator" is marked as "new (not in previous session)"
```

#### Scenario: Single session produces helpful message
```gherkin
Given only 1 session exists in the database
When Rafael runs "norbert cost --last --compare"
Then the output states "Only 1 session available"
And suggests "Run at least 2 sessions to compare"
```

### Acceptance Criteria
- [ ] Side-by-side metrics for two sessions: tokens, cost, agents, MCP errors, duration
- [ ] Change percentages computed and displayed for each metric
- [ ] Per-agent comparison for shared agents, with "new"/"removed" labels for differences
- [ ] Projected monthly savings based on session frequency and cost delta
- [ ] Helpful message when fewer than 2 sessions exist
- [ ] Available in both CLI (`norbert cost --last --compare`) and dashboard

### Technical Notes
- "Previous" session selection: most recent session before "current" with matching workflow pattern (or simply the prior session if pattern matching is not yet implemented)
- Projected savings: `(previous_cost - current_cost) * estimated_daily_frequency * 30`
- Dashboard comparison: side-by-side layout or overlay mode
- Dependency: US-006 (cost waterfall data for per-agent comparison)

### Dependencies
- US-006 (Token Cost Waterfall) -- per-agent cost data
- At least 2 sessions captured

### Size Estimate
- Effort: 2 days
- UAT scenarios: 3
- Demonstrable: Yes -- "look, my optimization saved 53% and $97/month projected"

---

## US-008: Session History Search and Weekly Review

### Problem
Marcus Chen approved $2,000/month for Claude Code. Three weeks in, the team has spent $3,400 and he cannot tell anyone why or how to optimize. He needs to search and filter session history by date, cost, duration, and agent count, and see weekly trends to establish baselines. Currently his team manually logs "expensive sessions" in a shared Google Doc -- a tedious, incomplete, and unsustainable process that consumes ~3 hours/week of team overhead.

### Who
- Team lead | Weekly/monthly budget review | Needs historical analysis and trend visibility

### Job Story Trace
- **JS-6**: Session History and Baseline Establishment
- **Outcome**: OS-8 (13.5), OS-9 (13.4) -- historical insight and baseline establishment

### Solution
A session history page with: searchable/filterable session list (by date range, cost range, agent count, MCP server involvement), weekly/monthly trend charts (daily cost, session count), computed baselines (average cost, P95 cost, average duration, average context pressure), and CSV export for finance/stakeholder reporting.

### Domain Examples
#### 1: Happy Path -- Marcus reviews weekly spending
Marcus opens the weekly review page. He sees: total $28.40, daily average $4.06, 42 sessions. The cost trend chart shows a spike on Tuesday ($6.20) followed by steady improvement. Top cost agents table shows file-migrator improved from $2.02 to $0.94 average. Baselines: avg session cost $0.68, P95 $2.10.

#### 2: Edge Case -- Filtering by high-cost sessions
Marcus filters sessions to "Cost > $1.50" for the past 30 days. 7 sessions appear. He sorts by cost descending and identifies 3 that accounted for 60% of total spend. He clicks into each to understand the patterns.

#### 3: Error/Boundary -- Less than 7 days of data
Rafael installed Norbert 2 days ago. The weekly review shows "2 days of data available (5+ days recommended for reliable baselines)." Baselines are computed but marked as "preliminary" with a low confidence indicator.

### UAT Scenarios (BDD)

#### Scenario: Weekly review shows cost trends and baselines
```gherkin
Given Rafael has 42 sessions over 7 days totaling $28.40
When Rafael opens the weekly review page
Then he sees a daily cost trend chart for the past 7 days
And the weekly total is $28.40 with daily average $4.06
And baselines show average session cost $0.68 and P95 $2.10
```

#### Scenario: Session list filterable by cost range
```gherkin
Given 42 sessions exist with costs ranging from $0.15 to $2.10
When Marcus filters to "Cost > $1.50"
Then 7 sessions appear in the filtered list
And they are sortable by cost, date, duration, and agent count
```

#### Scenario: CSV export for stakeholder reporting
```gherkin
Given Marcus needs to share usage data with finance
When Marcus clicks "Export CSV" on the monthly review page
Then a CSV file downloads with: date, session_count, total_tokens, estimated_cost
And the CSV data matches the dashboard display
```

#### Scenario: Insufficient data shows preliminary baselines
```gherkin
Given Rafael has only 2 days of Norbert data
When Rafael opens the weekly review page
Then baselines are displayed but marked as "preliminary"
And a note states "5+ days recommended for reliable baselines"
```

### Acceptance Criteria
- [ ] Session list searchable/filterable by date range, cost range, agent count
- [ ] Weekly/monthly cost trend charts with daily granularity
- [ ] Computed baselines: average cost, P95 cost, average duration, context pressure average
- [ ] CSV export containing date, sessions, tokens, and cost
- [ ] Insufficient data produces preliminary baselines with confidence note
- [ ] Session list supports sorting by cost, date, duration, and agent count

### Technical Notes
- Baselines computed from SQLite aggregates (AVG, PERCENTILE)
- Trend charts: daily bucketing of session cost data
- CSV export: server-side generation from SQLite query results
- Retention: 30 days free tier, configurable
- Dependency: US-002 (session data), US-003 (dashboard framework)

### Dependencies
- US-002 (Event Capture Pipeline) -- historical session data
- US-003 (Dashboard Overview) -- dashboard framework and navigation

### Size Estimate
- Effort: 2 days
- UAT scenarios: 4
- Demonstrable: Yes -- "look, weekly trends, baselines, and CSV export for my finance team"

---

## Story Priority (MoSCoW for MVP)

| Priority | Story | Rationale |
|----------|-------|-----------|
| **Must Have** | US-001: Walking Skeleton | Architecture validation, gate for all other stories |
| **Must Have** | US-002: Event Capture Pipeline | Foundation for all features; no data = no product |
| **Must Have** | US-003: Dashboard Overview | First value touchpoint; answers "what happened today?" |
| **Must Have** | US-004: Execution Trace Graph | Core differentiator; "Chrome DevTools for agents" |
| **Must Have** | US-005: MCP Health Dashboard | Tied-#1 opportunity (17.6); zero competition |
| **Must Have** | US-006: Token Cost Waterfall | #2 opportunity (18.0); "first thing every user checks" |
| **Should Have** | US-007: Session Comparison | Completes the observe-diagnose-optimize loop |
| **Should Have** | US-008: Session History | Team value, baseline establishment, CSV export |

### Recommended Build Order

```
Week 1-2:  US-001 (Walking Skeleton) --> US-002 (Event Capture)
Week 2-3:  US-003 (Dashboard Overview) --> US-006 (Cost Waterfall)
Week 3-4:  US-004 (Execution Trace) --> US-005 (MCP Health)
Week 4-5:  US-007 (Comparison) --> US-008 (Session History)
```

Stories are ordered for maximum value delivery with minimum dependency risk. Walking skeleton first, then data capture, then visualization layers.

---

## DoR Validation Summary

| Story | DoR Item | Status |
|-------|----------|--------|
| **US-001** | 1. Problem clear | PASS -- install drop-off risk, first-run anxiety |
| | 2. Persona identified | PASS -- Rafael Oliveira, first-time installer |
| | 3. 3+ domain examples | PASS -- happy path, existing hooks, port conflict |
| | 4. UAT scenarios (3-7) | PASS -- 4 scenarios |
| | 5. AC from UAT | PASS -- 6 criteria derived from scenarios |
| | 6. Right-sized | PASS -- 3 days, 4 scenarios |
| | 7. Technical notes | PASS -- async hooks, SQLite schema, atomicity |
| | 8. Dependencies tracked | PASS -- Claude Code hooks API (validated) |
| | **DoR Status** | **PASSED** |
| **US-002** | All items | PASS -- see individual story above |
| | **DoR Status** | **PASSED** |
| **US-003** | All items | PASS |
| | **DoR Status** | **PASSED** |
| **US-004** | All items | PASS |
| | **DoR Status** | **PASSED** |
| **US-005** | All items | PASS |
| | **DoR Status** | **PASSED** |
| **US-006** | All items | PASS |
| | **DoR Status** | **PASSED** |
| **US-007** | All items | PASS |
| | **DoR Status** | **PASSED** |
| **US-008** | All items | PASS |
| | **DoR Status** | **PASSED** |

**All 8 stories pass DoR. Ready for DESIGN wave handoff.**

---

## Phase 2 Story Candidates (Not Yet DoR-Validated)

| Story | Job Story | Priority |
|-------|-----------|----------|
| US-009: Context Window Pressure Gauge | JS-5 | Must Have (Phase 2) -- killer differentiator |
| US-010: MCP Token Overhead Analyzer | JS-4 | Must Have (Phase 2) |
| US-011: Extensibility Inspector | (extends JS-2) | Should Have (Phase 2) |
| US-012: Norbert-as-MCP-Server | (extends JS-3) | Should Have (Phase 2) |
| US-013: Compression Event Tracking | (new) | Could Have (Phase 2) |
| US-014: File Modification Heatmaps | (new) | Could Have (Phase 2) |

---

## Anti-Pattern Audit

| Anti-Pattern | Found? | Evidence |
|--------------|--------|----------|
| Implement-X | NO | All stories start from user pain in domain language |
| Generic data | NO | Real names (Rafael, Priya, Marcus), real data ($2.02, 14 reads, 67K tokens) |
| Technical AC | NO | AC describe observable outcomes, not implementation ("sessions older than..." not "use JWT") |
| Oversized story | NO | All stories 2-3 days, 3-4 scenarios each |
| Abstract requirements | NO | Every story has 3 concrete domain examples with realistic data |
| Tests after code | N/A | UAT scenarios defined here; tests written RED in DELIVER wave |
