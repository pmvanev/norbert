/**
 * Trace graph domain types -- execution DAG for agent hierarchy.
 *
 * AgentNode represents a single agent in the execution trace.
 * TraceGraph is the complete directed acyclic graph for a session.
 *
 * All types are readonly to enforce immutability.
 */

// ---------------------------------------------------------------------------
// Agent Status
// ---------------------------------------------------------------------------

export type AgentStatus = 'active' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Agent Node
// ---------------------------------------------------------------------------

export interface AgentNode {
  readonly agentId: string;
  readonly parentAgentId: string | undefined;
  readonly toolCallCount: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCost: number;
  readonly status: AgentStatus;
  readonly children: readonly AgentNode[];
}

// ---------------------------------------------------------------------------
// Trace Edge
// ---------------------------------------------------------------------------

export interface TraceEdge {
  readonly fromAgentId: string;
  readonly toAgentId: string;
}

// ---------------------------------------------------------------------------
// Trace Graph
// ---------------------------------------------------------------------------

export interface TraceGraph {
  readonly sessionId: string;
  readonly rootAgent: AgentNode;
  readonly allAgents: readonly AgentNode[];
  readonly edges: readonly TraceEdge[];
}
