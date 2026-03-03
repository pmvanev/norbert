/**
 * Acceptance test for GET /api/sessions/history and GET /api/sessions/export.
 *
 * Story: US-008
 * Step: 05-02
 *
 * Tests the session history endpoint with:
 *   - Filterable by date range, cost range, agent count
 *   - Weekly cost trend with daily granularity
 *   - Baselines: average cost, P95 cost, average duration
 *   - Sortable by cost, date, duration, agent count
 *   - Insufficient data shows preliminary baselines with confidence note
 *
 * Tests the CSV export endpoint with:
 *   - Valid CSV with headers: date, sessions, tokens, cost
 *   - Content-Type: text/csv
 *   - Content-Disposition header for download
 *
 * Uses Fastify inject (no real HTTP) with in-memory SQLite storage port.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { StoragePort } from '@norbert/storage';
import { createSqliteAdapter } from '@norbert/storage';
import { createApp } from './app.js';

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

/**
 * Seed a complete session with SessionStart, a PostToolUse for tokens, and Stop.
 */
async function seedSession(
  app: ReturnType<typeof createApp>,
  options: {
    readonly sessionId: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly model: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly agentCount?: number;
  }
): Promise<void> {
  await postEvent(app, {
    event_type: 'SessionStart',
    session_id: options.sessionId,
    timestamp: options.startTime,
    model: options.model,
  });

  await postEvent(app, {
    event_type: 'PreToolUse',
    session_id: options.sessionId,
    timestamp: options.startTime,
    tool_name: 'Read',
    tool_input: { file_path: '/tmp/test.ts' },
  });

  await postEvent(app, {
    event_type: 'PostToolUse',
    session_id: options.sessionId,
    timestamp: options.startTime,
    tool_name: 'Read',
    tool_output: { content: 'test' },
    input_tokens: options.inputTokens,
    output_tokens: options.outputTokens,
  });

  // Add subagents if requested
  const subagentCount = (options.agentCount ?? 1) - 1;
  for (let i = 0; i < subagentCount; i++) {
    await postEvent(app, {
      event_type: 'SubagentStart',
      session_id: options.sessionId,
      timestamp: options.startTime,
      agent_id: `sub-${options.sessionId}-${i}`,
      parent_agent_id: 'agent-root',
    });
    await postEvent(app, {
      event_type: 'SubagentStop',
      session_id: options.sessionId,
      timestamp: options.endTime,
      agent_id: `sub-${options.sessionId}-${i}`,
    });
  }

  await postEvent(app, {
    event_type: 'Stop',
    session_id: options.sessionId,
    timestamp: options.endTime,
  });
}

// ---------------------------------------------------------------------------
// GET /api/sessions/history
// ---------------------------------------------------------------------------

describe('GET /api/sessions/history', () => {
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

  it('returns session list with daily trends, baselines, and confidence note for insufficient data', async () => {
    // Seed 3 sessions (fewer than 10 => insufficient data)
    await seedSession(app, {
      sessionId: 'hist-1',
      startTime: '2026-03-01T10:00:00.000Z',
      endTime: '2026-03-01T10:30:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 1000,
      outputTokens: 500,
    });

    await seedSession(app, {
      sessionId: 'hist-2',
      startTime: '2026-03-01T14:00:00.000Z',
      endTime: '2026-03-01T14:45:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 2000,
      outputTokens: 800,
    });

    await seedSession(app, {
      sessionId: 'hist-3',
      startTime: '2026-03-02T09:00:00.000Z',
      endTime: '2026-03-02T09:20:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 500,
      outputTokens: 200,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/history',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // AC1: Sessions list returned
    expect(body.sessions).toBeDefined();
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(body.sessions.length).toBe(3);

    // AC2: Daily trends with daily granularity
    expect(body.trends).toBeDefined();
    expect(Array.isArray(body.trends)).toBe(true);
    // Two distinct dates: 2026-03-01 and 2026-03-02
    expect(body.trends.length).toBe(2);
    expect(body.trends[0].date).toBeDefined();
    expect(typeof body.trends[0].sessionCount).toBe('number');
    expect(typeof body.trends[0].totalTokens).toBe('number');
    expect(typeof body.trends[0].totalCost).toBe('number');

    // AC3: Baselines computed
    expect(body.baselines).toBeDefined();
    expect(typeof body.baselines.averageCost).toBe('number');
    expect(typeof body.baselines.p95Cost).toBe('number');
    expect(typeof body.baselines.averageDuration).toBe('number');
    expect(typeof body.baselines.sampleSize).toBe('number');
    expect(body.baselines.sampleSize).toBe(3);

    // AC5: Insufficient data (< 10 sessions) shows confidence note
    expect(body.baselines.isConfident).toBe(false);
    expect(typeof body.baselines.confidenceNote).toBe('string');
    expect(body.baselines.confidenceNote.length).toBeGreaterThan(0);
  });

  it('returns filtered sessions by date range', async () => {
    await seedSession(app, {
      sessionId: 'filt-1',
      startTime: '2026-03-01T10:00:00.000Z',
      endTime: '2026-03-01T10:30:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 1000,
      outputTokens: 500,
    });

    await seedSession(app, {
      sessionId: 'filt-2',
      startTime: '2026-03-05T10:00:00.000Z',
      endTime: '2026-03-05T10:30:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 2000,
      outputTokens: 800,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/history?dateStart=2026-03-04&dateEnd=2026-03-06',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    // Only the session from March 5 should be returned
    expect(body.sessions.length).toBe(1);
    expect(body.sessions[0].id).toBe('filt-2');
  });

  it('returns sessions sorted by estimatedCost ascending', async () => {
    await seedSession(app, {
      sessionId: 'sort-cheap',
      startTime: '2026-03-01T10:00:00.000Z',
      endTime: '2026-03-01T10:30:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 100,
      outputTokens: 50,
    });

    await seedSession(app, {
      sessionId: 'sort-expensive',
      startTime: '2026-03-01T11:00:00.000Z',
      endTime: '2026-03-01T11:30:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 5000,
      outputTokens: 3000,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/history?sortBy=estimatedCost&sortOrder=asc',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);

    expect(body.sessions.length).toBe(2);
    expect(body.sessions[0].estimatedCost).toBeLessThanOrEqual(body.sessions[1].estimatedCost);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sessions/export
// ---------------------------------------------------------------------------

describe('GET /api/sessions/export', () => {
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

  it('returns valid CSV with headers and Content-Type text/csv', async () => {
    await seedSession(app, {
      sessionId: 'csv-1',
      startTime: '2026-03-01T10:00:00.000Z',
      endTime: '2026-03-01T10:30:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 1000,
      outputTokens: 500,
    });

    await seedSession(app, {
      sessionId: 'csv-2',
      startTime: '2026-03-02T09:00:00.000Z',
      endTime: '2026-03-02T09:20:00.000Z',
      model: 'claude-sonnet-4',
      inputTokens: 2000,
      outputTokens: 800,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/export?format=csv',
    });

    expect(response.statusCode).toBe(200);

    // AC4: Content-Type is text/csv
    expect(response.headers['content-type']).toContain('text/csv');

    // Content-Disposition for download
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('.csv');

    // AC4: CSV contains headers: date, sessions, tokens, cost
    const csv = response.payload;
    const lines = csv.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(2); // header + at least 1 data row

    const header = lines[0];
    expect(header).toContain('date');
    expect(header).toContain('sessions');
    expect(header).toContain('tokens');
    expect(header).toContain('cost');
  });
});
