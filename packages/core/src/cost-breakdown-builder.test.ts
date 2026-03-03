/**
 * Unit tests for cost breakdown builder -- pure function: agents + events -> CostBreakdown.
 *
 * Property-based: agent costs always sum to total cost.
 * Example-based: MCP attribution, sorting, tool call details.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildCostBreakdown } from './cost-breakdown-builder.js';
import type { AgentNode } from './trace.js';
import type {
  HookEvent,
  PreToolUseEvent,
  PostToolUseEvent,
  SessionStartEvent,
  StopEvent,
} from './hook-events.js';

// ---------------------------------------------------------------------------
// Test helpers: factory functions for domain objects
// ---------------------------------------------------------------------------

const makeAgentNode = (overrides: Partial<AgentNode> = {}): AgentNode => ({
  agentId: 'agent-root',
  parentAgentId: undefined,
  toolCallCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  estimatedCost: 0,
  status: 'completed',
  children: [],
  ...overrides,
});

const makePreToolUse = (overrides: Partial<PreToolUseEvent> = {}): PreToolUseEvent => ({
  eventType: 'PreToolUse',
  sessionId: 'session-1',
  timestamp: '2026-03-03T10:00:01.000Z',
  toolName: 'Read',
  toolInput: {},
  ...overrides,
});

const makePostToolUse = (overrides: Partial<PostToolUseEvent> = {}): PostToolUseEvent => ({
  eventType: 'PostToolUse',
  sessionId: 'session-1',
  timestamp: '2026-03-03T10:00:02.000Z',
  toolName: 'Read',
  toolOutput: {},
  ...overrides,
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe('buildCostBreakdown properties', () => {
  // Property: total cost equals sum of agent costs
  it('total cost equals sum of all agent costs', () => {
    const agentNodeArb = fc.record({
      agentId: fc.string({ minLength: 1, maxLength: 20 }),
      parentAgentId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      toolCallCount: fc.nat({ max: 100 }),
      inputTokens: fc.nat({ max: 1_000_000 }),
      outputTokens: fc.nat({ max: 1_000_000 }),
      estimatedCost: fc.double({ min: 0, max: 100, noNaN: true }),
      status: fc.constantFrom('active' as const, 'completed' as const, 'failed' as const),
      children: fc.constant([] as readonly AgentNode[]),
    });

    fc.assert(
      fc.property(
        fc.uniqueArray(agentNodeArb, { minLength: 1, maxLength: 5, selector: a => a.agentId }),
        (agents) => {
          const result = buildCostBreakdown('session-1', 'claude-sonnet-4', agents, []);
          const agentSum = result.agents.reduce((sum, a) => sum + a.estimatedCost, 0);
          expect(result.totalCost).toBeCloseTo(agentSum, 5);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: agents are always sorted by cost descending
  it('agents are always sorted by cost descending', () => {
    const agentNodeArb = fc.record({
      agentId: fc.string({ minLength: 1, maxLength: 20 }),
      parentAgentId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      toolCallCount: fc.nat({ max: 100 }),
      inputTokens: fc.nat({ max: 1_000_000 }),
      outputTokens: fc.nat({ max: 1_000_000 }),
      estimatedCost: fc.double({ min: 0, max: 100, noNaN: true }),
      status: fc.constantFrom('active' as const, 'completed' as const, 'failed' as const),
      children: fc.constant([] as readonly AgentNode[]),
    });

    fc.assert(
      fc.property(
        fc.uniqueArray(agentNodeArb, { minLength: 1, maxLength: 10, selector: a => a.agentId }),
        (agents) => {
          const result = buildCostBreakdown('session-1', 'claude-sonnet-4', agents, []);
          for (let i = 0; i < result.agents.length - 1; i++) {
            expect(result.agents[i].estimatedCost).toBeGreaterThanOrEqual(
              result.agents[i + 1].estimatedCost
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property: cost is always non-negative
  it('total cost is always non-negative', () => {
    const agentNodeArb = fc.record({
      agentId: fc.string({ minLength: 1, maxLength: 20 }),
      parentAgentId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
      toolCallCount: fc.nat({ max: 100 }),
      inputTokens: fc.nat({ max: 1_000_000 }),
      outputTokens: fc.nat({ max: 1_000_000 }),
      estimatedCost: fc.double({ min: 0, max: 100, noNaN: true }),
      status: fc.constantFrom('active' as const, 'completed' as const, 'failed' as const),
      children: fc.constant([] as readonly AgentNode[]),
    });

    fc.assert(
      fc.property(
        fc.uniqueArray(agentNodeArb, { minLength: 0, maxLength: 5, selector: a => a.agentId }),
        (agents) => {
          const result = buildCostBreakdown('session-1', 'claude-sonnet-4', agents, []);
          expect(result.totalCost).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Example-based tests
// ---------------------------------------------------------------------------

describe('buildCostBreakdown examples', () => {
  it('returns empty breakdown for empty inputs', () => {
    const result = buildCostBreakdown('session-1', 'claude-sonnet-4', [], []);

    expect(result.sessionId).toBe('session-1');
    expect(result.agents).toEqual([]);
    expect(result.totalCost).toBe(0);
    expect(result.costByMcpServer).toEqual([]);
    expect(result.costMethodologyNote).toBeDefined();
    expect(result.costMethodologyNote.length).toBeGreaterThan(0);
  });

  it('builds per-agent breakdown from AgentNode array', () => {
    const agents: AgentNode[] = [
      makeAgentNode({
        agentId: 'agent-root',
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.0105, // 1000/1M * 3 + 500/1M * 15
      }),
      makeAgentNode({
        agentId: 'agent-child-1',
        parentAgentId: 'agent-root',
        inputTokens: 2000,
        outputTokens: 1000,
        estimatedCost: 0.021, // 2000/1M * 3 + 1000/1M * 15
      }),
    ];

    const result = buildCostBreakdown('session-1', 'claude-sonnet-4', agents, []);

    expect(result.agents.length).toBe(2);
    // Sorted descending: child (0.021) > root (0.0105)
    expect(result.agents[0].agentId).toBe('agent-child-1');
    expect(result.agents[1].agentId).toBe('agent-root');
    expect(result.agents[0].inputTokens).toBe(2000);
    expect(result.agents[0].outputTokens).toBe(1000);
    expect(result.agents[0].estimatedCost).toBe(0.021);
  });

  it('attributes tool calls to agents using PreToolUse agentId', () => {
    const agents: AgentNode[] = [
      makeAgentNode({
        agentId: 'agent-root',
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: 0.0105,
        toolCallCount: 1,
      }),
    ];

    const events: HookEvent[] = [
      makePreToolUse({
        toolName: 'Read',
        agentId: 'agent-root',
        timestamp: '2026-03-03T10:00:01.000Z',
      }),
      makePostToolUse({
        toolName: 'Read',
        inputTokens: 1000,
        outputTokens: 500,
        timestamp: '2026-03-03T10:00:02.000Z',
      }),
    ];

    const result = buildCostBreakdown('session-1', 'claude-sonnet-4', agents, events);

    expect(result.agents[0].toolCalls.length).toBe(1);
    expect(result.agents[0].toolCalls[0].toolName).toBe('Read');
    expect(result.agents[0].toolCalls[0].inputTokens).toBe(1000);
    expect(result.agents[0].toolCalls[0].outputTokens).toBe(500);
  });

  it('formats MCP tool calls as server:tool_name', () => {
    const agents: AgentNode[] = [
      makeAgentNode({
        agentId: 'agent-root',
        inputTokens: 500,
        outputTokens: 200,
        estimatedCost: 0.0045,
        toolCallCount: 1,
      }),
    ];

    const events: HookEvent[] = [
      makePreToolUse({
        toolName: 'read_file',
        mcpServer: 'filesystem',
        agentId: 'agent-root',
        timestamp: '2026-03-03T10:00:01.000Z',
      }),
      makePostToolUse({
        toolName: 'read_file',
        mcpServer: 'filesystem',
        inputTokens: 500,
        outputTokens: 200,
        timestamp: '2026-03-03T10:00:02.000Z',
      }),
    ];

    const result = buildCostBreakdown('session-1', 'claude-sonnet-4', agents, events);

    expect(result.agents[0].toolCalls[0].toolName).toBe('filesystem:read_file');
    expect(result.costByMcpServer.length).toBe(1);
    expect(result.costByMcpServer[0].serverName).toBe('filesystem');
    expect(result.costByMcpServer[0].inputTokens).toBe(500);
    expect(result.costByMcpServer[0].outputTokens).toBe(200);
  });

  it('groups MCP costs by server across multiple agents', () => {
    const agents: AgentNode[] = [
      makeAgentNode({
        agentId: 'agent-root',
        inputTokens: 500,
        outputTokens: 200,
        estimatedCost: 0.0045,
      }),
      makeAgentNode({
        agentId: 'agent-child-1',
        parentAgentId: 'agent-root',
        inputTokens: 1000,
        outputTokens: 400,
        estimatedCost: 0.009,
      }),
    ];

    const events: HookEvent[] = [
      // Root agent uses filesystem MCP
      makePreToolUse({
        toolName: 'read_file',
        mcpServer: 'filesystem',
        agentId: 'agent-root',
        timestamp: '2026-03-03T10:00:01.000Z',
      }),
      makePostToolUse({
        toolName: 'read_file',
        mcpServer: 'filesystem',
        inputTokens: 500,
        outputTokens: 200,
        timestamp: '2026-03-03T10:00:02.000Z',
      }),
      // Child agent also uses filesystem MCP
      makePreToolUse({
        toolName: 'write_file',
        mcpServer: 'filesystem',
        agentId: 'agent-child-1',
        timestamp: '2026-03-03T10:00:03.000Z',
      }),
      makePostToolUse({
        toolName: 'write_file',
        mcpServer: 'filesystem',
        inputTokens: 1000,
        outputTokens: 400,
        timestamp: '2026-03-03T10:00:04.000Z',
      }),
    ];

    const result = buildCostBreakdown('session-1', 'claude-sonnet-4', agents, events);

    // Both calls to filesystem server are grouped
    expect(result.costByMcpServer.length).toBe(1);
    expect(result.costByMcpServer[0].serverName).toBe('filesystem');
    expect(result.costByMcpServer[0].inputTokens).toBe(1500); // 500 + 1000
    expect(result.costByMcpServer[0].outputTokens).toBe(600); // 200 + 400
  });

  it('includes cost methodology note', () => {
    const result = buildCostBreakdown('session-1', 'claude-sonnet-4', [], []);

    expect(result.costMethodologyNote).toBeDefined();
    expect(typeof result.costMethodologyNote).toBe('string');
    expect(result.costMethodologyNote.length).toBeGreaterThan(0);
  });

  it('handles tool calls without agentId by attributing to unknown agent', () => {
    const agents: AgentNode[] = [
      makeAgentNode({
        agentId: 'agent-root',
        inputTokens: 500,
        outputTokens: 200,
        estimatedCost: 0.0045,
      }),
    ];

    const events: HookEvent[] = [
      makePreToolUse({
        toolName: 'Bash',
        // No agentId
        timestamp: '2026-03-03T10:00:01.000Z',
      }),
      makePostToolUse({
        toolName: 'Bash',
        inputTokens: 500,
        outputTokens: 200,
        timestamp: '2026-03-03T10:00:02.000Z',
      }),
    ];

    const result = buildCostBreakdown('session-1', 'claude-sonnet-4', agents, events);

    // Tool call should still appear somewhere (attributed to unknown or root)
    const allToolCalls = result.agents.flatMap(a => a.toolCalls);
    expect(allToolCalls.length).toBe(1);
    expect(allToolCalls[0].toolName).toBe('Bash');
  });
});
