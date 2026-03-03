/**
 * Tests for GET /api/overview route.
 *
 * Verifies the overview endpoint returns:
 *   - summary cards with aggregate data
 *   - recent sessions sorted by start time descending
 *   - MCP health entries
 *   - empty state when no data exists
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from '../app.js';

describe('GET /api/overview', () => {
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

  it('returns 200 with empty summary when no data exists', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/overview',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.summary.sessionCount).toBe(0);
    expect(body.summary.totalTokens).toBe(0);
    expect(body.summary.estimatedCost).toBe(0);
    expect(body.summary.mcpServerCount).toBe(0);
    expect(body.recentSessions).toEqual([]);
    expect(body.mcpHealth).toEqual([]);
  });

  it('returns summary with aggregated token and cost totals across all sessions', async () => {
    // Seed session with known token counts
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'ov-unit-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'PostToolUse',
        session_id: 'ov-unit-1',
        timestamp: '2026-03-03T10:00:01.000Z',
        tool_name: 'Read',
        tool_output: {},
        input_tokens: 3000,
        output_tokens: 1500,
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/overview',
    });

    const body = JSON.parse(response.payload);

    expect(body.summary.sessionCount).toBe(1);
    expect(body.summary.totalTokens).toBe(4500); // 3000 + 1500
    expect(body.summary.estimatedCost).toBeGreaterThan(0);
  });

  it('returns recent sessions sorted by start time descending', async () => {
    // Create sessions in order
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'ov-sort-a',
        timestamp: '2026-03-03T08:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'ov-sort-b',
        timestamp: '2026-03-03T09:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/overview',
    });

    const body = JSON.parse(response.payload);

    expect(body.recentSessions).toHaveLength(2);
    // Most recent first
    expect(body.recentSessions[0].id).toBe('ov-sort-b');
    expect(body.recentSessions[1].id).toBe('ov-sort-a');
  });
});
