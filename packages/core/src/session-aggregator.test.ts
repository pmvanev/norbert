/**
 * Unit tests for session aggregator -- pure function: event + current session -> session update.
 *
 * Property-based: token accumulation is monotonically increasing.
 * Example-based: each event type produces the correct session update delta.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeSessionUpdate } from './session-aggregator.js';
import type { SessionUpdate } from './session-aggregator.js';
import type {
  SessionStartEvent,
  PostToolUseEvent,
  PostToolUseFailureEvent,
  SubagentStartEvent,
  SubagentStopEvent,
  StopEvent,
  PreToolUseEvent,
  HookEvent,
} from './hook-events.js';
import type { Session } from './session.js';

// ---------------------------------------------------------------------------
// Helper: create a minimal active session for testing
// ---------------------------------------------------------------------------

const activeSession = (overrides: Partial<Session> = {}): Session => ({
  id: 'session-1',
  startTime: '2026-03-03T10:00:00.000Z',
  endTime: undefined,
  model: 'claude-sonnet-4',
  agentCount: 0,
  eventCount: 2,
  totalInputTokens: 100,
  totalOutputTokens: 50,
  estimatedCost: 0.001,
  mcpErrorCount: 0,
  status: 'active',
  ...overrides,
});

describe('computeSessionUpdate', () => {
  // -----------------------------------------------------------------------
  // SessionStart
  // -----------------------------------------------------------------------
  it('creates a new session on SessionStart', () => {
    const event: SessionStartEvent = {
      eventType: 'SessionStart',
      sessionId: 'session-new',
      timestamp: '2026-03-03T10:00:00.000Z',
      model: 'claude-sonnet-4',
    };

    const update = computeSessionUpdate(event, null);
    expect(update.type).toBe('create');
    if (update.type === 'create') {
      expect(update.session.id).toBe('session-new');
      expect(update.session.model).toBe('claude-sonnet-4');
      expect(update.session.status).toBe('active');
      expect(update.session.eventCount).toBe(1);
    }
  });

  // -----------------------------------------------------------------------
  // PostToolUse with tokens
  // -----------------------------------------------------------------------
  it('increments token counts and cost on PostToolUse', () => {
    const event: PostToolUseEvent = {
      eventType: 'PostToolUse',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:02.000Z',
      toolName: 'Read',
      toolOutput: {},
      inputTokens: 500,
      outputTokens: 200,
    };

    const update = computeSessionUpdate(event, activeSession());
    expect(update.type).toBe('increment');
    if (update.type === 'increment') {
      expect(update.delta.inputTokensDelta).toBe(500);
      expect(update.delta.outputTokensDelta).toBe(200);
      expect(update.delta.eventCountDelta).toBe(1);
      expect(update.delta.costDelta).toBeGreaterThan(0);
    }
  });

  // -----------------------------------------------------------------------
  // PostToolUseFailure with MCP server
  // -----------------------------------------------------------------------
  it('increments mcp_error_count on PostToolUseFailure with mcpServer', () => {
    const event: PostToolUseFailureEvent = {
      eventType: 'PostToolUseFailure',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:03.000Z',
      toolName: 'read_file',
      error: { message: 'file not found' },
      mcpServer: 'filesystem',
    };

    const update = computeSessionUpdate(event, activeSession());
    expect(update.type).toBe('increment');
    if (update.type === 'increment') {
      expect(update.delta.mcpErrorCountDelta).toBe(1);
      expect(update.delta.eventCountDelta).toBe(1);
    }
  });

  it('does not increment mcp_error_count for built-in tool failures', () => {
    const event: PostToolUseFailureEvent = {
      eventType: 'PostToolUseFailure',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:03.000Z',
      toolName: 'Bash',
      error: { message: 'command failed' },
    };

    const update = computeSessionUpdate(event, activeSession());
    expect(update.type).toBe('increment');
    if (update.type === 'increment') {
      expect(update.delta.mcpErrorCountDelta).toBe(0);
    }
  });

  // -----------------------------------------------------------------------
  // SubagentStart
  // -----------------------------------------------------------------------
  it('increments agent_count on SubagentStart', () => {
    const event: SubagentStartEvent = {
      eventType: 'SubagentStart',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:05.000Z',
      agentId: 'agent-child-1',
      parentAgentId: 'agent-root',
    };

    const update = computeSessionUpdate(event, activeSession());
    expect(update.type).toBe('increment');
    if (update.type === 'increment') {
      expect(update.delta.agentCountDelta).toBe(1);
      expect(update.delta.eventCountDelta).toBe(1);
    }
  });

  // -----------------------------------------------------------------------
  // Stop
  // -----------------------------------------------------------------------
  it('closes session on Stop event', () => {
    const event: StopEvent = {
      eventType: 'Stop',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:15.000Z',
    };

    const update = computeSessionUpdate(event, activeSession());
    expect(update.type).toBe('close');
    if (update.type === 'close') {
      expect(update.endTime).toBe('2026-03-03T10:00:15.000Z');
    }
  });

  // -----------------------------------------------------------------------
  // Property: token accumulation deltas are non-negative
  // -----------------------------------------------------------------------
  it('token deltas are always non-negative', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100_000 }),
        fc.nat({ max: 100_000 }),
        (inputTokens, outputTokens) => {
          const event: PostToolUseEvent = {
            eventType: 'PostToolUse',
            sessionId: 'session-1',
            timestamp: '2026-03-03T10:00:02.000Z',
            toolName: 'Read',
            toolOutput: {},
            inputTokens,
            outputTokens,
          };
          const update = computeSessionUpdate(event, activeSession());
          if (update.type === 'increment') {
            expect(update.delta.inputTokensDelta).toBeGreaterThanOrEqual(0);
            expect(update.delta.outputTokensDelta).toBeGreaterThanOrEqual(0);
            expect(update.delta.costDelta).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
