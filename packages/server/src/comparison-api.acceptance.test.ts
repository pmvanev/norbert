/**
 * Acceptance test for GET /api/sessions/compare -- session comparison.
 *
 * Story: US-007
 * Step: 05-01
 *
 * Tests the session comparison endpoint which computes side-by-side metrics:
 *   - Deltas for tokens, cost, agents, errors, duration
 *   - Change percentages computed and displayed
 *   - New/removed agents labeled appropriately
 *   - Projected monthly savings from cost delta
 *   - Helpful message when fewer than 2 sessions exist
 *
 * Uses Fastify inject (no real HTTP) with in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

describe('GET /api/sessions/compare', () => {
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

  it('returns side-by-side comparison with deltas, change percents, agent comparisons, and monthly savings', async () => {
    const previousSessionId = 'session-prev';
    const currentSessionId = 'session-curr';

    // -- Previous session: subagents beta + delta, higher cost
    await postEvent(app, {
      event_type: 'SessionStart',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:00.000Z',
      model: 'claude-sonnet-4',
    });
    // Root agent tool use (not a subagent, so not in agent_spans)
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:01.000Z',
      tool_name: 'read_file',
      tool_input: { path: '/tmp/a.ts' },
      agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:02.000Z',
      tool_name: 'read_file',
      tool_output: { content: 'root content' },
      input_tokens: 2000,
      output_tokens: 1000,
    });
    // Subagent beta (will be "removed" in current session)
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:03.000Z',
      agent_id: 'agent-beta',
      parent_agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:04.000Z',
      tool_name: 'Bash',
      tool_input: { command: 'echo hi' },
      agent_id: 'agent-beta',
    });
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:05.000Z',
      tool_name: 'Bash',
      tool_output: { result: 'hi' },
      input_tokens: 1500,
      output_tokens: 700,
    });
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:06.000Z',
      agent_id: 'agent-beta',
    });
    // Subagent delta (shared, will be "unchanged" in both sessions)
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:07.000Z',
      agent_id: 'agent-delta',
      parent_agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:08.000Z',
      tool_name: 'Bash',
      tool_input: { command: 'echo shared' },
      agent_id: 'agent-delta',
    });
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:09.000Z',
      tool_name: 'Bash',
      tool_output: { result: 'shared' },
      input_tokens: 800,
      output_tokens: 400,
    });
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:10.000Z',
      agent_id: 'agent-delta',
    });
    await postEvent(app, {
      event_type: 'Stop',
      session_id: previousSessionId,
      timestamp: '2026-03-01T10:00:15.000Z',
    });

    // -- Current session: subagents gamma + delta, lower cost
    await postEvent(app, {
      event_type: 'SessionStart',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:00.000Z',
      model: 'claude-sonnet-4',
    });
    // Root agent tool use
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:01.000Z',
      tool_name: 'read_file',
      tool_input: { path: '/tmp/b.ts' },
      agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:02.000Z',
      tool_name: 'read_file',
      tool_output: { content: 'root content v2' },
      input_tokens: 500,
      output_tokens: 200,
    });
    // Subagent gamma (new, not in previous session)
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:03.000Z',
      agent_id: 'agent-gamma',
      parent_agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:04.000Z',
      tool_name: 'Bash',
      tool_input: { command: 'echo bye' },
      agent_id: 'agent-gamma',
    });
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:05.000Z',
      tool_name: 'Bash',
      tool_output: { result: 'bye' },
      input_tokens: 300,
      output_tokens: 150,
    });
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:06.000Z',
      agent_id: 'agent-gamma',
    });
    // Subagent delta (shared, present in both sessions)
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:07.000Z',
      agent_id: 'agent-delta',
      parent_agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'PreToolUse',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:08.000Z',
      tool_name: 'Bash',
      tool_input: { command: 'echo shared2' },
      agent_id: 'agent-delta',
    });
    await postEvent(app, {
      event_type: 'PostToolUse',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:09.000Z',
      tool_name: 'Bash',
      tool_output: { result: 'shared2' },
      input_tokens: 400,
      output_tokens: 200,
    });
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:10.000Z',
      agent_id: 'agent-delta',
    });
    await postEvent(app, {
      event_type: 'Stop',
      session_id: currentSessionId,
      timestamp: '2026-03-02T10:00:12.000Z',
    });

    // Request comparison
    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/compare?current=${currentSessionId}&previous=${previousSessionId}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // AC1: Side-by-side metrics -- both sessions present
    expect(body.previousSession).toBeDefined();
    expect(body.currentSession).toBeDefined();
    expect(body.previousSession.id).toBe(previousSessionId);
    expect(body.currentSession.id).toBe(currentSessionId);

    // AC1: Deltas for tokens, cost, agents, errors
    expect(body.deltas).toBeDefined();
    expect(typeof body.deltas.tokensDelta).toBe('number');
    expect(typeof body.deltas.costDelta).toBe('number');
    expect(typeof body.deltas.agentCountDelta).toBe('number');
    expect(typeof body.deltas.errorCountDelta).toBe('number');

    // Current session has fewer tokens than previous => negative delta
    expect(body.deltas.tokensDelta).toBeLessThan(0);
    // Current session has lower cost => negative delta
    expect(body.deltas.costDelta).toBeLessThan(0);

    // AC2: Change percentages computed
    expect(body.changePercents).toBeDefined();
    expect(typeof body.changePercents.tokens).toBe('number');
    expect(typeof body.changePercents.cost).toBe('number');
    expect(typeof body.changePercents.agents).toBe('number');
    expect(typeof body.changePercents.errors).toBe('number');
    expect(typeof body.changePercents.duration).toBe('number');

    // AC3: Agent comparisons with new/removed/unchanged labels
    // 3 subagents total: beta (removed), gamma (new), delta (unchanged)
    expect(body.agentComparisons).toBeDefined();
    expect(Array.isArray(body.agentComparisons)).toBe(true);
    expect(body.agentComparisons.length).toBeGreaterThanOrEqual(3);

    // agent-delta should be unchanged (present in both sessions)
    const deltaComparison = body.agentComparisons.find(
      (a: { agentId: string }) => a.agentId === 'agent-delta'
    );
    expect(deltaComparison).toBeDefined();
    expect(deltaComparison.status).toBe('unchanged');

    // agent-beta should be removed (only in previous)
    const betaComparison = body.agentComparisons.find(
      (a: { agentId: string }) => a.agentId === 'agent-beta'
    );
    expect(betaComparison).toBeDefined();
    expect(betaComparison.status).toBe('removed');
    expect(betaComparison.currentCost).toBe(0);

    // agent-gamma should be new (only in current)
    const gammaComparison = body.agentComparisons.find(
      (a: { agentId: string }) => a.agentId === 'agent-gamma'
    );
    expect(gammaComparison).toBeDefined();
    expect(gammaComparison.status).toBe('new');
    expect(gammaComparison.previousCost).toBe(0);

    // AC4: Projected monthly savings
    expect(typeof body.projectedMonthlySavings).toBe('number');
    // Cost went down, so savings should be positive
    expect(body.projectedMonthlySavings).toBeGreaterThan(0);
  });

  it('returns 404 when either session does not exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/compare?current=nonexistent-a&previous=nonexistent-b',
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 400 when query parameters are missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/compare',
    });

    expect(response.statusCode).toBe(400);
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
