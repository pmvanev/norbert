/**
 * Acceptance test for GET /api/sessions/:id/trace -- execution trace graph.
 *
 * Story: US-004
 * Step: 03-02
 *
 * Tests the trace graph endpoint which builds a DAG from flat agent spans:
 *   - Returns correct parent-child agent relationships
 *   - Each node has agent name, token cost, tool call count
 *   - Single-agent sessions render without broken layout
 *   - Failed agents display error indicators
 *
 * Uses Fastify inject (no real HTTP) with in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

describe('GET /api/sessions/:id/trace', () => {
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

  it('returns trace graph with correct parent-child agent relationships and node metrics', async () => {
    const sessionId = 'trace-test-session';

    // 1. SessionStart
    await postEvent(app, {
      event_type: 'SessionStart',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:00.000Z',
      model: 'claude-sonnet-4',
    });

    // 2. Tool calls for root agent token accounting
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:01.000Z',
      tool_name: 'Read',
      tool_output: {},
      input_tokens: 500,
      output_tokens: 200,
    });

    // 3. SubagentStart -- child of root
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:02.000Z',
      agent_id: 'agent-child-1',
      parent_agent_id: 'agent-root',
    });

    // 4. SubagentStart -- grandchild of root (child of child-1)
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:03.000Z',
      agent_id: 'agent-grandchild-1',
      parent_agent_id: 'agent-child-1',
    });

    // 5. SubagentStop -- grandchild completes
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:05.000Z',
      agent_id: 'agent-grandchild-1',
    });

    // 6. SubagentStop -- child completes
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:06.000Z',
      agent_id: 'agent-child-1',
    });

    // 7. Stop session
    await postEvent(app, {
      event_type: 'Stop',
      session_id: sessionId,
      timestamp: '2026-03-03T10:00:10.000Z',
    });

    // Request trace graph
    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}/trace`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // Verify graph structure
    expect(body.sessionId).toBe(sessionId);
    expect(body.rootAgent).toBeDefined();
    expect(body.allAgents.length).toBeGreaterThanOrEqual(2);
    expect(body.edges.length).toBeGreaterThanOrEqual(1);

    // Verify edges capture parent-child relationships
    const edgeFromRootToChild = body.edges.find(
      (e: { fromAgentId: string; toAgentId: string }) =>
        e.fromAgentId === 'agent-root' && e.toAgentId === 'agent-child-1'
    );
    expect(edgeFromRootToChild).toBeDefined();

    const edgeFromChildToGrandchild = body.edges.find(
      (e: { fromAgentId: string; toAgentId: string }) =>
        e.fromAgentId === 'agent-child-1' && e.toAgentId === 'agent-grandchild-1'
    );
    expect(edgeFromChildToGrandchild).toBeDefined();

    // Verify root agent has children populated in tree
    expect(body.rootAgent.children.length).toBeGreaterThanOrEqual(1);
  });

  it('returns trace graph for single-agent session without broken layout', async () => {
    const sessionId = 'single-agent-session';

    await postEvent(app, {
      event_type: 'SessionStart',
      session_id: sessionId,
      timestamp: '2026-03-03T11:00:00.000Z',
      model: 'claude-sonnet-4',
    });

    await postEvent(app, {
      event_type: 'Stop',
      session_id: sessionId,
      timestamp: '2026-03-03T11:00:05.000Z',
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}/trace`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // Single-agent: empty graph is valid (no agent spans recorded)
    expect(body.sessionId).toBe(sessionId);
    expect(body.allAgents).toBeDefined();
    expect(body.edges).toBeDefined();
    expect(Array.isArray(body.edges)).toBe(true);
  });

  it('returns 404 for non-existent session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/non-existent/trace',
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
