/**
 * Acceptance test for GET /api/sessions/:id/costs -- cost waterfall with MCP attribution.
 *
 * Story: US-006
 * Step: 03-03
 *
 * Tests the cost breakdown endpoint which builds a per-agent cost waterfall:
 *   - Per-agent cost breakdown with input/output tokens and estimated cost
 *   - Agents sorted by cost descending
 *   - Expanding agent shows per-tool-call breakdown
 *   - MCP tool calls show server:tool_name format
 *   - Agent costs sum to within 5% of session total
 *   - Cost estimation methodology footnote visible
 *
 * Uses Fastify inject (no real HTTP) with in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

describe('GET /api/sessions/:id/costs', () => {
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

  it('returns per-agent cost breakdown sorted by cost descending with MCP attribution', async () => {
    const sessionId = 'cost-test-session';

    // 1. SessionStart
    await postEvent(app, {
      event_type: 'SessionStart',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:00.000Z',
      model: 'claude-sonnet-4',
    });

    // 2. PreToolUse (root agent, MCP tool)
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:01.000Z',
      tool_name: 'read_file',
      tool_input: { path: '/tmp/test.ts' },
      mcp_server: 'filesystem',
      agent_id: 'agent-root',
    });

    // 3. PostToolUse (root agent, MCP tool with tokens)
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:02.000Z',
      tool_name: 'read_file',
      tool_output: { content: 'file contents' },
      input_tokens: 1000,
      output_tokens: 500,
      mcp_server: 'filesystem',
    });

    // 4. PreToolUse (root agent, built-in tool)
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:03.000Z',
      tool_name: 'Bash',
      tool_input: { command: 'ls' },
      agent_id: 'agent-root',
    });

    // 5. PostToolUse (root agent, built-in tool)
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:04.000Z',
      tool_name: 'Bash',
      tool_output: { result: 'file1.ts' },
      input_tokens: 500,
      output_tokens: 200,
    });

    // 6. SubagentStart -- child agent
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:05.000Z',
      agent_id: 'agent-child-1',
      parent_agent_id: 'agent-root',
    });

    // 7. PreToolUse (child agent, MCP tool)
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:06.000Z',
      tool_name: 'query_db',
      tool_input: { sql: 'SELECT 1' },
      mcp_server: 'database',
      agent_id: 'agent-child-1',
    });

    // 8. PostToolUse (child agent, MCP tool with tokens)
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:07.000Z',
      tool_name: 'query_db',
      tool_output: { rows: [] },
      input_tokens: 2000,
      output_tokens: 1000,
      mcp_server: 'database',
    });

    // 9. SubagentStop
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:08.000Z',
      agent_id: 'agent-child-1',
    });

    // 10. Stop
    await postEvent(app, {
      event_type: 'Stop',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:10.000Z',
    });

    // Request cost breakdown
    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}/costs`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // AC1: Per-agent cost breakdown with input/output tokens and estimated cost
    expect(body.sessionId).toBe(sessionId);
    expect(body.agents).toBeDefined();
    expect(body.agents.length).toBeGreaterThanOrEqual(2);

    for (const agent of body.agents) {
      expect(agent.agentId).toBeDefined();
      expect(typeof agent.inputTokens).toBe('number');
      expect(typeof agent.outputTokens).toBe('number');
      expect(typeof agent.estimatedCost).toBe('number');
      expect(agent.estimatedCost).toBeGreaterThanOrEqual(0);
    }

    // AC2: Agents sorted by cost descending
    for (let i = 0; i < body.agents.length - 1; i++) {
      expect(body.agents[i].estimatedCost).toBeGreaterThanOrEqual(
        body.agents[i + 1].estimatedCost
      );
    }

    // AC3: Expanding agent shows per-tool-call breakdown
    // Each agent entry should have a toolCalls array
    for (const agent of body.agents) {
      expect(agent.toolCalls).toBeDefined();
      expect(Array.isArray(agent.toolCalls)).toBe(true);
    }

    // At least one agent should have tool calls
    const agentsWithToolCalls = body.agents.filter(
      (a: { toolCalls: unknown[] }) => a.toolCalls.length > 0
    );
    expect(agentsWithToolCalls.length).toBeGreaterThan(0);

    // AC4: MCP tool calls show server:tool_name format
    const allToolCalls = body.agents.flatMap(
      (a: { toolCalls: unknown[] }) => a.toolCalls
    );
    const mcpToolCalls = allToolCalls.filter(
      (tc: { toolName: string }) => tc.toolName.includes(':')
    );
    expect(mcpToolCalls.length).toBeGreaterThanOrEqual(2); // filesystem:read_file + database:query_db

    const filesystemCall = allToolCalls.find(
      (tc: { toolName: string }) => tc.toolName === 'filesystem:read_file'
    );
    expect(filesystemCall).toBeDefined();

    const databaseCall = allToolCalls.find(
      (tc: { toolName: string }) => tc.toolName === 'database:query_db'
    );
    expect(databaseCall).toBeDefined();

    // AC5: Agent costs sum to within 5% of session total
    const agentCostSum = body.agents.reduce(
      (sum: number, a: { estimatedCost: number }) => sum + a.estimatedCost,
      0
    );
    expect(body.totalCost).toBeGreaterThan(0);
    const tolerance = body.totalCost * 0.05;
    expect(Math.abs(agentCostSum - body.totalCost)).toBeLessThanOrEqual(tolerance);

    // AC6: Cost estimation methodology footnote visible
    expect(body.costMethodologyNote).toBeDefined();
    expect(typeof body.costMethodologyNote).toBe('string');
    expect(body.costMethodologyNote.length).toBeGreaterThan(0);

    // Verify MCP server cost breakdown exists
    expect(body.costByMcpServer).toBeDefined();
    expect(body.costByMcpServer.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 404 for non-existent session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/non-existent/costs',
    });

    expect(response.statusCode).toBe(404);
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
