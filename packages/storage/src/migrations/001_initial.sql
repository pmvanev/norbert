-- Migration 001: Initial schema
-- Creates the 4 domain tables + indexes for Norbert Observatory.

-- Events table: raw hook events from Claude Code
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    session_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    tool_name TEXT,
    mcp_server TEXT,
    mcp_tool_name TEXT,
    agent_id TEXT,
    parent_agent_id TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    model TEXT,
    raw_payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_mcp_server ON events(mcp_server) WHERE mcp_server IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_agent_id ON events(agent_id) WHERE agent_id IS NOT NULL;

-- Sessions table: aggregated session summaries
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT,
    model TEXT,
    agent_count INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    mcp_error_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_estimated_cost ON sessions(estimated_cost);

-- MCP events table: per-invocation MCP server call records
CREATE TABLE IF NOT EXISTS mcp_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    server_name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    tool_name TEXT,
    timestamp TEXT NOT NULL,
    latency_ms INTEGER,
    status TEXT NOT NULL,
    error_detail TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_mcp_events_server_name ON mcp_events(server_name);
CREATE INDEX IF NOT EXISTS idx_mcp_events_session_id ON mcp_events(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_events_status ON mcp_events(status);

-- Agent spans table: per-agent execution spans within a session
CREATE TABLE IF NOT EXISTS agent_spans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    parent_agent_id TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT,
    tool_call_count INTEGER DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    estimated_cost REAL DEFAULT 0.0,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_agent_spans_session_id ON agent_spans(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_spans_parent_agent_id ON agent_spans(parent_agent_id);
