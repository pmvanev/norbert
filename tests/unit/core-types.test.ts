/**
 * Unit tests for @norbert/core domain types and type guard functions.
 *
 * Tests the discriminated union for HookEvent (7 variants)
 * and verifies type guards correctly narrow types.
 *
 * Uses property-based testing via fast-check for type guard invariants.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  type HookEvent,
  type SessionStartEvent,
  type PreToolUseEvent,
  type PostToolUseEvent,
  type PostToolUseFailureEvent,
  type SubagentStartEvent,
  type SubagentStopEvent,
  type StopEvent,
  isSessionStart,
  isPreToolUse,
  isPostToolUse,
  isPostToolUseFailure,
  isSubagentStart,
  isSubagentStop,
  isStop,
  isToolEvent,
  isMcpEvent,
  type Session,
  type SessionStatus,
  type AgentNode,
  type AgentStatus,
  type TraceGraph,
  type McpServerHealth,
  type McpServerStatus,
  type CostBreakdown,
  type AgentCostEntry,
  type McpCostEntry,
  type ComparisonResult,
  type SessionDelta,
  type SessionFilter,
  type SortField,
  type SortOrder,
  type CostRate,
  COST_RATES,
  getCostRate,
} from '@norbert/core';

// ---------------------------------------------------------------------------
// Generators for domain types
// ---------------------------------------------------------------------------

const sessionIdArb = fc.string({ minLength: 1, maxLength: 50 });
const timestampArb = fc
  .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-12-31').getTime() })
  .map((ms) => new Date(ms).toISOString());
const toolNameArb = fc.constantFrom('Read', 'Write', 'Bash', 'Glob', 'Grep', 'Edit');
const mcpServerArb = fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined });
const agentIdArb = fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined });
const modelArb = fc.constantFrom('claude-opus-4', 'claude-sonnet-4', 'claude-haiku-3.5', 'unknown-model');
const tokensArb = fc.option(fc.nat({ max: 1000000 }), { nil: undefined });

const sessionStartArb: fc.Arbitrary<SessionStartEvent> = fc.record({
  eventType: fc.constant('SessionStart' as const),
  sessionId: sessionIdArb,
  timestamp: timestampArb,
  model: modelArb,
});

const preToolUseArb: fc.Arbitrary<PreToolUseEvent> = fc.record({
  eventType: fc.constant('PreToolUse' as const),
  sessionId: sessionIdArb,
  timestamp: timestampArb,
  toolName: toolNameArb,
  toolInput: fc.dictionary(fc.string(), fc.string()),
  mcpServer: mcpServerArb,
  agentId: agentIdArb,
});

const postToolUseArb: fc.Arbitrary<PostToolUseEvent> = fc.record({
  eventType: fc.constant('PostToolUse' as const),
  sessionId: sessionIdArb,
  timestamp: timestampArb,
  toolName: toolNameArb,
  toolOutput: fc.dictionary(fc.string(), fc.string()),
  inputTokens: tokensArb,
  outputTokens: tokensArb,
  mcpServer: mcpServerArb,
});

const postToolUseFailureArb: fc.Arbitrary<PostToolUseFailureEvent> = fc.record({
  eventType: fc.constant('PostToolUseFailure' as const),
  sessionId: sessionIdArb,
  timestamp: timestampArb,
  toolName: toolNameArb,
  error: fc.dictionary(fc.string(), fc.string()),
  mcpServer: mcpServerArb,
});

const subagentStartArb: fc.Arbitrary<SubagentStartEvent> = fc.record({
  eventType: fc.constant('SubagentStart' as const),
  sessionId: sessionIdArb,
  timestamp: timestampArb,
  agentId: fc.string({ minLength: 1, maxLength: 30 }),
  parentAgentId: fc.string({ minLength: 1, maxLength: 30 }),
});

const subagentStopArb: fc.Arbitrary<SubagentStopEvent> = fc.record({
  eventType: fc.constant('SubagentStop' as const),
  sessionId: sessionIdArb,
  timestamp: timestampArb,
  agentId: fc.string({ minLength: 1, maxLength: 30 }),
});

const stopEventArb: fc.Arbitrary<StopEvent> = fc.record({
  eventType: fc.constant('Stop' as const),
  sessionId: sessionIdArb,
  timestamp: timestampArb,
});

const hookEventArb: fc.Arbitrary<HookEvent> = fc.oneof(
  sessionStartArb,
  preToolUseArb,
  postToolUseArb,
  postToolUseFailureArb,
  subagentStartArb,
  subagentStopArb,
  stopEventArb
);

// ---------------------------------------------------------------------------
// Type guard tests
// ---------------------------------------------------------------------------

describe('HookEvent type guards', () => {
  describe('isSessionStart', () => {
    it('returns true for SessionStart events', () => {
      fc.assert(
        fc.property(sessionStartArb, (event) => {
          expect(isSessionStart(event)).toBe(true);
        })
      );
    });

    it('returns false for all other event types', () => {
      const nonSessionStart = fc.oneof(
        preToolUseArb,
        postToolUseArb,
        postToolUseFailureArb,
        subagentStartArb,
        subagentStopArb,
        stopEventArb
      );
      fc.assert(
        fc.property(nonSessionStart, (event) => {
          expect(isSessionStart(event)).toBe(false);
        })
      );
    });
  });

  describe('isPreToolUse', () => {
    it('returns true for PreToolUse events', () => {
      fc.assert(
        fc.property(preToolUseArb, (event) => {
          expect(isPreToolUse(event)).toBe(true);
        })
      );
    });

    it('returns false for all other event types', () => {
      const nonPreToolUse = fc.oneof(
        sessionStartArb,
        postToolUseArb,
        postToolUseFailureArb,
        subagentStartArb,
        subagentStopArb,
        stopEventArb
      );
      fc.assert(
        fc.property(nonPreToolUse, (event) => {
          expect(isPreToolUse(event)).toBe(false);
        })
      );
    });
  });

  describe('isPostToolUse', () => {
    it('returns true for PostToolUse events', () => {
      fc.assert(
        fc.property(postToolUseArb, (event) => {
          expect(isPostToolUse(event)).toBe(true);
        })
      );
    });

    it('returns false for all other event types', () => {
      const nonPostToolUse = fc.oneof(
        sessionStartArb,
        preToolUseArb,
        postToolUseFailureArb,
        subagentStartArb,
        subagentStopArb,
        stopEventArb
      );
      fc.assert(
        fc.property(nonPostToolUse, (event) => {
          expect(isPostToolUse(event)).toBe(false);
        })
      );
    });
  });

  describe('isPostToolUseFailure', () => {
    it('returns true for PostToolUseFailure events', () => {
      fc.assert(
        fc.property(postToolUseFailureArb, (event) => {
          expect(isPostToolUseFailure(event)).toBe(true);
        })
      );
    });
  });

  describe('isSubagentStart', () => {
    it('returns true for SubagentStart events', () => {
      fc.assert(
        fc.property(subagentStartArb, (event) => {
          expect(isSubagentStart(event)).toBe(true);
        })
      );
    });
  });

  describe('isSubagentStop', () => {
    it('returns true for SubagentStop events', () => {
      fc.assert(
        fc.property(subagentStopArb, (event) => {
          expect(isSubagentStop(event)).toBe(true);
        })
      );
    });
  });

  describe('isStop', () => {
    it('returns true for Stop events', () => {
      fc.assert(
        fc.property(stopEventArb, (event) => {
          expect(isStop(event)).toBe(true);
        })
      );
    });
  });

  describe('exactly one type guard matches for any HookEvent', () => {
    it('each event matches exactly one guard', () => {
      const guards = [
        isSessionStart,
        isPreToolUse,
        isPostToolUse,
        isPostToolUseFailure,
        isSubagentStart,
        isSubagentStop,
        isStop,
      ];

      fc.assert(
        fc.property(hookEventArb, (event) => {
          const matchCount = guards.filter((guard) => guard(event)).length;
          expect(matchCount).toBe(1);
        })
      );
    });
  });
});

describe('Composite type guards', () => {
  describe('isToolEvent', () => {
    it('returns true for PreToolUse, PostToolUse, and PostToolUseFailure', () => {
      const toolEvents = fc.oneof(preToolUseArb, postToolUseArb, postToolUseFailureArb);
      fc.assert(
        fc.property(toolEvents, (event) => {
          expect(isToolEvent(event)).toBe(true);
        })
      );
    });

    it('returns false for non-tool events', () => {
      const nonToolEvents = fc.oneof(
        sessionStartArb,
        subagentStartArb,
        subagentStopArb,
        stopEventArb
      );
      fc.assert(
        fc.property(nonToolEvents, (event) => {
          expect(isToolEvent(event)).toBe(false);
        })
      );
    });
  });

  describe('isMcpEvent', () => {
    it('returns true for tool events with a defined mcpServer', () => {
      const mcpToolEvent: fc.Arbitrary<PostToolUseEvent> = fc.record({
        eventType: fc.constant('PostToolUse' as const),
        sessionId: sessionIdArb,
        timestamp: timestampArb,
        toolName: toolNameArb,
        toolOutput: fc.dictionary(fc.string(), fc.string()),
        inputTokens: tokensArb,
        outputTokens: tokensArb,
        mcpServer: fc.string({ minLength: 1, maxLength: 30 }),
      });
      fc.assert(
        fc.property(mcpToolEvent, (event) => {
          expect(isMcpEvent(event)).toBe(true);
        })
      );
    });

    it('returns false for tool events without mcpServer', () => {
      const nonMcpToolEvent: fc.Arbitrary<PostToolUseEvent> = fc.record({
        eventType: fc.constant('PostToolUse' as const),
        sessionId: sessionIdArb,
        timestamp: timestampArb,
        toolName: toolNameArb,
        toolOutput: fc.dictionary(fc.string(), fc.string()),
        inputTokens: tokensArb,
        outputTokens: tokensArb,
        mcpServer: fc.constant(undefined),
      });
      fc.assert(
        fc.property(nonMcpToolEvent, (event) => {
          expect(isMcpEvent(event)).toBe(false);
        })
      );
    });
  });
});

describe('Cost rate table', () => {
  it('has entries for known models', () => {
    expect(COST_RATES).toBeDefined();
    expect(getCostRate('claude-opus-4')).toBeDefined();
    expect(getCostRate('claude-sonnet-4')).toBeDefined();
    expect(getCostRate('claude-haiku-3.5')).toBeDefined();
  });

  it('returns default rate for unknown models', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 50 }), (model) => {
        const rate = getCostRate(model);
        expect(rate).toBeDefined();
        expect(rate.inputRate).toBeGreaterThan(0);
        expect(rate.outputRate).toBeGreaterThan(0);
      })
    );
  });

  it('opus costs more than sonnet which costs more than haiku', () => {
    const opus = getCostRate('claude-opus-4');
    const sonnet = getCostRate('claude-sonnet-4');
    const haiku = getCostRate('claude-haiku-3.5');

    expect(opus.inputRate).toBeGreaterThan(sonnet.inputRate);
    expect(sonnet.inputRate).toBeGreaterThan(haiku.inputRate);
    expect(opus.outputRate).toBeGreaterThan(sonnet.outputRate);
    expect(sonnet.outputRate).toBeGreaterThan(haiku.outputRate);
  });
});

describe('Domain types compile correctly', () => {
  it('Session type has all required fields', () => {
    const session: Session = {
      id: 'test-session',
      startTime: '2026-03-03T00:00:00Z',
      endTime: undefined,
      model: 'claude-sonnet-4',
      agentCount: 1,
      eventCount: 5,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      estimatedCost: 0.012,
      mcpErrorCount: 0,
      status: 'active',
    };
    expect(session.id).toBe('test-session');
    expect(session.status).toBe('active');
  });

  it('AgentNode type has all required fields', () => {
    const agent: AgentNode = {
      agentId: 'agent-1',
      parentAgentId: undefined,
      toolCallCount: 3,
      inputTokens: 500,
      outputTokens: 200,
      estimatedCost: 0.005,
      status: 'completed',
      children: [],
    };
    expect(agent.agentId).toBe('agent-1');
    expect(agent.children).toHaveLength(0);
  });

  it('TraceGraph connects agents with edges', () => {
    const rootAgent: AgentNode = {
      agentId: 'root',
      parentAgentId: undefined,
      toolCallCount: 2,
      inputTokens: 300,
      outputTokens: 100,
      estimatedCost: 0.003,
      status: 'completed',
      children: [],
    };
    const trace: TraceGraph = {
      sessionId: 'session-1',
      rootAgent,
      allAgents: [rootAgent],
      edges: [],
    };
    expect(trace.sessionId).toBe('session-1');
    expect(trace.allAgents).toHaveLength(1);
  });

  it('McpServerHealth tracks server health metrics', () => {
    const health: McpServerHealth = {
      serverName: 'test-mcp',
      status: 'healthy',
      callCount: 10,
      errorCount: 1,
      avgLatencyMs: 45.5,
      tokenOverhead: 2000,
      errorTimeline: [],
    };
    expect(health.serverName).toBe('test-mcp');
    expect(health.errorCount).toBe(1);
  });

  it('CostBreakdown provides per-agent cost attribution', () => {
    const breakdown: CostBreakdown = {
      sessionId: 'session-1',
      agents: [],
      totalCost: 0.05,
      costByMcpServer: [],
      costMethodologyNote: 'Estimated based on published rates.',
    };
    expect(breakdown.totalCost).toBe(0.05);
    expect(breakdown.costMethodologyNote).toBeDefined();
  });

  it('ComparisonResult compares two sessions', () => {
    const comparison: ComparisonResult = {
      previousSessionId: 'session-1',
      currentSessionId: 'session-2',
      deltas: {
        tokensDelta: -100,
        costDelta: -0.01,
        agentCountDelta: 0,
        errorCountDelta: -1,
      },
      projectedMonthlySavings: 3.00,
    };
    expect(comparison.projectedMonthlySavings).toBe(3.00);
  });

  it('SessionFilter provides query parameters', () => {
    const filter: SessionFilter = {
      dateRange: { start: '2026-03-01', end: '2026-03-03' },
      costRange: { min: 0, max: 1.0 },
      agentCountRange: undefined,
      sortBy: 'startTime',
      sortOrder: 'desc',
      limit: 20,
      offset: 0,
    };
    expect(filter.sortBy).toBe('startTime');
    expect(filter.limit).toBe(20);
  });
});
