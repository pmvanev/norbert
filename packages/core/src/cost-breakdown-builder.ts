/**
 * Cost breakdown builder -- pure function: agents + events -> CostBreakdown.
 *
 * Builds a per-agent cost waterfall with MCP attribution from:
 *   - AgentNode[] (pre-aggregated token/cost data from storage)
 *   - HookEvent[] (tool call details for per-tool-call breakdown)
 *
 * Agents are sorted by cost descending.
 * MCP tool calls are formatted as "server:tool_name".
 * Cost methodology footnote is included.
 *
 * This module has zero side effects and zero dependencies beyond this package.
 */

import type { AgentNode } from './trace.js';
import type { Session } from './session.js';
import type { HookEvent, PreToolUseEvent, PostToolUseEvent } from './hook-events.js';
import type { CostBreakdown, AgentCostEntry, McpCostEntry, ToolCallDetail } from './cost.js';
import { estimateCost } from './cost-calculator.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COST_METHODOLOGY_NOTE =
  'Cost estimates are based on published Anthropic API pricing per model. ' +
  'Actual costs may vary based on caching, batching, and billing tier. ' +
  'Token counts reflect tool call usage observed via hooks and may not capture all session tokens.';

const UNKNOWN_AGENT_ID = 'unknown';

// ---------------------------------------------------------------------------
// Internal: correlate PreToolUse with PostToolUse
// ---------------------------------------------------------------------------

interface CorrelatedToolCall {
  readonly toolName: string;
  readonly mcpServer: string | undefined;
  readonly agentId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

/**
 * Correlate PreToolUse events (which carry agentId and mcpServer) with
 * PostToolUse events (which carry token counts) by sequential pairing.
 *
 * Each PreToolUse for a given toolName is matched with the next PostToolUse
 * for the same toolName. This is a simplification that works because Claude Code
 * emits events in order: PreToolUse -> PostToolUse for each tool call.
 */
const correlateToolCalls = (events: readonly HookEvent[]): readonly CorrelatedToolCall[] => {
  const pendingPreToolUse = new Map<string, PreToolUseEvent[]>();
  const correlated: CorrelatedToolCall[] = [];

  for (const event of events) {
    if (event.eventType === 'PreToolUse') {
      const key = buildCorrelationKey(event.toolName, event.mcpServer);
      const pending = pendingPreToolUse.get(key) ?? [];
      pendingPreToolUse.set(key, [...pending, event]);
    }

    if (event.eventType === 'PostToolUse') {
      const key = buildCorrelationKey(event.toolName, event.mcpServer);
      const pending = pendingPreToolUse.get(key) ?? [];
      const matchingPre = pending[0];

      if (matchingPre !== undefined) {
        pendingPreToolUse.set(key, pending.slice(1));
        correlated.push({
          toolName: event.toolName,
          mcpServer: event.mcpServer ?? matchingPre.mcpServer,
          agentId: matchingPre.agentId ?? UNKNOWN_AGENT_ID,
          inputTokens: event.inputTokens ?? 0,
          outputTokens: event.outputTokens ?? 0,
        });
      } else {
        // PostToolUse without matching PreToolUse
        correlated.push({
          toolName: event.toolName,
          mcpServer: event.mcpServer,
          agentId: UNKNOWN_AGENT_ID,
          inputTokens: event.inputTokens ?? 0,
          outputTokens: event.outputTokens ?? 0,
        });
      }
    }
  }

  return correlated;
};

const buildCorrelationKey = (toolName: string, mcpServer: string | undefined): string =>
  mcpServer !== undefined ? `${mcpServer}:${toolName}` : toolName;

// ---------------------------------------------------------------------------
// Internal: format tool name with MCP attribution
// ---------------------------------------------------------------------------

const formatToolName = (toolName: string, mcpServer: string | undefined): string =>
  mcpServer !== undefined ? `${mcpServer}:${toolName}` : toolName;

// ---------------------------------------------------------------------------
// Internal: build tool call details per agent
// ---------------------------------------------------------------------------

const buildToolCallsByAgent = (
  correlatedCalls: readonly CorrelatedToolCall[],
  model: string
): ReadonlyMap<string, readonly ToolCallDetail[]> => {
  const byAgent = new Map<string, ToolCallDetail[]>();

  for (const call of correlatedCalls) {
    const detail: ToolCallDetail = {
      toolName: formatToolName(call.toolName, call.mcpServer),
      inputTokens: call.inputTokens,
      outputTokens: call.outputTokens,
      estimatedCost: estimateCost(call.inputTokens, call.outputTokens, model),
    };

    const existing = byAgent.get(call.agentId) ?? [];
    byAgent.set(call.agentId, [...existing, detail]);
  }

  return byAgent;
};

// ---------------------------------------------------------------------------
// Internal: build MCP server cost entries
// ---------------------------------------------------------------------------

const buildMcpServerCosts = (
  correlatedCalls: readonly CorrelatedToolCall[],
  model: string
): readonly McpCostEntry[] => {
  const mcpCalls = correlatedCalls.filter(c => c.mcpServer !== undefined);
  const byServer = new Map<string, { inputTokens: number; outputTokens: number }>();

  for (const call of mcpCalls) {
    const serverName = call.mcpServer!;
    const existing = byServer.get(serverName) ?? { inputTokens: 0, outputTokens: 0 };
    byServer.set(serverName, {
      inputTokens: existing.inputTokens + call.inputTokens,
      outputTokens: existing.outputTokens + call.outputTokens,
    });
  }

  return [...byServer.entries()].map(([serverName, tokens]) => ({
    serverName,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    estimatedCost: estimateCost(tokens.inputTokens, tokens.outputTokens, model),
  }));
};

// ---------------------------------------------------------------------------
// Internal: reassign unmatched tool calls to known agents
// ---------------------------------------------------------------------------

/**
 * Tool calls attributed to 'unknown' agent (no agentId on PreToolUse) are
 * reassigned to the first known agent. This handles the common case where
 * the root agent's tool calls lack explicit agentId in the hook events.
 */
const reassignUnknownToolCalls = (
  toolCallsByAgent: ReadonlyMap<string, readonly ToolCallDetail[]>,
  knownAgentIds: readonly string[]
): ReadonlyMap<string, readonly ToolCallDetail[]> => {
  const unknownCalls = toolCallsByAgent.get(UNKNOWN_AGENT_ID) ?? [];
  if (unknownCalls.length === 0 || knownAgentIds.length === 0) {
    return toolCallsByAgent;
  }

  const firstAgentId = knownAgentIds[0];
  const merged = new Map(toolCallsByAgent);
  merged.delete(UNKNOWN_AGENT_ID);

  const existingCalls = merged.get(firstAgentId) ?? [];
  merged.set(firstAgentId, [...existingCalls, ...unknownCalls]);

  return merged;
};

// ---------------------------------------------------------------------------
// Internal: build agent cost entries from AgentNode array
// ---------------------------------------------------------------------------

const buildAgentCostEntries = (
  agents: readonly AgentNode[],
  toolCallsByAgent: ReadonlyMap<string, readonly ToolCallDetail[]>
): readonly AgentCostEntry[] => {
  const knownAgentIds = agents.map(a => a.agentId);
  const resolvedToolCalls = reassignUnknownToolCalls(toolCallsByAgent, knownAgentIds);

  return agents
    .map(agent => ({
      agentId: agent.agentId,
      inputTokens: agent.inputTokens,
      outputTokens: agent.outputTokens,
      estimatedCost: agent.estimatedCost,
      toolCalls: resolvedToolCalls.get(agent.agentId) ?? [],
    }))
    .sort((a, b) => b.estimatedCost - a.estimatedCost);
};

// ---------------------------------------------------------------------------
// Internal: synthesize root agent from session totals
// ---------------------------------------------------------------------------

const ROOT_AGENT_ID = 'agent-root';

/**
 * Synthesize a root agent node representing the top-level agent.
 *
 * The root agent's tokens are the session total minus the sum of subagent tokens.
 * This handles the case where the root agent is not stored as a span in the DB.
 */
const synthesizeRootAgent = (
  session: Session,
  subagents: readonly AgentNode[],
  model: string
): AgentNode => {
  const subagentInputTokens = subagents.reduce((sum, a) => sum + a.inputTokens, 0);
  const subagentOutputTokens = subagents.reduce((sum, a) => sum + a.outputTokens, 0);

  const rootInputTokens = Math.max(0, session.totalInputTokens - subagentInputTokens);
  const rootOutputTokens = Math.max(0, session.totalOutputTokens - subagentOutputTokens);

  return {
    agentId: ROOT_AGENT_ID,
    parentAgentId: undefined,
    toolCallCount: 0,
    inputTokens: rootInputTokens,
    outputTokens: rootOutputTokens,
    estimatedCost: estimateCost(rootInputTokens, rootOutputTokens, model),
    status: 'completed',
    children: [],
  };
};

/**
 * Determine whether a root agent needs to be synthesized.
 *
 * A root agent is synthesized when:
 * - The session has tokens that are not fully accounted for by subagents
 * - No agent in the list already has the root agent ID
 */
const needsRootAgent = (
  session: Session,
  agents: readonly AgentNode[]
): boolean => {
  const hasExistingRoot = agents.some(a => a.agentId === ROOT_AGENT_ID);
  if (hasExistingRoot) return false;

  const subagentInputTokens = agents.reduce((sum, a) => sum + a.inputTokens, 0);
  const subagentOutputTokens = agents.reduce((sum, a) => sum + a.outputTokens, 0);

  return (
    session.totalInputTokens > subagentInputTokens ||
    session.totalOutputTokens > subagentOutputTokens
  );
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a CostBreakdown from session, agent spans, and hook events.
 *
 * Pure function: no side effects.
 *
 * When subagent spans don't account for all session tokens, a root agent
 * entry is synthesized with the remaining tokens.
 *
 * @param sessionId - The session identifier
 * @param model - The model used for cost rate lookup
 * @param agents - Pre-aggregated agent spans with token/cost data
 * @param events - Raw hook events for per-tool-call breakdown
 * @param session - Optional session aggregate for root agent synthesis
 * @returns Complete cost breakdown with per-agent and per-MCP-server attribution
 */
export const buildCostBreakdown = (
  sessionId: string,
  model: string,
  agents: readonly AgentNode[],
  events: readonly HookEvent[],
  session?: Session
): CostBreakdown => {
  // Synthesize root agent if session data shows unaccounted tokens
  const allAgents = session !== undefined && needsRootAgent(session, agents)
    ? [synthesizeRootAgent(session, agents, model), ...agents]
    : agents;

  const correlatedCalls = correlateToolCalls(events);
  const toolCallsByAgent = buildToolCallsByAgent(correlatedCalls, model);
  const mcpServerCosts = buildMcpServerCosts(correlatedCalls, model);
  const agentEntries = buildAgentCostEntries(allAgents, toolCallsByAgent);
  const totalCost = agentEntries.reduce((sum, a) => sum + a.estimatedCost, 0);

  return {
    sessionId,
    agents: agentEntries,
    totalCost,
    costByMcpServer: mcpServerCosts,
    costMethodologyNote: COST_METHODOLOGY_NOTE,
  };
};
