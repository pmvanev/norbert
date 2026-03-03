/**
 * Session comparator -- pure function for side-by-side session comparison.
 *
 * Computes deltas, change percentages, agent-level comparisons,
 * and projected monthly savings. No IO, no side effects.
 *
 * Step: 05-01
 * Story: US-007
 */

import type { Session } from './session.js';
import type { AgentNode } from './trace.js';
import type { SessionDelta } from './cost.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentComparisonStatus = 'unchanged' | 'new' | 'removed';

export interface AgentComparison {
  readonly agentId: string;
  readonly status: AgentComparisonStatus;
  readonly previousCost: number;
  readonly currentCost: number;
  readonly costDelta: number;
  readonly costChangePercent: number;
}

export interface ChangePercents {
  readonly tokens: number;
  readonly cost: number;
  readonly agents: number;
  readonly errors: number;
  readonly duration: number;
}

export interface DetailedComparisonResult {
  readonly previousSession: Session;
  readonly currentSession: Session;
  readonly deltas: SessionDelta;
  readonly changePercents: ChangePercents;
  readonly agentComparisons: readonly AgentComparison[];
  readonly projectedMonthlySavings: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Assumed working days per month for monthly savings projection. */
const WORKING_DAYS_PER_MONTH = 20;

/** Assumed sessions per working day for monthly savings projection. */
const SESSIONS_PER_DAY = 8;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Compute percentage change from previous to current.
 * Returns 0 when previous is zero (avoids division by zero).
 */
const computeChangePercent = (previous: number, current: number): number =>
  previous === 0 ? 0 : ((current - previous) / previous) * 100;

/**
 * Compute duration in milliseconds from start and end times.
 * Returns 0 when endTime is undefined.
 */
const computeDurationMs = (startTime: string, endTime: string | undefined): number => {
  if (endTime === undefined) return 0;
  return new Date(endTime).getTime() - new Date(startTime).getTime();
};

/**
 * Flatten agent tree into a flat list of agents (including nested children).
 */
const flattenAgents = (agents: readonly AgentNode[]): readonly AgentNode[] => {
  const result: AgentNode[] = [];
  const queue = [...agents];
  while (queue.length > 0) {
    const agent = queue.pop()!;
    result.push(agent);
    queue.push(...agent.children);
  }
  return result;
};

/**
 * Build agent comparison entries by matching agents from both sessions by agentId.
 */
const buildAgentComparisons = (
  previousAgents: readonly AgentNode[],
  currentAgents: readonly AgentNode[]
): readonly AgentComparison[] => {
  const flatPrevious = flattenAgents(previousAgents);
  const flatCurrent = flattenAgents(currentAgents);

  const previousMap = new Map(flatPrevious.map(a => [a.agentId, a]));
  const currentMap = new Map(flatCurrent.map(a => [a.agentId, a]));

  const allAgentIds = new Set([...previousMap.keys(), ...currentMap.keys()]);

  return [...allAgentIds].map((agentId): AgentComparison => {
    const prevAgent = previousMap.get(agentId);
    const curAgent = currentMap.get(agentId);

    const previousCost = prevAgent?.estimatedCost ?? 0;
    const currentCost = curAgent?.estimatedCost ?? 0;
    const costDelta = currentCost - previousCost;

    const status: AgentComparisonStatus =
      prevAgent !== undefined && curAgent !== undefined
        ? 'unchanged'
        : prevAgent !== undefined
          ? 'removed'
          : 'new';

    return {
      agentId,
      status,
      previousCost,
      currentCost,
      costDelta,
      costChangePercent: computeChangePercent(previousCost, currentCost),
    };
  });
};

// ---------------------------------------------------------------------------
// Main comparison function
// ---------------------------------------------------------------------------

/**
 * Compare two sessions side-by-side.
 *
 * Pure function: takes session data and agent spans, returns comparison result.
 * No IO, no side effects.
 */
export const compareSessions = (
  previous: Session,
  current: Session,
  previousAgents: readonly AgentNode[],
  currentAgents: readonly AgentNode[]
): DetailedComparisonResult => {
  const previousTotalTokens = previous.totalInputTokens + previous.totalOutputTokens;
  const currentTotalTokens = current.totalInputTokens + current.totalOutputTokens;

  const deltas: SessionDelta = {
    tokensDelta: currentTotalTokens - previousTotalTokens,
    costDelta: current.estimatedCost - previous.estimatedCost,
    agentCountDelta: current.agentCount - previous.agentCount,
    errorCountDelta: current.mcpErrorCount - previous.mcpErrorCount,
  };

  const previousDuration = computeDurationMs(previous.startTime, previous.endTime);
  const currentDuration = computeDurationMs(current.startTime, current.endTime);

  const changePercents: ChangePercents = {
    tokens: computeChangePercent(previousTotalTokens, currentTotalTokens),
    cost: computeChangePercent(previous.estimatedCost, current.estimatedCost),
    agents: computeChangePercent(previous.agentCount, current.agentCount),
    errors: computeChangePercent(previous.mcpErrorCount, current.mcpErrorCount),
    duration: computeChangePercent(previousDuration, currentDuration),
  };

  const agentComparisons = buildAgentComparisons(previousAgents, currentAgents);

  // Projected monthly savings: negative costDelta means savings
  // Formula: -costDelta * workingDays * sessionsPerDay
  const projectedMonthlySavings =
    -deltas.costDelta * WORKING_DAYS_PER_MONTH * SESSIONS_PER_DAY;

  return {
    previousSession: previous,
    currentSession: current,
    deltas,
    changePercents,
    agentComparisons,
    projectedMonthlySavings,
  };
};
