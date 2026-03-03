/**
 * Acceptance tests for dashboard API and WebSocket.
 *
 * Tests the full flow:
 *   GET /api/events -> returns stored events with timestamp, tool name, status
 *   GET /api/sessions -> returns sessions
 *   WebSocket -> broadcasts new events on POST /api/events
 *
 * Uses Fastify inject (no real HTTP) with an in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

describe('Dashboard API acceptance', () => {
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

  it('GET /api/events returns captured events with timestamp, tool name, and event type', async () => {
    // Seed two events: a SessionStart and a PreToolUse
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'session-dash-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'PreToolUse',
        session_id: 'session-dash-1',
        timestamp: '2026-03-03T10:00:01.000Z',
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/test.ts' },
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/events?limit=10',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.events).toHaveLength(2);

    // Each event has the fields the dashboard needs
    const event = body.events[1]; // PreToolUse
    expect(event.timestamp).toBe('2026-03-03T10:00:01.000Z');
    expect(event.toolName).toBe('Read');
    expect(event.eventType).toBe('PreToolUse');
  });

  it('GET /api/sessions returns session summaries', async () => {
    // Seed a session with events
    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'SessionStart',
        session_id: 'session-dash-2',
        timestamp: '2026-03-03T11:00:00.000Z',
        model: 'claude-sonnet-4',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].id).toBe('session-dash-2');
    expect(body.sessions[0].status).toBe('active');
  });
});

describe('WebSocket broadcast acceptance', () => {
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

  it('notifies WebSocket clients when new event is posted', async () => {
    // Use the broadcast collector from the app to verify
    // that posting an event triggers a broadcast
    const broadcastMessages = app.broadcastCollector;

    await app.inject({
      method: 'POST',
      url: '/api/events',
      payload: {
        event_type: 'PreToolUse',
        session_id: 'session-ws-1',
        timestamp: '2026-03-03T12:00:00.000Z',
        tool_name: 'Bash',
        tool_input: { command: 'ls' },
      },
    });

    expect(broadcastMessages).toBeDefined();
    expect(broadcastMessages.length).toBeGreaterThanOrEqual(1);

    const message = JSON.parse(broadcastMessages[0]);
    expect(message.type).toBe('new_event');
    expect(message.event.eventType).toBe('PreToolUse');
    expect(message.event.toolName).toBe('Bash');
  });
});
