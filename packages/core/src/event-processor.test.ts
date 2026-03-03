/**
 * Unit tests for event processor -- pure function: raw JSON -> HookEvent | ValidationError.
 *
 * Property-based: valid raw events always produce valid HookEvents.
 * Example-based: specific invalid inputs produce specific errors.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { processRawEvent } from './event-processor.js';
import type { EventType } from './hook-events.js';

// ---------------------------------------------------------------------------
// Generators for raw event payloads (JSON-like objects)
// ---------------------------------------------------------------------------

const eventTypeArb = fc.constantFrom(
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'SubagentStart',
  'SubagentStop',
  'Stop',
);

const validRawSessionStartArb = fc.record({
  event_type: fc.constant('SessionStart'),
  session_id: fc.string({ minLength: 1, maxLength: 50 }),
  timestamp: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
    .map((ms) => new Date(ms).toISOString()),
  model: fc.constantFrom('claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3.5'),
});

const validRawPreToolUseArb = fc.record({
  event_type: fc.constant('PreToolUse'),
  session_id: fc.string({ minLength: 1, maxLength: 50 }),
  timestamp: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
    .map((ms) => new Date(ms).toISOString()),
  tool_name: fc.constantFrom('Read', 'Write', 'Bash', 'Glob'),
  tool_input: fc.dictionary(fc.string(), fc.string()),
});

const validRawStopArb = fc.record({
  event_type: fc.constant('Stop'),
  session_id: fc.string({ minLength: 1, maxLength: 50 }),
  timestamp: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
    .map((ms) => new Date(ms).toISOString()),
});

const validRawEventArb = fc.oneof(
  validRawSessionStartArb,
  validRawPreToolUseArb,
  validRawStopArb,
);

// ---------------------------------------------------------------------------
// Property: valid raw events always produce valid HookEvents
// ---------------------------------------------------------------------------

describe('Event processor', () => {
  it('converts valid raw events to HookEvents', () => {
    fc.assert(
      fc.property(validRawEventArb, (raw) => {
        const result = processRawEvent(raw);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.event.eventType).toBe(raw.event_type);
          expect(result.event.sessionId).toBe(raw.session_id);
          expect(result.event.timestamp).toBe(raw.timestamp);
        }
      }),
      { numRuns: 100 }
    );
  });

  // ---------------------------------------------------------------------------
  // Example: missing required fields
  // ---------------------------------------------------------------------------

  it('rejects payload missing event_type', () => {
    const result = processRawEvent({
      session_id: 'session-1',
      timestamp: '2026-03-03T10:00:00Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('event_type');
    }
  });

  it('rejects payload missing session_id', () => {
    const result = processRawEvent({
      event_type: 'SessionStart',
      timestamp: '2026-03-03T10:00:00Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('session_id');
    }
  });

  it('rejects payload missing timestamp', () => {
    const result = processRawEvent({
      event_type: 'SessionStart',
      session_id: 'session-1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('timestamp');
    }
  });

  it('rejects unknown event types', () => {
    const result = processRawEvent({
      event_type: 'UnknownType',
      session_id: 'session-1',
      timestamp: '2026-03-03T10:00:00Z',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('event_type');
    }
  });

  it('maps snake_case raw fields to camelCase domain fields', () => {
    const result = processRawEvent({
      event_type: 'PreToolUse',
      session_id: 'session-1',
      timestamp: '2026-03-03T10:00:00Z',
      tool_name: 'Read',
      tool_input: { file_path: '/tmp/test.ts' },
      mcp_server: 'filesystem',
      agent_id: 'agent-1',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const event = result.event;
      expect(event.eventType).toBe('PreToolUse');
      if (event.eventType === 'PreToolUse') {
        expect(event.toolName).toBe('Read');
        expect(event.mcpServer).toBe('filesystem');
        expect(event.agentId).toBe('agent-1');
      }
    }
  });

  it('maps PostToolUse with token counts', () => {
    const result = processRawEvent({
      event_type: 'PostToolUse',
      session_id: 'session-1',
      timestamp: '2026-03-03T10:00:00Z',
      tool_name: 'Read',
      tool_output: { content: 'hello' },
      input_tokens: 100,
      output_tokens: 50,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.event.eventType === 'PostToolUse') {
      expect(result.event.inputTokens).toBe(100);
      expect(result.event.outputTokens).toBe(50);
    }
  });

  it('maps SubagentStart with agent IDs', () => {
    const result = processRawEvent({
      event_type: 'SubagentStart',
      session_id: 'session-1',
      timestamp: '2026-03-03T10:00:00Z',
      agent_id: 'agent-2',
      parent_agent_id: 'agent-1',
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.event.eventType === 'SubagentStart') {
      expect(result.event.agentId).toBe('agent-2');
      expect(result.event.parentAgentId).toBe('agent-1');
    }
  });
});
