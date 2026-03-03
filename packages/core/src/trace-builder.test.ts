/**
 * Unit tests for buildTraceGraph -- pure function: flat agent list -> trace graph.
 *
 * Step: 03-02
 *
 * Tests tree building from flat agent spans, edge computation, and edge cases:
 *   - Multi-level hierarchy (root -> child -> grandchild)
 *   - Single-agent sessions (no spans recorded)
 *   - Empty session (no agents at all)
 *   - Root identification from parentAgentId = undefined
 */

import { describe, it, expect } from 'vitest';
import { buildTraceGraph } from './trace-builder.js';
import type { AgentNode } from './trace.js';

// ---------------------------------------------------------------------------
// Helper: create a flat AgentNode (as returned from storage, children: [])
// ---------------------------------------------------------------------------

const flatAgent = (overrides: Partial<AgentNode> & Pick<AgentNode, 'agentId'>): AgentNode => ({
  agentId: overrides.agentId,
  parentAgentId: overrides.parentAgentId ?? undefined,
  toolCallCount: overrides.toolCallCount ?? 0,
  inputTokens: overrides.inputTokens ?? 0,
  outputTokens: overrides.outputTokens ?? 0,
  estimatedCost: overrides.estimatedCost ?? 0,
  status: overrides.status ?? 'completed',
  children: [],
});

describe('buildTraceGraph', () => {
  it('builds tree with correct parent-child relationships from flat list', () => {
    const flatAgents: readonly AgentNode[] = [
      flatAgent({ agentId: 'root', parentAgentId: undefined, toolCallCount: 3, inputTokens: 1000, outputTokens: 500, estimatedCost: 0.01 }),
      flatAgent({ agentId: 'child-1', parentAgentId: 'root', toolCallCount: 2, inputTokens: 400, outputTokens: 200 }),
      flatAgent({ agentId: 'child-2', parentAgentId: 'root', toolCallCount: 1, inputTokens: 200, outputTokens: 100 }),
    ];

    const graph = buildTraceGraph('session-1', flatAgents);

    expect(graph.sessionId).toBe('session-1');
    expect(graph.rootAgent.agentId).toBe('root');
    expect(graph.rootAgent.children).toHaveLength(2);
    expect(graph.rootAgent.children[0].agentId).toBe('child-1');
    expect(graph.rootAgent.children[1].agentId).toBe('child-2');
  });

  it('computes edges for all parent-child relationships', () => {
    const flatAgents: readonly AgentNode[] = [
      flatAgent({ agentId: 'root', parentAgentId: undefined }),
      flatAgent({ agentId: 'child-1', parentAgentId: 'root' }),
      flatAgent({ agentId: 'grandchild-1', parentAgentId: 'child-1' }),
    ];

    const graph = buildTraceGraph('session-2', flatAgents);

    expect(graph.edges).toHaveLength(2);
    expect(graph.edges).toContainEqual({ fromAgentId: 'root', toAgentId: 'child-1' });
    expect(graph.edges).toContainEqual({ fromAgentId: 'child-1', toAgentId: 'grandchild-1' });
  });

  it('preserves node metrics (toolCallCount, tokens, cost, status) in tree', () => {
    const flatAgents: readonly AgentNode[] = [
      flatAgent({
        agentId: 'root',
        parentAgentId: undefined,
        toolCallCount: 5,
        inputTokens: 2000,
        outputTokens: 800,
        estimatedCost: 0.025,
        status: 'completed',
      }),
    ];

    const graph = buildTraceGraph('session-3', flatAgents);

    expect(graph.rootAgent.toolCallCount).toBe(5);
    expect(graph.rootAgent.inputTokens).toBe(2000);
    expect(graph.rootAgent.outputTokens).toBe(800);
    expect(graph.rootAgent.estimatedCost).toBe(0.025);
    expect(graph.rootAgent.status).toBe('completed');
  });

  it('handles empty agent list by synthesizing a virtual root', () => {
    const graph = buildTraceGraph('empty-session', []);

    expect(graph.sessionId).toBe('empty-session');
    expect(graph.rootAgent).toBeDefined();
    expect(graph.rootAgent.agentId).toBe('virtual-root');
    expect(graph.rootAgent.children).toHaveLength(0);
    expect(graph.allAgents).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });

  it('builds deep hierarchy (root -> child -> grandchild)', () => {
    const flatAgents: readonly AgentNode[] = [
      flatAgent({ agentId: 'root', parentAgentId: undefined }),
      flatAgent({ agentId: 'child', parentAgentId: 'root' }),
      flatAgent({ agentId: 'grandchild', parentAgentId: 'child' }),
    ];

    const graph = buildTraceGraph('deep-session', flatAgents);

    expect(graph.rootAgent.agentId).toBe('root');
    expect(graph.rootAgent.children).toHaveLength(1);
    expect(graph.rootAgent.children[0].agentId).toBe('child');
    expect(graph.rootAgent.children[0].children).toHaveLength(1);
    expect(graph.rootAgent.children[0].children[0].agentId).toBe('grandchild');
    expect(graph.rootAgent.children[0].children[0].children).toHaveLength(0);
  });

  it('allAgents contains every agent from the flat list with tree structure', () => {
    const flatAgents: readonly AgentNode[] = [
      flatAgent({ agentId: 'root', parentAgentId: undefined }),
      flatAgent({ agentId: 'child-1', parentAgentId: 'root' }),
      flatAgent({ agentId: 'child-2', parentAgentId: 'root' }),
    ];

    const graph = buildTraceGraph('session-all', flatAgents);

    expect(graph.allAgents).toHaveLength(3);
    const agentIds = graph.allAgents.map(a => a.agentId);
    expect(agentIds).toContain('root');
    expect(agentIds).toContain('child-1');
    expect(agentIds).toContain('child-2');
  });

  it('synthesizes missing parent when no explicit root exists (only child agents)', () => {
    // All agents have a parent, but the parent is not in the list.
    // The builder should synthesize a placeholder node with the actual parent ID.
    const flatAgents: readonly AgentNode[] = [
      flatAgent({ agentId: 'child-1', parentAgentId: 'missing-root' }),
      flatAgent({ agentId: 'child-2', parentAgentId: 'missing-root' }),
    ];

    const graph = buildTraceGraph('orphan-session', flatAgents);

    expect(graph.rootAgent).toBeDefined();
    expect(graph.rootAgent.agentId).toBe('missing-root');
    expect(graph.rootAgent.children).toHaveLength(2);
    expect(graph.edges).toHaveLength(2);
  });

  it('handles failed agents with correct status in tree', () => {
    const flatAgents: readonly AgentNode[] = [
      flatAgent({ agentId: 'root', parentAgentId: undefined, status: 'completed' }),
      flatAgent({ agentId: 'failed-child', parentAgentId: 'root', status: 'failed' }),
    ];

    const graph = buildTraceGraph('failed-session', flatAgents);

    const failedChild = graph.rootAgent.children.find(c => c.agentId === 'failed-child');
    expect(failedChild).toBeDefined();
    expect(failedChild!.status).toBe('failed');
  });
});
