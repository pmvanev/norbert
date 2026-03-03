/**
 * Trace graph builder -- pure function: flat agent list -> TraceGraph.
 *
 * Builds a tree from flat agent spans returned by storage, establishing
 * parent-child relationships and computing edges for DAG visualization.
 *
 * This module has zero side effects and zero dependencies beyond this package.
 */

import type { AgentNode, TraceEdge, TraceGraph } from './trace.js';

// ---------------------------------------------------------------------------
// Synthesize placeholder nodes for missing agents
// ---------------------------------------------------------------------------

/**
 * Create a placeholder AgentNode for an agent referenced as a parent
 * but not present in the flat agent list (e.g., the session root agent).
 */
const createPlaceholderAgent = (
  agentId: string,
  children: readonly AgentNode[]
): AgentNode => ({
  agentId,
  parentAgentId: undefined,
  toolCallCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  estimatedCost: 0,
  status: 'completed',
  children,
});

/**
 * Create a virtual root node for empty sessions.
 */
const createVirtualRoot = (): AgentNode => createPlaceholderAgent('virtual-root', []);

// ---------------------------------------------------------------------------
// Build tree from flat list
// ---------------------------------------------------------------------------

/**
 * Attach children to each node by matching parentAgentId -> agentId.
 *
 * Returns a new AgentNode with its children populated (recursively).
 */
const attachChildren = (
  node: AgentNode,
  childrenByParent: ReadonlyMap<string, readonly AgentNode[]>
): AgentNode => {
  const directChildren = childrenByParent.get(node.agentId) ?? [];
  const populatedChildren = directChildren.map(child =>
    attachChildren(child, childrenByParent)
  );

  return {
    ...node,
    children: populatedChildren,
  };
};

/**
 * Group agents by their parentAgentId for efficient tree construction.
 */
const groupByParent = (
  agents: readonly AgentNode[]
): ReadonlyMap<string, readonly AgentNode[]> => {
  const groups = new Map<string, AgentNode[]>();

  for (const agent of agents) {
    if (agent.parentAgentId !== undefined) {
      const existing = groups.get(agent.parentAgentId) ?? [];
      groups.set(agent.parentAgentId, [...existing, agent]);
    }
  }

  return groups;
};

/**
 * Find the root agent: the one with no parentAgentId.
 */
const findRootAgent = (
  agents: readonly AgentNode[]
): AgentNode | undefined =>
  agents.find(agent => agent.parentAgentId === undefined);

/**
 * Compute edges from flat agent list (every child -> parent relationship).
 */
const computeEdges = (agents: readonly AgentNode[]): readonly TraceEdge[] =>
  agents
    .filter(agent => agent.parentAgentId !== undefined)
    .map(agent => ({
      fromAgentId: agent.parentAgentId!,
      toAgentId: agent.agentId,
    }));

/**
 * Collect all agents in the tree (flattened for allAgents array).
 */
const collectAllAgents = (root: AgentNode): readonly AgentNode[] => {
  const result: AgentNode[] = [root];
  for (const child of root.children) {
    result.push(...collectAllAgents(child));
  }
  return result;
};

/**
 * Find parent agent IDs that are referenced but not present in the agent list.
 */
const findMissingParentIds = (agents: readonly AgentNode[]): readonly string[] => {
  const agentIds = new Set(agents.map(a => a.agentId));
  const missingParentIds = new Set<string>();

  for (const agent of agents) {
    if (agent.parentAgentId !== undefined && !agentIds.has(agent.parentAgentId)) {
      missingParentIds.add(agent.parentAgentId);
    }
  }

  return [...missingParentIds];
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a TraceGraph from a flat list of agent spans.
 *
 * Pure function: no side effects.
 *
 * - Takes flat agent list (from storage) with children: []
 * - Builds parent-child tree by matching parentAgentId to agentId
 * - Computes TraceEdge list for DAG visualization
 * - Synthesizes placeholder nodes for parents referenced but not in the list
 * - Handles edge cases: empty sessions, orphan agents
 */
export const buildTraceGraph = (
  sessionId: string,
  flatAgents: readonly AgentNode[]
): TraceGraph => {
  // Empty session: synthesize virtual root
  if (flatAgents.length === 0) {
    const virtualRoot = createVirtualRoot();
    return {
      sessionId,
      rootAgent: virtualRoot,
      allAgents: [virtualRoot],
      edges: [],
    };
  }

  // Synthesize placeholder nodes for missing parents (e.g., session root agent)
  const missingParentIds = findMissingParentIds(flatAgents);
  const synthesizedAgents: readonly AgentNode[] = missingParentIds.map(id =>
    createPlaceholderAgent(id, [])
  );

  // Merge: original flat agents + synthesized placeholders
  const allFlatAgents = [...flatAgents, ...synthesizedAgents];

  const childrenByParent = groupByParent(allFlatAgents);
  const root = findRootAgent(allFlatAgents);

  if (root !== undefined) {
    const rootWithChildren = attachChildren(root, childrenByParent);
    const edges = computeEdges(allFlatAgents);
    const allAgents = collectAllAgents(rootWithChildren);

    return {
      sessionId,
      rootAgent: rootWithChildren,
      allAgents,
      edges,
    };
  }

  // Fallback: still no root (all agents have parentAgentId, and all parents
  // are also in the list -- a cycle or fully connected graph with no root).
  // Synthesize virtual root and attach all agents as children.
  const virtualRoot = createPlaceholderAgent('virtual-root', []);
  const allFlatWithVirtual = [virtualRoot, ...allFlatAgents.map(a => ({
    ...a,
    parentAgentId: a.parentAgentId === undefined ? undefined : a.parentAgentId,
  }))];

  // Re-group with virtual root parenting all top-level agents
  const topLevelAgents = allFlatAgents.filter(a => {
    const agentIds = new Set(allFlatAgents.map(x => x.agentId));
    return a.parentAgentId === undefined || !agentIds.has(a.parentAgentId);
  });

  const reparentedAgents = allFlatAgents.map(a =>
    topLevelAgents.includes(a)
      ? { ...a, parentAgentId: 'virtual-root' }
      : a
  );

  const finalAgents = [virtualRoot, ...reparentedAgents];
  const finalChildrenByParent = groupByParent(finalAgents);
  const rootWithChildren = attachChildren(virtualRoot, finalChildrenByParent);
  const edges = computeEdges(finalAgents);
  const allAgents = collectAllAgents(rootWithChildren);

  return {
    sessionId,
    rootAgent: rootWithChildren,
    allAgents,
    edges,
  };
};
