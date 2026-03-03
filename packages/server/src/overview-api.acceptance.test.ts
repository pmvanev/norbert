/**
 * Acceptance tests for GET /api/overview.
 *
 * Tests the full overview endpoint flow:
 *   - Summary cards: session count, total tokens, estimated cost, MCP server count
 *   - Recent sessions: sorted by start time
 *   - MCP health: per-server status, call count, errors, token overhead
 *   - Empty state: returns zeros and empty arrays
 *
 * Uses Fastify inject (no real HTTP) with an in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

describe('GET /api/overview acceptance', () => {
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

  it('returns empty state with zeros and empty arrays when no data exists', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/overview',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // Summary cards should all be zero
    expect(body.summary).toEqual({
      sessionCount: 0,
      totalTokens: 0,
      estimatedCost: 0,
      mcpServerCount: 0,
    });

    // No sessions or MCP health entries
    expect(body.recentSessions).toEqual([]);
    expect(body.mcpHealth).toEqual([]);
  });

  it('returns summary cards with session count, total tokens, estimated cost, and MCP server count', async () => {
    // Seed two sessions with token usage
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'overview-sess-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'PostToolUse',
        session_id: 'overview-sess-1',
        timestamp: '2026-03-03T10:00:01.000Z',
        tool_name: 'Read',
        tool_output: { content: 'file contents' },
        input_tokens: 1000,
        output_tokens: 500,
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'overview-sess-2',
        timestamp: '2026-03-03T11:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'PostToolUse',
        session_id: 'overview-sess-2',
        timestamp: '2026-03-03T11:00:01.000Z',
        tool_name: 'Bash',
        tool_output: { stdout: 'ok' },
        input_tokens: 2000,
        output_tokens: 1000,
      },
    });

    // Seed an MCP tool call to establish an MCP server
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'PostToolUse',
        session_id: 'overview-sess-1',
        timestamp: '2026-03-03T10:00:02.000Z',
        tool_name: 'mcp_github__list_repos',
        tool_output: { repos: [] },
        mcp_server: 'github',
        input_tokens: 500,
        output_tokens: 200,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/overview',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // Summary cards
    expect(body.summary.sessionCount).toBe(2);
    expect(body.summary.totalTokens).toBe(1000 + 500 + 2000 + 1000 + 500 + 200); // 5200
    expect(body.summary.estimatedCost).toBeGreaterThan(0);
    expect(body.summary.mcpServerCount).toBe(1); // github

    // Recent sessions should include both sessions
    expect(body.recentSessions).toHaveLength(2);
    // Sorted by start time descending (most recent first)
    expect(body.recentSessions[0].id).toBe('overview-sess-2');
    expect(body.recentSessions[1].id).toBe('overview-sess-1');

    // MCP health should include the github server
    expect(body.mcpHealth).toHaveLength(1);
    expect(body.mcpHealth[0].serverName).toBe('github');
    expect(body.mcpHealth[0].callCount).toBeGreaterThanOrEqual(1);
  });
});
