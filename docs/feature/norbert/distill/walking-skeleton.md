# Walking Skeleton Strategy: Norbert Observatory

**Feature ID**: norbert
**Date**: 2026-03-02
**Author**: Quinn (Acceptance Test Designer)

---

## Philosophy

Walking skeletons answer one question: **"Can a user accomplish their goal and see the result?"**

They are NOT architecture integration tests. They trace a thin vertical slice of user value end-to-end. A non-technical stakeholder should be able to read each skeleton title and confirm: "Yes, that is what users need."

---

## 8 Walking Skeletons

### Skeleton 1: First event captured and displayed on dashboard (US-001)

**User goal**: Rafael installs Norbert and sees proof it works.
**Vertical slice**: hook -> server -> SQLite -> dashboard API
**Observable outcome**: Dashboard shows at least 1 captured event with timestamp, tool name, status.
**Why this is the first skeleton**: Proves the entire architecture. If this fails, nothing else matters. This is the most critical anxiety reducer for new users.

### Skeleton 2: Status command confirms events are flowing (US-001)

**User goal**: Rafael verifies from the terminal that Norbert is capturing data.
**Vertical slice**: hook -> server -> SQLite -> CLI query
**Observable outcome**: CLI shows event count > 0, session count >= 1, last event details.
**Why second**: Validates the CLI driving port independently of the dashboard.

### Skeleton 3: Multi-agent session with MCP calls fully captured (US-002)

**User goal**: Rafael runs a real multi-agent workflow and all events are captured.
**Vertical slice**: All 7 hook types -> server -> SQLite
**Observable outcome**: Session, subagent, tool call, and MCP events all stored with correct types.
**Why this skeleton**: Proves the event pipeline handles the full complexity of real workflows.

### Skeleton 4: Dashboard overview answers "what happened today" (US-003)

**User goal**: Rafael opens the dashboard and gets at-a-glance summary.
**Vertical slice**: SQLite -> API aggregation -> dashboard summary
**Observable outcome**: Session count, total tokens, estimated cost, MCP server list visible.
**Why this skeleton**: First real value touchpoint beyond raw events.

### Skeleton 5: Execution graph shows multi-agent delegation chain (US-004)

**User goal**: Priya sees which agents ran and how they delegated.
**Vertical slice**: SQLite agent spans -> trace builder -> API -> dashboard graph
**Observable outcome**: DAG with root and child agent nodes, each showing cost and tool count.
**Why this skeleton**: Core differentiator feature -- "Chrome DevTools for agents."

### Skeleton 6: MCP health panel shows connection status (US-005)

**User goal**: Rafael sees which MCP servers are healthy and which failed.
**Vertical slice**: SQLite MCP events -> MCP analyzer -> API -> dashboard panel
**Observable outcome**: Server status (connected/disconnected), disconnection timestamp visible.
**Why this skeleton**: Addresses the highest-pain MCP silent failure problem.

### Skeleton 7: Cost waterfall reveals the most expensive agent (US-006)

**User goal**: Rafael identifies which agent consumed the most tokens.
**Vertical slice**: SQLite token usage -> cost calculator -> API -> dashboard waterfall
**Observable outcome**: Agents sorted by cost descending, top agent with percentage of total.
**Why this skeleton**: Addresses the #1 opportunity score (OS-1, 18.0).

### Skeleton 8: Weekly review shows cost trends and baselines (US-008)

**User goal**: Rafael reviews his weekly spending patterns and baselines.
**Vertical slice**: SQLite session history -> aggregation -> API -> dashboard charts
**Observable outcome**: Daily cost trend, weekly total, baselines (avg, P95).
**Why this skeleton**: Closes the feedback loop for ongoing optimization.

---

## Skeleton vs Focused Scenario Ratio

| Feature File | Walking Skeletons | Focused Scenarios | Total | Ratio |
|-------------|-------------------|-------------------|-------|-------|
| walking-skeleton | 2 | 6 | 8 | 25:75 |
| event-pipeline | 1 | 11 | 12 | 8:92 |
| dashboard-overview | 1 | 9 | 10 | 10:90 |
| execution-trace | 1 | 8 | 9 | 11:89 |
| mcp-health | 1 | 9 | 10 | 10:90 |
| cost-waterfall | 1 | 9 | 10 | 10:90 |
| session-comparison | 1 | 8 | 9 | 11:89 |
| session-history | 1 | 13 | 14 | 7:93 |
| infrastructure | 0 | 17 | 17 | 0:100 |
| **Total** | **8** | **91** | **99** | **8:92** |

This matches the recommended ratio: 2-5 skeletons per major feature area (we have 8 across 8 features), with the vast majority being focused boundary scenarios.

---

## Litmus Test Results

Each skeleton passes the 4-point litmus test from the test-design-mandates skill:

| Skeleton | Title = user goal? | Given/When = user actions? | Then = user observations? | Stakeholder confirms? |
|----------|-------------------|---------------------------|--------------------------|----------------------|
| 1 | PASS: "First event captured and displayed" | PASS: initializes, triggers tool call | PASS: sees events on dashboard | PASS |
| 2 | PASS: "Status confirms events flowing" | PASS: checks status | PASS: sees event count > 0 | PASS |
| 3 | PASS: "Multi-agent session fully captured" | PASS: runs workflow | PASS: all event types stored | PASS |
| 4 | PASS: "Answers what happened today" | PASS: opens dashboard | PASS: sees sessions, cost, MCP health | PASS |
| 5 | PASS: "Shows delegation chain" | PASS: opens session detail | PASS: sees root + child agents | PASS |
| 6 | PASS: "Shows connection status" | PASS: opens MCP panel | PASS: sees server status | PASS |
| 7 | PASS: "Reveals most expensive agent" | PASS: views cost waterfall | PASS: sees agent costs sorted | PASS |
| 8 | PASS: "Shows cost trends and baselines" | PASS: opens weekly review | PASS: sees trends + baselines | PASS |

---

## Implementation Order

Walking skeletons should be the first scenario enabled in each feature file. The recommended order follows the roadmap phases:

1. Skeleton 1 + 2 (US-001) -- prove the architecture
2. Skeleton 3 (US-002) -- prove comprehensive capture
3. Skeleton 4 (US-003) -- prove dashboard value
4. Skeleton 5 (US-004) -- prove trace visualization
5. Skeleton 7 (US-006) -- prove cost attribution
6. Skeleton 6 (US-005) -- prove MCP health
7. US-007 skeleton (comparison) -- prove optimization loop
8. Skeleton 8 (US-008) -- prove historical analysis

Each skeleton passing signals "this feature area is architecturally viable." The software-crafter then enables focused scenarios one at a time to flesh out the feature.
