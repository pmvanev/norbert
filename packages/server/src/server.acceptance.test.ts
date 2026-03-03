/**
 * Acceptance tests for event ingress server.
 *
 * Tests the full flow:
 *   POST /api/events -> validate -> process -> persist via StoragePort
 *   GET /health -> { status: "ok" }
 *
 * Uses Fastify inject (no real HTTP) with an in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

describe('Event ingress server acceptance', () => {
  let storage: StoragePort;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    storage = createSqliteAdapter(':memory:');
    app = createApp({ port: 7777 }, storage);
  });

  afterEach(() => {
    storage.close();
  });

  it('accepts POST /api/events and persists valid events', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'session-abc',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    expect(response.statusCode).toBe(201);

    const events = storage.getEventsForSession('session-abc');
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('SessionStart');
    expect(events[0].sessionId).toBe('session-abc');
  });

  it('rejects malformed events with 400 status', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        // Missing required fields: event_type, session_id, timestamp
        not_an_event: true,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('responds at GET /health with status ok', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe('ok');
  });
});
