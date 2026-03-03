/**
 * Storage port -- function-signature types defining storage capabilities.
 *
 * Uses only @norbert/core domain types. No infrastructure imports.
 * Consumers (server, cli) accept StoragePort as a function parameter.
 * Providers (sqlite-adapter) return StoragePort from a factory function.
 */

import type {
  HookEvent,
  Session,
  SessionFilter,
  AgentNode,
  McpServerHealth,
} from '@norbert/core';

// ---------------------------------------------------------------------------
// Result types for write operations
// ---------------------------------------------------------------------------

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: StorageError };

export interface StorageError {
  readonly code: string;
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Storage Port (record of function types)
// ---------------------------------------------------------------------------

export type StoragePort = {
  readonly writeEvent: (event: HookEvent) => WriteResult;
  readonly getSession: (id: string) => Session | null;
  readonly getSessions: (filter: SessionFilter) => readonly Session[];
  readonly getEventsForSession: (sessionId: string) => readonly HookEvent[];
  readonly getMcpHealth: () => readonly McpServerHealth[];
  readonly getAgentSpans: (sessionId: string) => readonly AgentNode[];
  readonly close: () => void;
};
