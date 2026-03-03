/**
 * Unit tests for agent tree builder -- pure function: event -> agent span update.
 *
 * Example-based: SubagentStart creates spans; SubagentStop closes them.
 */

import { describe, it, expect } from 'vitest';
import { computeAgentSpanUpdate } from './agent-tree.js';
import type { AgentSpanUpdate } from './agent-tree.js';
import type {
  SubagentStartEvent,
  SubagentStopEvent,
  PostToolUseEvent,
} from './hook-events.js';

describe('computeAgentSpanUpdate', () => {
  it('creates an agent span on SubagentStart', () => {
    const event: SubagentStartEvent = {
      eventType: 'SubagentStart',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:05.000Z',
      agentId: 'agent-child-1',
      parentAgentId: 'agent-root',
    };

    const update = computeAgentSpanUpdate(event);
    expect(update).not.toBeNull();
    expect(update!.type).toBe('create');
    if (update!.type === 'create') {
      expect(update!.span.agentId).toBe('agent-child-1');
      expect(update!.span.parentAgentId).toBe('agent-root');
      expect(update!.span.sessionId).toBe('session-1');
      expect(update!.span.startTime).toBe('2026-03-03T10:00:05.000Z');
      expect(update!.span.status).toBe('active');
    }
  });

  it('closes an agent span on SubagentStop', () => {
    const event: SubagentStopEvent = {
      eventType: 'SubagentStop',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:10.000Z',
      agentId: 'agent-child-1',
    };

    const update = computeAgentSpanUpdate(event);
    expect(update).not.toBeNull();
    expect(update!.type).toBe('close');
    if (update!.type === 'close') {
      expect(update!.agentId).toBe('agent-child-1');
      expect(update!.sessionId).toBe('session-1');
      expect(update!.endTime).toBe('2026-03-03T10:00:10.000Z');
    }
  });

  it('returns null for non-subagent events', () => {
    const event: PostToolUseEvent = {
      eventType: 'PostToolUse',
      sessionId: 'session-1',
      timestamp: '2026-03-03T10:00:02.000Z',
      toolName: 'Read',
      toolOutput: {},
    };

    const update = computeAgentSpanUpdate(event);
    expect(update).toBeNull();
  });
});
