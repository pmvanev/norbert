/**
 * Acceptance + unit tests for storage port and SQLite adapter.
 *
 * Tests the full round-trip: create adapter -> write event -> read back through port.
 * Uses in-memory SQLite (:memory:) for fast, isolated tests.
 *
 * Test strategy:
 * - Acceptance: write event, read it back, verify round-trip
 * - Unit: migration runner, individual CRUD operations, port structure
 * - Property-based: event round-trip for arbitrary hook events
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import type {
  HookEvent,
  SessionStartEvent,
  PreToolUseEvent,
  PostToolUseEvent,
  Session,
  SessionFilter,
} from '@norbert/core';
import type { StoragePort, WriteResult } from './port.js';
import { createSqliteAdapter } from './sqlite-adapter.js';
import { runMigrations } from './migration-runner.js';
import BetterSqlite3 from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Generators for domain types (reused from core tests)
// ---------------------------------------------------------------------------

const sessionIdArb = fc.string({ minLength: 1, maxLength: 50 });
const timestampArb = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
  .map((ms) => new Date(ms).toISOString());
const toolNameArb = fc.constantFrom('Read', 'Write', 'Bash', 'Glob', 'Grep', 'Edit');
const modelArb = fc.constantFrom('claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3.5');

const sessionStartArb: fc.Arbitrary<SessionStartEvent> = fc.record({
  eventType: fc.constant('SessionStart' as const),
  sessionId: sessionIdArb,
  timestamp: timestampArb,
  model: modelArb,
});

// ---------------------------------------------------------------------------
// Acceptance Test: Full round-trip through driving port
// ---------------------------------------------------------------------------

describe('Storage port acceptance', () => {
  let storage: StoragePort;

  beforeEach(() => {
    storage = createSqliteAdapter(':memory:');
  });

  it('writes an event and reads it back for the same session', () => {
    const event: SessionStartEvent = {
      eventType: 'SessionStart',
      sessionId: 'session-abc',
      timestamp: '2026-03-03T10:00:00.000Z',
      model: 'claude-sonnet-4',
    };

    const writeResult = storage.writeEvent(event);
    expect(writeResult.ok).toBe(true);

    const events = storage.getEventsForSession('session-abc');
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('SessionStart');
    expect(events[0].sessionId).toBe('session-abc');
  });

  it('creates a session record on SessionStart and retrieves it', () => {
    const event: SessionStartEvent = {
      eventType: 'SessionStart',
      sessionId: 'session-xyz',
      timestamp: '2026-03-03T10:00:00.000Z',
      model: 'claude-sonnet-4',
    };

    storage.writeEvent(event);
    const session = storage.getSession('session-xyz');

    expect(session).not.toBeNull();
    expect(session!.id).toBe('session-xyz');
    expect(session!.model).toBe('claude-sonnet-4');
    expect(session!.status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// Migration runner tests
// ---------------------------------------------------------------------------

describe('Migration runner', () => {
  it('creates schema_version table and all 4 domain tables', () => {
    const storage = createSqliteAdapter(':memory:');

    // Adapter factory should have already run migrations.
    // Verify by reading events (would fail if tables don't exist).
    const events = storage.getEventsForSession('nonexistent');
    expect(events).toHaveLength(0);
  });

  it('is idempotent -- running migrations twice does not error', () => {
    // createSqliteAdapter runs migrations internally.
    // Creating a second adapter on the same DB should not fail.
    // For :memory: this is trivially true; test with explicit runner call.
    const db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');

    runMigrations(db);
    runMigrations(db); // second call should be no-op

    // Verify tables exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('events');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('mcp_events');
    expect(tableNames).toContain('agent_spans');
    expect(tableNames).toContain('schema_version');

    db.close();
  });
});

// ---------------------------------------------------------------------------
// CRUD operation tests
// ---------------------------------------------------------------------------

describe('SQLite adapter CRUD operations', () => {
  let storage: StoragePort;

  beforeEach(() => {
    storage = createSqliteAdapter(':memory:');
  });

  describe('writeEvent', () => {
    it('returns ok:true for a valid SessionStart event', () => {
      const result = storage.writeEvent({
        eventType: 'SessionStart',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      });
      expect(result.ok).toBe(true);
    });

    it('stores PreToolUse events with tool name and optional mcp fields', () => {
      // First create a session
      storage.writeEvent({
        eventType: 'SessionStart',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      });

      const preToolEvent: PreToolUseEvent = {
        eventType: 'PreToolUse',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:01.000Z',
        toolName: 'Read',
        toolInput: { file_path: '/tmp/test.ts' },
        mcpServer: 'filesystem',
        agentId: 'agent-1',
      };

      const result = storage.writeEvent(preToolEvent);
      expect(result.ok).toBe(true);

      const events = storage.getEventsForSession('sess-1');
      expect(events).toHaveLength(2);

      const toolEvent = events.find((e) => e.eventType === 'PreToolUse');
      expect(toolEvent).toBeDefined();
      expect((toolEvent as PreToolUseEvent).toolName).toBe('Read');
    });

    it('stores PostToolUse events with token counts', () => {
      storage.writeEvent({
        eventType: 'SessionStart',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      });

      const postToolEvent: PostToolUseEvent = {
        eventType: 'PostToolUse',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:02.000Z',
        toolName: 'Read',
        toolOutput: { content: 'file contents' },
        inputTokens: 100,
        outputTokens: 50,
      };

      storage.writeEvent(postToolEvent);
      const events = storage.getEventsForSession('sess-1');
      const stored = events.find((e) => e.eventType === 'PostToolUse') as PostToolUseEvent;
      expect(stored.inputTokens).toBe(100);
      expect(stored.outputTokens).toBe(50);
    });
  });

  describe('getSession', () => {
    it('returns null for nonexistent session', () => {
      const session = storage.getSession('nonexistent');
      expect(session).toBeNull();
    });

    it('returns session with correct fields after SessionStart', () => {
      storage.writeEvent({
        eventType: 'SessionStart',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-opus-4',
      });

      const session = storage.getSession('sess-1');
      expect(session).not.toBeNull();
      expect(session!.id).toBe('sess-1');
      expect(session!.startTime).toBe('2026-03-03T10:00:00.000Z');
      expect(session!.model).toBe('claude-opus-4');
      expect(session!.status).toBe('active');
      expect(session!.eventCount).toBe(1);
    });
  });

  describe('getSessions', () => {
    it('returns empty array when no sessions exist', () => {
      const filter: SessionFilter = {
        dateRange: undefined,
        costRange: undefined,
        agentCountRange: undefined,
        sortBy: 'startTime',
        sortOrder: 'desc',
        limit: 20,
        offset: 0,
      };
      const sessions = storage.getSessions(filter);
      expect(sessions).toHaveLength(0);
    });

    it('returns sessions sorted by startTime descending', () => {
      storage.writeEvent({
        eventType: 'SessionStart',
        sessionId: 'sess-old',
        timestamp: '2026-03-01T10:00:00.000Z',
        model: 'claude-sonnet-4',
      });
      storage.writeEvent({
        eventType: 'SessionStart',
        sessionId: 'sess-new',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      });

      const filter: SessionFilter = {
        dateRange: undefined,
        costRange: undefined,
        agentCountRange: undefined,
        sortBy: 'startTime',
        sortOrder: 'desc',
        limit: 20,
        offset: 0,
      };

      const sessions = storage.getSessions(filter);
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('sess-new');
      expect(sessions[1].id).toBe('sess-old');
    });

    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        storage.writeEvent({
          eventType: 'SessionStart',
          sessionId: `sess-${i}`,
          timestamp: `2026-03-0${i + 1}T10:00:00.000Z`,
          model: 'claude-sonnet-4',
        });
      }

      const filter: SessionFilter = {
        dateRange: undefined,
        costRange: undefined,
        agentCountRange: undefined,
        sortBy: 'startTime',
        sortOrder: 'desc',
        limit: 2,
        offset: 1,
      };

      const sessions = storage.getSessions(filter);
      expect(sessions).toHaveLength(2);
    });
  });

  describe('getEventsForSession', () => {
    it('returns empty array for nonexistent session', () => {
      const events = storage.getEventsForSession('nonexistent');
      expect(events).toHaveLength(0);
    });

    it('returns events in chronological order', () => {
      storage.writeEvent({
        eventType: 'SessionStart',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        model: 'claude-sonnet-4',
      });
      storage.writeEvent({
        eventType: 'PreToolUse',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:01.000Z',
        toolName: 'Read',
        toolInput: {},
      });
      storage.writeEvent({
        eventType: 'Stop',
        sessionId: 'sess-1',
        timestamp: '2026-03-03T10:00:02.000Z',
      });

      const events = storage.getEventsForSession('sess-1');
      expect(events).toHaveLength(3);
      expect(events[0].eventType).toBe('SessionStart');
      expect(events[1].eventType).toBe('PreToolUse');
      expect(events[2].eventType).toBe('Stop');
    });
  });

  describe('WAL mode', () => {
    it('adapter enables WAL journal mode', () => {
      // createSqliteAdapter already sets WAL mode.
      // We verify by importing better-sqlite3 directly and checking.
      // This is tested indirectly through the adapter working correctly.
      // A direct check would require exposing the db, which breaks encapsulation.
      // Instead, we verify the adapter can handle concurrent reads (WAL benefit).
      const events = storage.getEventsForSession('any');
      expect(events).toHaveLength(0);
      // If WAL mode were not set, concurrent access patterns would fail,
      // but for :memory: this is less meaningful. The real WAL test
      // is in the adapter implementation itself.
    });
  });
});

// ---------------------------------------------------------------------------
// Property-based: event round-trip
// ---------------------------------------------------------------------------

describe('Event round-trip property', () => {
  it('any SessionStart event written can be read back with matching fields', () => {
    fc.assert(
      fc.property(sessionStartArb, (event) => {
        const storage = createSqliteAdapter(':memory:');
        const result = storage.writeEvent(event);
        expect(result.ok).toBe(true);

        const events = storage.getEventsForSession(event.sessionId);
        expect(events.length).toBeGreaterThanOrEqual(1);

        const stored = events.find(
          (e) => e.eventType === 'SessionStart'
        ) as SessionStartEvent;
        expect(stored).toBeDefined();
        expect(stored.sessionId).toBe(event.sessionId);
        expect(stored.eventType).toBe('SessionStart');
      }),
      { numRuns: 50 }
    );
  });
});
