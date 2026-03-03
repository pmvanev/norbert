/**
 * Acceptance test for full event capture pipeline with MCP attribution.
 *
 * Story: US-002
 * Step: 02-01
 *
 * Tests the complete event processing pipeline:
 *   POST sequence of events -> session aggregates updated correctly
 *   -> MCP events recorded -> agent spans with parent-child relationships
 *
 * Uses Fastify inject (no real HTTP) with in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

describe('Full event capture pipeline with MCP attribution', () => {
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

  it('processes a full session lifecycle with MCP tool calls and subagent hierarchy', async () => {
    const sessionId = 'pipeline-test-session';

    // 1. SessionStart
    await postEvent(app, {
      event_type: 'SessionStart',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:00.000Z',
      model: 'claude-sonnet-4',
    });

    // 2. PreToolUse (MCP tool call)
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:01.000Z',
      tool_name: 'read_file',
      tool_input: { path: '/tmp/test.ts' },
      mcp_server: 'filesystem',
    });

    // 3. PostToolUse (MCP tool call with tokens)
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

    // 4. PreToolUse (built-in tool -- no MCP)
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:03.000Z',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
    });

    // 5. PostToolUse (built-in tool with tokens)
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:04.000Z',
      tool_name: 'Bash',
      tool_output: { result: 'file1.ts\nfile2.ts' },
      input_tokens: 300,
      output_tokens: 100,
    });

    // 6. SubagentStart
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:05.000Z',
      agent_id: 'agent-child-1',
      parent_agent_id: 'agent-root',
    });

    // 7. SubagentStop
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:10.000Z',
      agent_id: 'agent-child-1',
    });

    // 8. Stop
    await postEvent(app, {
      event_type: 'Stop',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:15.000Z',
    });

    // -----------------------------------------------------------------------
    // VERIFY: Session aggregates updated incrementally
    // -----------------------------------------------------------------------
    const session = storage.getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session!.status).toBe('completed');
    expect(session!.eventCount).toBe(8);
    expect(session!.totalInputTokens).toBe(800);   // 500 + 300
    expect(session!.totalOutputTokens).toBe(300);   // 200 + 100
    expect(session!.agentCount).toBe(1);            // one subagent started
    expect(session!.estimatedCost).toBeGreaterThan(0);
    expect(session!.endTime).toBe('2026-03-03T10:00:15.000Z');

    // -----------------------------------------------------------------------
    // VERIFY: MCP events recorded with server name and tool name
    // -----------------------------------------------------------------------
    const mcpHealth = storage.getMcpHealth();
    expect(mcpHealth.length).toBeGreaterThanOrEqual(1);
    const fsServer = mcpHealth.find(h => h.serverName === 'filesystem');
    expect(fsServer).toBeDefined();
    expect(fsServer!.callCount).toBeGreaterThanOrEqual(1);

    // -----------------------------------------------------------------------
    // VERIFY: Agent spans with parent-child relationships
    // -----------------------------------------------------------------------
    const agentSpans = storage.getAgentSpans(sessionId);
    expect(agentSpans.length).toBeGreaterThanOrEqual(1);
    const childSpan = agentSpans.find(s => s.agentId === 'agent-child-1');
    expect(childSpan).toBeDefined();
    expect(childSpan!.parentAgentId).toBe('agent-root');
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
