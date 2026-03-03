/**
 * Tests for GET /api/sessions route.
 *
 * Verifies the sessions endpoint returns session summaries.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from '../app.js';

describe('GET /api/sessions', () => {
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

  it('returns empty array when no sessions exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.sessions).toEqual([]);
  });

  it('returns session with event count after events are posted', async () => {
    // Seed a session
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'session-sess-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'PreToolUse',
        session_id: 'session-sess-1',
        timestamp: '2026-03-03T10:00:01.000Z',
        tool_name: 'Read',
        tool_input: {},
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions',
    });

    const body = JSON.parse(response.payload);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].id).toBe('session-sess-1');
    expect(body.sessions[0].eventCount).toBe(2);
    expect(body.sessions[0].status).toBe('active');
  });
});
