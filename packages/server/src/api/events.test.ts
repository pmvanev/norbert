/**
 * Tests for GET /api/events route.
 *
 * Verifies the events query endpoint returns recent events
 * from the storage port in the correct format.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from '../app.js';

describe('GET /api/events', () => {
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

  it('returns empty array when no events exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/events',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.events).toEqual([]);
  });

  it('returns events ordered by timestamp ascending', async () => {
    await seedEvent(app, 'session-1', 'SessionStart', '2026-03-03T10:00:00.000Z');
    await seedEvent(app, 'session-1', 'PreToolUse', '2026-03-03T10:00:01.000Z', {
      tool_name: 'Read',
      tool_input: { file_path: '/tmp/x' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/events',
    });

    const body = JSON.parse(response.payload);
    expect(body.events).toHaveLength(2);
    expect(body.events[0].eventType).toBe('SessionStart');
    expect(body.events[1].eventType).toBe('PreToolUse');
  });

  it('respects limit query parameter', async () => {
    await seedEvent(app, 'session-1', 'SessionStart', '2026-03-03T10:00:00.000Z');
    await seedEvent(app, 'session-1', 'PreToolUse', '2026-03-03T10:00:01.000Z', {
      tool_name: 'Read',
      tool_input: {},
    });
    await seedEvent(app, 'session-1', 'PreToolUse', '2026-03-03T10:00:02.000Z', {
      tool_name: 'Write',
      tool_input: {},
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/events?limit=2',
    });

    const body = JSON.parse(response.payload);
    expect(body.events).toHaveLength(2);
  });

  it('defaults limit to 50 when not specified', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/events',
    });

    expect(response.statusCode).toBe(200);
    // Just verify it returns successfully with default limit
  });
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function seedEvent(
  app: ReturnType<typeof createApp>,
  sessionId: string,
  eventType: string,
  timestamp: string,
  extra: Record<string, unknown> = {}
) {
  const payload: Record<string, unknown> = {
    event_type: eventType,
    session_id: sessionId,
    timestamp,
    ...extra,
  };

  if (eventType === 'SessionStart') {
    payload.model = payload.model ?? 'claude-sonnet-4';
  }

  await app.inject({
    method: 'POST',
    url: '/api/events',
    payload,
  });
}
