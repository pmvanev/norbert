# Shared Artifacts Registry: Norbert Observatory

**Feature ID**: norbert
**Journey**: observatory
**Date**: 2026-03-02

---

## Registry

### norbert_port

| Attribute | Value |
|-----------|-------|
| **Source of truth** | `~/.norbert/config.json` (port field, default 7890) |
| **Consumers** | `norbert init` output, `norbert status` output, `norbert serve` command, dashboard URL, all CLI commands that reference server |
| **Owner** | Configuration module |
| **Integration risk** | HIGH -- port mismatch means dashboard unreachable and hooks POST to wrong endpoint |
| **Validation** | `norbert status` displays the port; dashboard URL uses the same port; hook scripts POST to http://localhost:{port}/events |

### db_path

| Attribute | Value |
|-----------|-------|
| **Source of truth** | `~/.norbert/config.json` (dbPath field, default `~/.norbert/norbert.db`) |
| **Consumers** | `norbert init` output, `norbert status` output, CLI direct queries, web dashboard API, Norbert-as-MCP-server queries |
| **Owner** | Storage module |
| **Integration risk** | HIGH -- path mismatch means CLI reads from wrong database while dashboard reads from another |
| **Validation** | All components resolve db_path from the same config file; CLI and dashboard show identical session counts |

### session_id

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite `sessions` table primary key (UUID or auto-increment) |
| **Consumers** | Dashboard session list (clickable rows), session detail page, CLI `norbert session show`, cost comparison, trace comparison |
| **Owner** | Session tracking module |
| **Integration risk** | MEDIUM -- session_id must be consistent between list view and detail view; comparison must reference correct sessions |
| **Validation** | Clicking a session in the list loads the correct detail; `norbert session show {id}` returns matching data |

### events_captured

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite `COUNT(*)` from events table |
| **Consumers** | `norbert status` output, dashboard overview |
| **Owner** | Event ingestion module |
| **Integration risk** | LOW -- single source, computed value |
| **Validation** | Status CLI count matches dashboard overview count |

### sessions_observed

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite `COUNT(DISTINCT session_id)` from events table |
| **Consumers** | `norbert status` output, dashboard overview session count |
| **Owner** | Session tracking module |
| **Integration risk** | LOW -- single source, computed value |
| **Validation** | Status CLI count matches dashboard session table row count |

### mcp_servers

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite `mcp_events` table, `DISTINCT server_name` |
| **Consumers** | `norbert status` (servers seen), dashboard overview MCP health table, MCP panel, `norbert mcp status` |
| **Owner** | MCP tracking module |
| **Integration risk** | MEDIUM -- server names must match across all views; new server appearing mid-session must propagate |
| **Validation** | MCP server list in status, overview, and MCP panel are identical; list matches user's `.mcp.json` configuration |

### context_pressure_pct

| Attribute | Value |
|-----------|-------|
| **Source of truth** | Computed from latest session hook data: `(system_tokens + claude_md_tokens + mcp_tool_tokens + history_tokens) / context_window_size * 100` |
| **Consumers** | Dashboard overview context pressure gauge, session detail context breakdown |
| **Owner** | Context analysis module |
| **Integration risk** | MEDIUM -- requires correct context_window_size for the active model (200K for Opus, varies by model) |
| **Validation** | Component token counts sum to total used; total used / context window = displayed percentage |

### agent_tree

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite `agent_events` table, parent-child relationships via `trace_id` and `parent_agent_id` |
| **Consumers** | Dashboard session detail execution graph (DAG), CLI `norbert trace --last` |
| **Owner** | Agent tracking module |
| **Integration risk** | MEDIUM -- parent-child relationships must be correctly inferred from SubagentStart/SubagentStop pairs |
| **Validation** | DAG node count matches distinct agent count; all SubagentStart events have corresponding SubagentStop events |

### cost_waterfall

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite `token_usage` table aggregated per agent: `SUM(input_tokens)`, `SUM(output_tokens)`, computed cost |
| **Consumers** | Dashboard session detail token cost waterfall, CLI `norbert cost --last`, cost comparison |
| **Owner** | Cost analysis module |
| **Integration risk** | HIGH -- waterfall agent costs must approximately sum to session total (within 5% tolerance); comparison must reference correct session data |
| **Validation** | Sum of waterfall rows within 5% of session total; cost comparison "Previous" column matches original session detail |

### mcp_errors

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite `mcp_events` table `WHERE status = 'error' OR status = 'timeout'` |
| **Consumers** | Dashboard session detail MCP error timeline, dashboard overview error count, MCP panel, CLI `norbert mcp errors` |
| **Owner** | MCP tracking module |
| **Integration risk** | MEDIUM -- error count in overview must match error count in session detail; error timestamps must correlate with PostToolUseFailure events |
| **Validation** | Overview error count = sum of session detail error counts; each MCP error has a corresponding hook event |

### weekly_cost

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite `SUM(estimated_cost)` from sessions table `WHERE start_time >= 7 days ago` |
| **Consumers** | Dashboard weekly review, CLI `norbert session list --range 7d` |
| **Owner** | Cost analysis module |
| **Integration risk** | LOW -- computed aggregate from existing session data |
| **Validation** | Weekly total matches sum of daily totals; matches sum of individual session costs |

### baselines

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite computed aggregates: `AVG(cost)`, `PERCENTILE(cost, 95)`, `AVG(duration)`, `AVG(context_pressure)` from sessions table |
| **Consumers** | Dashboard weekly review baselines section, future anomaly detection |
| **Owner** | Analytics module |
| **Integration risk** | LOW -- computed from existing data; accuracy depends on sufficient sample size |
| **Validation** | Baselines update after each new session; P95 >= AVG; all values within plausible ranges |

### mcp_health_summary

| Attribute | Value |
|-----------|-------|
| **Source of truth** | SQLite aggregated `mcp_events`: uptime % = `(total_time - error_time) / total_time`, error count, `AVG(latency)` per server |
| **Consumers** | Dashboard weekly review MCP health table, MCP panel summary |
| **Owner** | MCP tracking module |
| **Integration risk** | MEDIUM -- uptime calculation must account for sessions where server was not needed (not counted as downtime) |
| **Validation** | Server uptime + downtime = 100%; error count matches sum across individual sessions |

### comparison_metrics

| Attribute | Value |
|-----------|-------|
| **Source of truth** | Computed delta: `(current_value - previous_value) / previous_value * 100` for each metric |
| **Consumers** | CLI `norbert cost --last --compare`, dashboard comparison view |
| **Owner** | Analytics module |
| **Integration risk** | LOW -- derived from existing session data |
| **Validation** | Change percentages are mathematically correct from raw values; "Previous" values match historical session data |

---

## Integration Validation Checklist

### Horizontal Consistency
- [ ] `norbert_port` is identical across init output, status output, and dashboard URL
- [ ] `db_path` is identical across init output, status output, and all data access points
- [ ] `events_captured` in CLI status matches event count shown on dashboard overview
- [ ] `sessions_observed` in CLI status matches row count in dashboard session table
- [ ] `mcp_servers` list is identical across status, overview, and MCP panel
- [ ] `cost_waterfall` agent costs sum to within 5% of session total cost
- [ ] `mcp_errors` count in overview matches sum of errors across individual sessions
- [ ] `baselines` in weekly review are computed from same data visible in session list

### Data Flow Integrity
- [ ] Hook events flow: Claude Code hook --> HTTP POST --> Norbert server --> SQLite --> dashboard/CLI
- [ ] Every hook event received by server is persisted in SQLite (no silent drops)
- [ ] Dashboard reads and CLI reads both query the same SQLite database at `${db_path}`
- [ ] Session detail data is a strict superset of session list row data

### CLI/Dashboard Parity
- [ ] `norbert cost --last` shows same cost breakdown as dashboard session detail cost waterfall
- [ ] `norbert mcp status` shows same server list as dashboard MCP health table
- [ ] `norbert trace --last` shows same agent topology as dashboard execution graph (text vs visual)
- [ ] `norbert session list` shows same sessions as dashboard recent sessions table
