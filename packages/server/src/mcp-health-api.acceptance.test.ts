/**
 * Acceptance test for GET /api/mcp/health -- MCP health dashboard with diagnostics.
 *
 * Story: US-005
 * Step: 04-01
 *
 * Tests the MCP health analysis endpoint which returns:
 *   - Per-server connection status (connected/disconnected/error)
 *   - Errors categorized by type with diagnostic recommendations
 *   - Tool call explorer with server, tool, latency, success/fail
 *   - Latency degradation detection
 *   - Empty state for no MCP servers
 *
 * Uses Fastify inject (no real HTTP) with in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

describe('GET /api/mcp/health', () => {
  let storage: StoragePort;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    storage.close();
  });

  it('returns empty state with hasServers=false when no MCP servers exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/mcp/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // AC6: Empty state for no MCP servers shows helpful explanation
    expect(body.hasServers).toBe(false);
    expect(body.servers).toEqual([]);
  });

  it('returns detailed MCP health analysis with error categorization, latency trends, and diagnostics', async () => {
    const sessionId = 'mcp-health-session';

    // 1. SessionStart
    await postEvent(app, {
      event_type: 'SessionStart',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:00.000Z',
      model: 'claude-sonnet-4',
    });

    // 2. Successful MCP tool call to "filesystem" server
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:01.000Z',
      tool_name: 'read_file',
      tool_input: { path: '/tmp/test.ts' },
      mcp_server: 'filesystem',
      agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:02.000Z',
      tool_name: 'read_file',
      tool_output: { content: 'file contents' },
      input_tokens: 500,
      output_tokens: 200,
      mcp_server: 'filesystem',
    });

    // 3. Another successful MCP call to "filesystem" server
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:03.000Z',
      tool_name: 'write_file',
      tool_input: { path: '/tmp/out.ts' },
      mcp_server: 'filesystem',
      agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:04.000Z',
      tool_name: 'write_file',
      tool_output: { success: true },
      input_tokens: 300,
      output_tokens: 100,
      mcp_server: 'filesystem',
    });

    // 4. Failed MCP call to "database" server (connection error)
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:05.000Z',
      tool_name: 'query_db',
      tool_input: { sql: 'SELECT 1' },
      mcp_server: 'database',
      agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PostToolUseFailure',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:06.000Z',
      tool_name: 'query_db',
      mcp_server: 'database',
      error: { message: 'Connection refused: ECONNREFUSED 127.0.0.1:5432' },
    });

    // 5. Another failed MCP call to "database" server (timeout)
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:07.000Z',
      tool_name: 'query_db',
      tool_input: { sql: 'SELECT * FROM users' },
      mcp_server: 'database',
      agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PostToolUseFailure',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:38.000Z',
      tool_name: 'query_db',
      mcp_server: 'database',
      error: { message: 'Request timed out after 30000ms' },
    });

    // 6. Stop session
    await postEvent(app, {
      event_type: 'Stop',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:40.000Z',
    });

    // Request MCP health analysis
    const response = await app.inject({
      method: 'GET',
      url: '/api/mcp/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // AC basic: hasServers is true
    expect(body.hasServers).toBe(true);
    expect(body.servers.length).toBe(2);

    // AC1: Per-server connection status (connected/disconnected/error)
    const filesystem = body.servers.find(
      (s: { serverName: string }) => s.serverName === 'filesystem'
    );
    const database = body.servers.find(
      (s: { serverName: string }) => s.serverName === 'database'
    );

    expect(filesystem).toBeDefined();
    expect(database).toBeDefined();

    // filesystem had all successful calls
    expect(filesystem.connectionStatus).toBe('connected');
    // database had all failed calls
    expect(database.connectionStatus).toBe('error');

    // AC2: Historical timeline context -- each server has health metrics
    expect(filesystem.health.callCount).toBe(2);
    expect(filesystem.health.errorCount).toBe(0);
    expect(database.health.callCount).toBe(2);
    expect(database.health.errorCount).toBe(2);

    // AC3: Errors categorized by type with diagnostic recommendations
    expect(database.errorsByCategory.length).toBeGreaterThan(0);
    expect(database.diagnostics.length).toBeGreaterThan(0);

    // Each diagnostic has a category and a non-empty recommendation
    for (const diagnostic of database.diagnostics) {
      expect(diagnostic.category).toBeDefined();
      expect(typeof diagnostic.recommendation).toBe('string');
      expect(diagnostic.recommendation.length).toBeGreaterThan(0);
    }

    // AC4: Tool call explorer shows server name, tool, latency, success/fail
    expect(filesystem.recentCalls.length).toBe(2);
    for (const call of filesystem.recentCalls) {
      expect(call.serverName).toBe('filesystem');
      expect(call.toolName).toBeDefined();
      expect(call.timestamp).toBeDefined();
      expect(call.status).toBe('success');
    }

    expect(database.recentCalls.length).toBe(2);
    for (const call of database.recentCalls) {
      expect(call.serverName).toBe('database');
      expect(call.toolName).toBeDefined();
      expect(call.status).toBe('error');
    }

    // AC5: Latency trend detection
    expect(['stable', 'degrading', 'improving']).toContain(filesystem.latencyTrend);
    expect(['stable', 'degrading', 'improving']).toContain(database.latencyTrend);
  });
});

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

async function postEvent(
  app: ReturnType<typeof createApp>,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/events',
    payload,
  });
  expect(response.statusCode).toBe(201);
}
