/**
 * Session aggregator -- pure function: event + current session -> session update.
 *
 * Computes incremental session updates from individual hook events.
 * Returns a discriminated union describing the update to apply:
 *   - 'create': new session created (SessionStart event)
 *   - 'increment': delta update to existing session (token events, subagent events)
 *   - 'close': session completed (Stop event)
 *
 * This module has zero side effects and zero dependencies beyond this package.
 */

import type { HookEvent } from './hook-events.js';
import type { Session } from './session.js';
import { estimateCost } from './cost-calculator.js';

// ---------------------------------------------------------------------------
// Session Update (discriminated union output type)
// ---------------------------------------------------------------------------

export type SessionUpdate =
  | { readonly type: 'create'; readonly session: Session }
  | { readonly type: 'increment'; readonly delta: SessionIncrementDelta }
  | { readonly type: 'close'; readonly endTime: string };

export interface SessionIncrementDelta {
  readonly inputTokensDelta: number;
  readonly outputTokensDelta: number;
  readonly eventCountDelta: number;
  readonly costDelta: number;
  readonly agentCountDelta: number;
  readonly mcpErrorCountDelta: number;
}

// ---------------------------------------------------------------------------
// Delta constructors
// ---------------------------------------------------------------------------

const zeroDelta = (): SessionIncrementDelta => ({
  inputTokensDelta: 0,
  outputTokensDelta: 0,
  eventCountDelta: 1,
  costDelta: 0,
  agentCountDelta: 0,
  mcpErrorCountDelta: 0,
});

const createNewSession = (
  sessionId: string,
  timestamp: string,
  model: string
): Session => ({
  id: sessionId,
  startTime: timestamp,
  endTime: undefined,
  model,
  agentCount: 0,
  eventCount: 1,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  estimatedCost: 0,
  mcpErrorCount: 0,
  status: 'active',
});

// ---------------------------------------------------------------------------
// Per-event-kind update computation
// ---------------------------------------------------------------------------

const computePostToolUseDelta = (event: HookEvent, session: Session): SessionIncrementDelta => {
  if (event.eventType !== 'PostToolUse') return zeroDelta();

  const inputTokens = event.inputTokens ?? 0;
  const outputTokens = event.outputTokens ?? 0;
  const costDelta = estimateCost(inputTokens, outputTokens, session.model);

  return {
    inputTokensDelta: inputTokens,
    outputTokensDelta: outputTokens,
    eventCountDelta: 1,
    costDelta,
    agentCountDelta: 0,
    mcpErrorCountDelta: 0,
  };
};

const computePostToolUseFailureDelta = (event: HookEvent): SessionIncrementDelta => {
  if (event.eventType !== 'PostToolUseFailure') return zeroDelta();

  const hasMcpServer = event.mcpServer != null;

  return {
    ...zeroDelta(),
    mcpErrorCountDelta: hasMcpServer ? 1 : 0,
  };
};

const computeSubagentStartDelta = (): SessionIncrementDelta => ({
  ...zeroDelta(),
  agentCountDelta: 1,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the session update for a given event and current session state.
 *
 * Pure function: no side effects.
 *
 * @param event - The hook event to process
 * @param session - The current session state (null for SessionStart)
 * @returns The session update to apply
 */
export const computeSessionUpdate = (
  event: HookEvent,
  session: Session | null
): SessionUpdate => {
  switch (event.eventType) {
    case 'SessionStart':
      return {
        type: 'create',
        session: createNewSession(event.sessionId, event.timestamp, event.model),
      };

    case 'PostToolUse':
      return {
        type: 'increment',
        delta: computePostToolUseDelta(event, session!),
      };

    case 'PostToolUseFailure':
      return {
        type: 'increment',
        delta: computePostToolUseFailureDelta(event),
      };

    case 'SubagentStart':
      return {
        type: 'increment',
        delta: computeSubagentStartDelta(),
      };

    case 'Stop':
      return {
        type: 'close',
        endTime: event.timestamp,
      };

    default:
      // PreToolUse, SubagentStop -- just increment event count
      return {
        type: 'increment',
        delta: zeroDelta(),
      };
  }
};
