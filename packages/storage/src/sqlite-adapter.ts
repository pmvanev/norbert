/**
 * SQLite adapter -- implements StoragePort using better-sqlite3.
 *
 * This is the ONLY module that imports better-sqlite3.
 * Factory function creates a StoragePort backed by a SQLite database.
 * WAL mode enabled for concurrent read access.
 */

import BetterSqlite3 from 'better-sqlite3';
import type {
  HookEvent,
  Session,
  SessionFilter,
  SessionStatus,
  AgentNode,
  AgentStatus,
  McpServerHealth,
  McpServerStatus,
  EventType,
  OverviewSummary,
} from '@norbert/core';
import {
  estimateCost,
  extractMcpEvent,
  computeAgentSpanUpdate,
} from '@norbert/core';
import type { StoragePort, WriteResult } from './port.js';
import { runMigrations } from './migration-runner.js';

// ---------------------------------------------------------------------------
// Row types for SQLite result mapping
// ---------------------------------------------------------------------------

interface EventRow {
  readonly id: number;
  readonly event_type: string;
  readonly session_id: string;
  readonly timestamp: string;
  readonly tool_name: string | null;
  readonly mcp_server: string | null;
  readonly mcp_tool_name: string | null;
  readonly agent_id: string | null;
  readonly parent_agent_id: string | null;
  readonly input_tokens: number | null;
  readonly output_tokens: number | null;
  readonly model: string | null;
  readonly raw_payload: string;
}

interface SessionRow {
  readonly id: string;
  readonly start_time: string;
  readonly end_time: string | null;
  readonly model: string | null;
  readonly agent_count: number;
  readonly event_count: number;
  readonly total_input_tokens: number;
  readonly total_output_tokens: number;
  readonly estimated_cost: number;
  readonly mcp_error_count: number;
  readonly status: string;
}

interface AgentSpanRow {
  readonly id: number;
  readonly session_id: string;
  readonly agent_id: string;
  readonly parent_agent_id: string | null;
  readonly start_time: string;
  readonly end_time: string | null;
  readonly tool_call_count: number;
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly estimated_cost: number;
  readonly status: string;
}

// ---------------------------------------------------------------------------
// Mapping functions: database rows -> domain types
// ---------------------------------------------------------------------------

const mapRowToHookEvent = (row: EventRow): HookEvent => {
  // Reconstruct domain event from stored raw payload + extracted fields
  const rawPayload = JSON.parse(row.raw_payload) as Record<string, unknown>;

  // Reconstruct the HookEvent using the extracted columns
  const base = {
    eventType: row.event_type as EventType,
    sessionId: row.session_id,
    timestamp: row.timestamp,
  };

  switch (row.event_type) {
    case 'SessionStart':
      return { ...base, eventType: 'SessionStart', model: row.model ?? '' } as HookEvent;

    case 'PreToolUse':
      return {
        ...base,
        eventType: 'PreToolUse',
        toolName: row.tool_name ?? '',
        toolInput: (rawPayload.toolInput ?? {}) as Record<string, unknown>,
        ...(row.mcp_server != null ? { mcpServer: row.mcp_server } : {}),
        ...(row.agent_id != null ? { agentId: row.agent_id } : {}),
      } as HookEvent;

    case 'PostToolUse':
      return {
        ...base,
        eventType: 'PostToolUse',
        toolName: row.tool_name ?? '',
        toolOutput: (rawPayload.toolOutput ?? {}) as Record<string, unknown>,
        ...(row.input_tokens != null ? { inputTokens: row.input_tokens } : {}),
        ...(row.output_tokens != null ? { outputTokens: row.output_tokens } : {}),
        ...(row.mcp_server != null ? { mcpServer: row.mcp_server } : {}),
      } as HookEvent;

    case 'PostToolUseFailure':
      return {
        ...base,
        eventType: 'PostToolUseFailure',
        toolName: row.tool_name ?? '',
        error: (rawPayload.error ?? {}) as Record<string, unknown>,
        ...(row.mcp_server != null ? { mcpServer: row.mcp_server } : {}),
      } as HookEvent;

    case 'SubagentStart':
      return {
        ...base,
        eventType: 'SubagentStart',
        agentId: row.agent_id ?? '',
        parentAgentId: row.parent_agent_id ?? '',
      } as HookEvent;

    case 'SubagentStop':
      return {
        ...base,
        eventType: 'SubagentStop',
        agentId: row.agent_id ?? '',
      } as HookEvent;

    case 'Stop':
      return { ...base, eventType: 'Stop' } as HookEvent;

    default:
      return { ...base, eventType: row.event_type as EventType } as HookEvent;
  }
};

const mapRowToSession = (row: SessionRow): Session => ({
  id: row.id,
  startTime: row.start_time,
  endTime: row.end_time ?? undefined,
  model: row.model ?? '',
  agentCount: row.agent_count,
  eventCount: row.event_count,
  totalInputTokens: row.total_input_tokens,
  totalOutputTokens: row.total_output_tokens,
  estimatedCost: row.estimated_cost,
  mcpErrorCount: row.mcp_error_count,
  status: row.status as SessionStatus,
});

const mapRowToAgentNode = (row: AgentSpanRow): AgentNode => ({
  agentId: row.agent_id,
  parentAgentId: row.parent_agent_id ?? undefined,
  toolCallCount: row.tool_call_count,
  inputTokens: row.input_tokens,
  outputTokens: row.output_tokens,
  estimatedCost: row.estimated_cost,
  status: row.status as AgentStatus,
  children: [], // Flat list from DB; tree building is a domain concern
});

// ---------------------------------------------------------------------------
// Event field extraction (HookEvent -> column values)
// ---------------------------------------------------------------------------

const extractToolName = (event: HookEvent): string | null => {
  if ('toolName' in event) return event.toolName;
  return null;
};

const extractMcpServer = (event: HookEvent): string | null => {
  if ('mcpServer' in event && event.mcpServer != null) return event.mcpServer;
  return null;
};

const extractAgentId = (event: HookEvent): string | null => {
  if ('agentId' in event && event.agentId != null) return event.agentId;
  return null;
};

const extractParentAgentId = (event: HookEvent): string | null => {
  if ('parentAgentId' in event && event.parentAgentId != null) return event.parentAgentId;
  return null;
};

const extractInputTokens = (event: HookEvent): number | null => {
  if ('inputTokens' in event && event.inputTokens != null) return event.inputTokens;
  return null;
};

const extractOutputTokens = (event: HookEvent): number | null => {
  if ('outputTokens' in event && event.outputTokens != null) return event.outputTokens;
  return null;
};

const extractModel = (event: HookEvent): string | null => {
  if ('model' in event) return event.model;
  return null;
};

// ---------------------------------------------------------------------------
// Session management (upsert on event write)
// ---------------------------------------------------------------------------

const upsertSessionOnEvent = (
  db: BetterSqlite3.Database,
  event: HookEvent
): void => {
  if (event.eventType === 'SessionStart') {
    // Insert new session with event_count = 0, then increment below.
    // INSERT OR IGNORE makes this safe if session already exists.
    db.prepare(`
      INSERT OR IGNORE INTO sessions (id, start_time, model, event_count, status)
      VALUES (?, ?, ?, 0, 'active')
    `).run(event.sessionId, event.timestamp, extractModel(event));

    // Always increment event count (works for both new and existing sessions)
    db.prepare(`
      UPDATE sessions SET event_count = event_count + 1
      WHERE id = ?
    `).run(event.sessionId);

    return;
  }

  if (event.eventType === 'Stop') {
    db.prepare(`
      UPDATE sessions
      SET end_time = ?, status = 'completed', event_count = event_count + 1
      WHERE id = ?
    `).run(event.timestamp, event.sessionId);
    return;
  }

  // For all other events, increment counts and compute cost delta
  const inputTokens = extractInputTokens(event) ?? 0;
  const outputTokens = extractOutputTokens(event) ?? 0;
  const agentCountDelta = event.eventType === 'SubagentStart' ? 1 : 0;
  const mcpErrorCountDelta =
    event.eventType === 'PostToolUseFailure' && event.mcpServer != null ? 1 : 0;

  // Compute estimated cost delta using the session's model
  const sessionRow = db.prepare(`SELECT model FROM sessions WHERE id = ?`).get(event.sessionId) as { model: string | null } | undefined;
  const model = sessionRow?.model ?? 'claude-sonnet-4';
  const costDelta = estimateCost(inputTokens, outputTokens, model);

  db.prepare(`
    UPDATE sessions
    SET event_count = event_count + 1,
        total_input_tokens = total_input_tokens + ?,
        total_output_tokens = total_output_tokens + ?,
        estimated_cost = estimated_cost + ?,
        agent_count = agent_count + ?,
        mcp_error_count = mcp_error_count + ?
    WHERE id = ?
  `).run(inputTokens, outputTokens, costDelta, agentCountDelta, mcpErrorCountDelta, event.sessionId);
};

// ---------------------------------------------------------------------------
// MCP event recording
// ---------------------------------------------------------------------------

const insertMcpEventIfApplicable = (
  db: BetterSqlite3.Database,
  event: HookEvent
): void => {
  if (event.eventType !== 'PostToolUse' && event.eventType !== 'PostToolUseFailure') {
    return;
  }

  const mcpRecord = extractMcpEvent(event);
  if (mcpRecord == null) {
    return;
  }

  db.prepare(`
    INSERT INTO mcp_events (
      session_id, server_name, event_type, tool_name, timestamp,
      status, error_detail, input_tokens, output_tokens
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    mcpRecord.sessionId,
    mcpRecord.serverName,
    mcpRecord.eventType,
    mcpRecord.toolName,
    mcpRecord.timestamp,
    mcpRecord.status,
    mcpRecord.errorDetail ?? null,
    mcpRecord.inputTokens,
    mcpRecord.outputTokens,
  );
};

// ---------------------------------------------------------------------------
// Agent span recording
// ---------------------------------------------------------------------------

const upsertAgentSpanIfApplicable = (
  db: BetterSqlite3.Database,
  event: HookEvent
): void => {
  const spanUpdate = computeAgentSpanUpdate(event);
  if (spanUpdate == null) {
    return;
  }

  if (spanUpdate.type === 'create') {
    db.prepare(`
      INSERT INTO agent_spans (
        session_id, agent_id, parent_agent_id, start_time, status
      ) VALUES (?, ?, ?, ?, 'active')
    `).run(
      spanUpdate.span.sessionId,
      spanUpdate.span.agentId,
      spanUpdate.span.parentAgentId,
      spanUpdate.span.startTime,
    );
    return;
  }

  if (spanUpdate.type === 'close') {
    db.prepare(`
      UPDATE agent_spans
      SET end_time = ?, status = 'completed'
      WHERE session_id = ? AND agent_id = ?
    `).run(
      spanUpdate.endTime,
      spanUpdate.sessionId,
      spanUpdate.agentId,
    );
  }
};

// ---------------------------------------------------------------------------
// Sort field mapping
// ---------------------------------------------------------------------------

const sortFieldToColumn = (sortField: string): string => {
  const mapping: Record<string, string> = {
    startTime: 'start_time',
    estimatedCost: 'estimated_cost',
    eventCount: 'event_count',
    agentCount: 'agent_count',
  };
  return mapping[sortField] ?? 'start_time';
};

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a StoragePort backed by SQLite.
 *
 * @param dbPath - Path to the SQLite database file, or ':memory:' for in-memory.
 * @returns StoragePort with all functions implemented.
 */
export const createSqliteAdapter = (dbPath: string): StoragePort => {
  const db = new BetterSqlite3(dbPath);

  // Enable WAL mode for concurrent read access
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run pending migrations
  runMigrations(db);

  // Prepare commonly used statements
  const insertEventStmt = db.prepare(`
    INSERT INTO events (
      event_type, session_id, timestamp, tool_name, mcp_server,
      mcp_tool_name, agent_id, parent_agent_id,
      input_tokens, output_tokens, model, raw_payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const getEventsBySessionStmt = db.prepare(`
    SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC, id ASC
  `);

  const getSessionByIdStmt = db.prepare(`
    SELECT * FROM sessions WHERE id = ?
  `);

  const getAgentSpansBySessionStmt = db.prepare(`
    SELECT * FROM agent_spans WHERE session_id = ? ORDER BY start_time ASC
  `);

  const getRecentEventsStmt = db.prepare(`
    SELECT * FROM events ORDER BY timestamp DESC, id DESC LIMIT ?
  `);

  const getEventCountStmt = db.prepare(`
    SELECT COUNT(*) as count FROM events
  `);

  const getSessionCountStmt = db.prepare(`
    SELECT COUNT(*) as count FROM sessions
  `);

  const getMcpServerNamesStmt = db.prepare(`
    SELECT DISTINCT mcp_server FROM events WHERE mcp_server IS NOT NULL ORDER BY mcp_server ASC
  `);

  const getOverviewSummaryStmt = db.prepare(`
    SELECT
      COUNT(*) as session_count,
      COALESCE(SUM(total_input_tokens + total_output_tokens), 0) as total_tokens,
      COALESCE(SUM(estimated_cost), 0) as estimated_cost,
      (SELECT COUNT(DISTINCT mcp_server) FROM events WHERE mcp_server IS NOT NULL) as mcp_server_count
    FROM sessions
  `);

  // ---------------------------------------------------------------------------
  // Port function implementations
  // ---------------------------------------------------------------------------

  const writeEvent = (event: HookEvent): WriteResult => {
    try {
      const rawPayload = JSON.stringify(event);

      const writeTransaction = db.transaction(() => {
        insertEventStmt.run(
          event.eventType,
          event.sessionId,
          event.timestamp,
          extractToolName(event),
          extractMcpServer(event),
          null, // mcp_tool_name (derived from toolName + mcpServer)
          extractAgentId(event),
          extractParentAgentId(event),
          extractInputTokens(event),
          extractOutputTokens(event),
          extractModel(event),
          rawPayload,
        );
        upsertSessionOnEvent(db, event);
        insertMcpEventIfApplicable(db, event);
        upsertAgentSpanIfApplicable(db, event);
      });

      writeTransaction();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: { code: 'WRITE_ERROR', message } };
    }
  };

  const getSession = (id: string): Session | null => {
    const row = getSessionByIdStmt.get(id) as SessionRow | undefined;
    return row ? mapRowToSession(row) : null;
  };

  const getSessions = (filter: SessionFilter): readonly Session[] => {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.dateRange) {
      conditions.push('start_time >= ? AND start_time <= ?');
      params.push(filter.dateRange.start, filter.dateRange.end);
    }

    if (filter.costRange) {
      conditions.push('estimated_cost >= ? AND estimated_cost <= ?');
      params.push(filter.costRange.min, filter.costRange.max);
    }

    if (filter.agentCountRange) {
      conditions.push('agent_count >= ? AND agent_count <= ?');
      params.push(filter.agentCountRange.min, filter.agentCountRange.max);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sortColumn = sortFieldToColumn(filter.sortBy);
    const sortDirection = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';

    const query = `
      SELECT * FROM sessions
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT ? OFFSET ?
    `;

    params.push(filter.limit, filter.offset);

    const rows = db.prepare(query).all(...params) as SessionRow[];
    return rows.map(mapRowToSession);
  };

  const getEventsForSession = (sessionId: string): readonly HookEvent[] => {
    const rows = getEventsBySessionStmt.all(sessionId) as EventRow[];
    return rows.map(mapRowToHookEvent);
  };

  const getMcpHealth = (): readonly McpServerHealth[] => {
    // Aggregate MCP events by server name
    const rows = db.prepare(`
      SELECT
        server_name,
        COUNT(*) as call_count,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
        AVG(latency_ms) as avg_latency_ms,
        SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) as token_overhead
      FROM mcp_events
      GROUP BY server_name
    `).all() as Array<{
      server_name: string;
      call_count: number;
      error_count: number;
      avg_latency_ms: number | null;
      token_overhead: number;
    }>;

    return rows.map((row) => {
      const errorRate = row.call_count > 0 ? row.error_count / row.call_count : 0;
      const status: McpServerStatus =
        errorRate > 0.5 ? 'unhealthy' :
        errorRate > 0.1 ? 'degraded' :
        'healthy';

      return {
        serverName: row.server_name,
        status,
        callCount: row.call_count,
        errorCount: row.error_count,
        avgLatencyMs: row.avg_latency_ms ?? 0,
        tokenOverhead: row.token_overhead,
        errorTimeline: [], // Error details loaded on-demand
      };
    });
  };

  const getAgentSpans = (sessionId: string): readonly AgentNode[] => {
    const rows = getAgentSpansBySessionStmt.all(sessionId) as AgentSpanRow[];
    return rows.map(mapRowToAgentNode);
  };

  const getRecentEvents = (limit: number): readonly HookEvent[] => {
    const rows = getRecentEventsStmt.all(limit) as EventRow[];
    // Reverse to return in chronological order (oldest first)
    return rows.reverse().map(mapRowToHookEvent);
  };

  const getEventCount = (): number => {
    const row = getEventCountStmt.get() as { count: number };
    return row.count;
  };

  const getSessionCount = (): number => {
    const row = getSessionCountStmt.get() as { count: number };
    return row.count;
  };

  const getMcpServerNames = (): readonly string[] => {
    const rows = getMcpServerNamesStmt.all() as Array<{ mcp_server: string }>;
    return rows.map((row) => row.mcp_server);
  };

  const getOverviewSummary = (): OverviewSummary => {
    const row = getOverviewSummaryStmt.get() as {
      session_count: number;
      total_tokens: number;
      estimated_cost: number;
      mcp_server_count: number;
    };

    return {
      sessionCount: row.session_count,
      totalTokens: row.total_tokens,
      estimatedCost: row.estimated_cost,
      mcpServerCount: row.mcp_server_count,
    };
  };

  const close = (): void => {
    db.close();
  };

  return {
    writeEvent,
    getSession,
    getSessions,
    getEventsForSession,
    getRecentEvents,
    getEventCount,
    getSessionCount,
    getMcpServerNames,
    getMcpHealth,
    getOverviewSummary,
    getAgentSpans,
    close,
  };
};
