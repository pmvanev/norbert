/**
 * Agent tree builder -- pure function: event -> agent span update.
 *
 * Computes agent span updates from SubagentStart and SubagentStop events.
 * Returns null for all other event types (no agent span change needed).
 *
 * This module has zero side effects and zero dependencies beyond this package.
 */

import type { HookEvent } from './hook-events.js';

// ---------------------------------------------------------------------------
// Agent Span (created on SubagentStart)
// ---------------------------------------------------------------------------

export interface AgentSpan {
  readonly agentId: string;
  readonly parentAgentId: string;
  readonly sessionId: string;
  readonly startTime: string;
  readonly status: 'active';
}

// ---------------------------------------------------------------------------
// Agent Span Update (discriminated union output type)
// ---------------------------------------------------------------------------

export type AgentSpanUpdate =
  | { readonly type: 'create'; readonly span: AgentSpan }
  | { readonly type: 'close'; readonly agentId: string; readonly sessionId: string; readonly endTime: string };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the agent span update for a given event.
 *
 * Pure function: no side effects.
 * Returns null for events that do not affect agent spans.
 */
export const computeAgentSpanUpdate = (
  event: HookEvent
): AgentSpanUpdate | null => {
  switch (event.eventType) {
    case 'SubagentStart':
      return {
        type: 'create',
        span: {
          agentId: event.agentId,
          parentAgentId: event.parentAgentId,
          sessionId: event.sessionId,
          startTime: event.timestamp,
          status: 'active',
        },
      };

    case 'SubagentStop':
      return {
        type: 'close',
        agentId: event.agentId,
        sessionId: event.sessionId,
        endTime: event.timestamp,
      };

    default:
      return null;
  }
};
