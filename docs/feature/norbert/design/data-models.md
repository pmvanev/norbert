# Data Models: Norbert Observatory

**Feature ID**: norbert
**Date**: 2026-03-02

---

## 1. Hook Event Payload (Input)

Raw JSON received from Claude Code hooks via HTTP POST. This is the external contract -- Norbert does not control this schema.

**Known fields** (validated by disler project and community):

| Field | Type | Presence | Description |
|-------|------|----------|-------------|
| event_type | string | Always | One of: PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, SessionStart, Stop |
| session_id | string | Always | Claude Code session identifier |
| timestamp | string (ISO 8601) | Always | Event timestamp |
| tool_name | string | Tool events | Name of tool invoked (Read, Write, Bash, etc.) |
| tool_input | object | Tool events | Tool call input parameters |
| tool_output | object | PostToolUse | Tool call output/result |
| error | object | PostToolUseFailure | Error details |
| mcp_server | string | null | MCP tool calls | MCP server name (null for built-in tools) |
| mcp_tool_name | string | null | MCP tool calls | MCP-specific tool name |
| parent_agent_id | string | null | SubagentStart | Parent agent identifier for tree building |
| agent_id | string | null | Agent events | Current agent identifier |
| input_tokens | number | null | PostToolUse | Input token count (if available from API response) |
| output_tokens | number | null | PostToolUse | Output token count (if available from API response) |
| model | string | null | SessionStart | Model identifier (e.g., claude-opus-4-20250514) |

**Design principle**: Norbert stores the raw payload alongside structured fields. Unknown fields are preserved in a `raw_payload` JSON column. This protects against hook API changes -- new fields are captured even before Norbert explicitly supports them.

---

## 2. SQLite Schema

### 2.1 Schema Version Table

```sql
CREATE TABLE schema_version (
    version INTEGER NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT
);
```

### 2.2 Events Table (Primary Store)

```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,           -- PreToolUse, PostToolUse, etc.
    session_id TEXT NOT NULL,           -- Claude Code session ID
    timestamp TEXT NOT NULL,            -- ISO 8601 timestamp
    tool_name TEXT,                     -- Tool name (Read, Write, Bash, etc.)
    mcp_server TEXT,                    -- MCP server name (null for built-in)
    mcp_tool_name TEXT,                -- MCP-specific tool name
    agent_id TEXT,                      -- Agent identifier
    parent_agent_id TEXT,              -- Parent agent (for tree building)
    input_tokens INTEGER,              -- Input token count
    output_tokens INTEGER,             -- Output token count
    model TEXT,                        -- Model identifier
    raw_payload TEXT NOT NULL,         -- Full JSON payload (preserves unknown fields)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_mcp_server ON events(mcp_server) WHERE mcp_server IS NOT NULL;
CREATE INDEX idx_events_agent ON events(agent_id) WHERE agent_id IS NOT NULL;
```

### 2.3 Sessions Table (Aggregated View)

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,               -- session_id from Claude Code
    start_time TEXT NOT NULL,          -- First event timestamp
    end_time TEXT,                     -- Stop event timestamp (null if active)
    model TEXT,                        -- Model identifier
    agent_count INTEGER DEFAULT 0,     -- Count of distinct agents
    event_count INTEGER DEFAULT 0,     -- Total events in session
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,   -- Computed cost estimate
    mcp_error_count INTEGER DEFAULT 0, -- Count of MCP-related errors
    status TEXT DEFAULT 'active'       -- active, completed
);

CREATE INDEX idx_sessions_start ON sessions(start_time);
CREATE INDEX idx_sessions_cost ON sessions(estimated_cost);
```

### 2.4 MCP Server Events Table

```sql
CREATE TABLE mcp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    server_name TEXT NOT NULL,         -- MCP server name
    event_type TEXT NOT NULL,          -- tool_call, tool_error, connect, disconnect
    tool_name TEXT,                    -- Tool name within server
    timestamp TEXT NOT NULL,
    latency_ms INTEGER,               -- PreToolUse to PostToolUse delta
    status TEXT NOT NULL,              -- success, error, timeout
    error_detail TEXT,                 -- Error message if failed
    input_tokens INTEGER,
    output_tokens INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_mcp_events_server ON mcp_events(server_name);
CREATE INDEX idx_mcp_events_session ON mcp_events(session_id);
CREATE INDEX idx_mcp_events_status ON mcp_events(status);
```

### 2.5 Agent Spans Table

```sql
CREATE TABLE agent_spans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    parent_agent_id TEXT,              -- null for root agent
    start_time TEXT NOT NULL,
    end_time TEXT,
    tool_call_count INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    status TEXT DEFAULT 'active',      -- active, completed, failed
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX idx_agent_spans_session ON agent_spans(session_id);
CREATE INDEX idx_agent_spans_parent ON agent_spans(parent_agent_id);
```

---

## 3. Domain Types (Core Module)

These are the TypeScript discriminated unions and types that the core module exports. Defined here at the domain level -- the crafter determines exact type syntax and file organization.

### 3.1 Hook Event Types (Discriminated Union)

The 7 hook event types form a discriminated union on `event_type`:

| Event Type | Key Fields | When Fired |
|-----------|------------|-----------|
| SessionStart | session_id, model, timestamp | Claude Code session begins |
| PreToolUse | session_id, tool_name, tool_input, mcp_server?, agent_id? | Before tool execution |
| PostToolUse | session_id, tool_name, tool_output, input_tokens?, output_tokens?, mcp_server? | After successful tool execution |
| PostToolUseFailure | session_id, tool_name, error, mcp_server? | After failed tool execution |
| SubagentStart | session_id, agent_id, parent_agent_id | Subagent spawned |
| SubagentStop | session_id, agent_id | Subagent completed |
| Stop | session_id, timestamp | Session ends |

### 3.2 Domain Models

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| Session | Aggregated session summary | id, startTime, endTime, model, agentCount, eventCount, totalTokens, estimatedCost, mcpErrorCount, status |
| AgentNode | Node in execution trace DAG | agentId, parentAgentId, toolCallCount, inputTokens, outputTokens, estimatedCost, status, children |
| TraceGraph | Complete execution DAG for a session | sessionId, rootAgent, allAgents, edges |
| McpServerHealth | Health summary per MCP server | serverName, status, callCount, errorCount, avgLatencyMs, tokenOverhead, errorTimeline |
| CostBreakdown | Per-agent cost attribution | sessionId, agents (sorted by cost desc), totalCost, costByMcpServer |
| ComparisonResult | Two-session comparison | previousSession, currentSession, deltas (tokens, cost, agents, errors), projectedMonthlySavings |
| SessionFilter | Query filter for session list | dateRange, costRange, agentCountRange, sortBy, sortOrder, limit, offset |

### 3.3 Cost Rate Table

| Model | Input Rate (per 1M tokens) | Output Rate (per 1M tokens) |
|-------|---------------------------|----------------------------|
| claude-opus-4 | $15.00 | $75.00 |
| claude-sonnet-4 | $3.00 | $15.00 |
| claude-haiku-3.5 | $0.80 | $4.00 |
| Default (unknown) | $3.00 | $15.00 |

Stored in `~/.norbert/config.json` and updatable by user. Default rates based on published Anthropic pricing.

---

## 4. API Contract (Server -> Dashboard)

### 4.1 Event Ingress

```
POST /api/events
Body: Raw hook event JSON
Response: 201 Created | 400 Bad Request (invalid schema)
```

### 4.2 Dashboard API Endpoints

| Method | Path | Response | Used By |
|--------|------|----------|---------|
| GET | /api/sessions | Session[] (paginated, filterable) | Overview, History |
| GET | /api/sessions/:id | Session (full detail) | Session Detail |
| GET | /api/sessions/:id/events | DomainEvent[] | Session Detail |
| GET | /api/sessions/:id/trace | TraceGraph | Execution Graph |
| GET | /api/sessions/:id/cost | CostBreakdown | Cost Waterfall |
| GET | /api/sessions/:id/compare/:otherId | ComparisonResult | Comparison View |
| GET | /api/mcp/health | McpServerHealth[] | MCP Panel, Overview |
| GET | /api/mcp/errors | McpError[] (filterable by session, server) | MCP Panel |
| GET | /api/summary/today | TodaySummary | Overview Cards |
| GET | /api/summary/weekly | WeeklySummary | History Page |
| GET | /api/export/csv | CSV file download | History Export |
| GET | /health | { status: "ok" } | Health check |

### 4.3 WebSocket Contract

```
WS /ws

Server -> Client messages:
  { type: "new_event", event: DomainEvent }
  { type: "session_updated", session: Session }
  { type: "mcp_status_change", server: string, status: string }
```

---

## 5. Data Lifecycle

### 5.1 Write Path

1. Claude Code fires hook -> Hook script POSTs raw JSON to `/api/events`
2. Event Ingress validates schema, normalizes timestamp
3. Event Processor transforms to domain event, extracts MCP fields
4. SQLite Adapter writes to `events` table (raw + structured)
5. SQLite Adapter updates `sessions` table (aggregate counters)
6. If MCP event: SQLite Adapter writes to `mcp_events` table
7. If SubagentStart/Stop: SQLite Adapter updates `agent_spans` table
8. WebSocket Manager broadcasts new event to connected clients

### 5.2 Read Path (Dashboard)

1. Dashboard SPA loads, fetches `/api/summary/today` for overview
2. User clicks session row -> fetches `/api/sessions/:id/trace` + `/api/sessions/:id/cost`
3. WebSocket receives `new_event` -> dashboard reactively updates current view

### 5.3 Read Path (CLI)

1. CLI resolves `db_path` from config
2. CLI opens SQLite directly (read-only)
3. CLI queries relevant tables using core functions
4. CLI formats output for terminal

### 5.4 Data Retention

- Default: 30 days
- Cleanup: daily batch delete of events older than retention period
- Sessions table retains aggregated summaries even after event detail is purged (configurable)
- No automatic vacuuming (manual `norbert db vacuum` command)

---

## 6. Schema Migration Strategy

- Migrations stored as numbered SQL files: `001_initial.sql`, `002_add_mcp_events.sql`, etc.
- `schema_version` table tracks applied migrations
- On server start: compare latest migration number to schema_version; apply pending migrations in order
- Migrations are forward-only (no rollback -- if needed, add a new migration that reverses)
- All migrations are idempotent (use `CREATE TABLE IF NOT EXISTS`, etc.)
