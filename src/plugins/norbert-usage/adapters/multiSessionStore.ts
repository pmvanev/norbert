/// Multi-session store: mutable adapter tracking SessionMetrics for all
/// active sessions. Lives at the adapter boundary (effects at edges).
///
/// Port: MultiSessionStore
///   addSession(id) -- register a new session with zeroed metrics
///   removeSession(id) -- remove a tracked session
///   updateSession(id, metrics) -- replace metrics for a session
///   getSessions() -- all tracked session metrics (immutable snapshot)
///   getSession(id) -- metrics for a specific session or undefined

import type { SessionMetrics } from "../domain/types";
import { createInitialMetrics } from "../domain/metricsAggregator";

// ---------------------------------------------------------------------------
// Port type
// ---------------------------------------------------------------------------

export interface MultiSessionStore {
  readonly addSession: (sessionId: string) => void;
  readonly removeSession: (sessionId: string) => void;
  readonly updateSession: (sessionId: string, metrics: SessionMetrics) => void;
  readonly getSessions: () => ReadonlyArray<SessionMetrics>;
  readonly getSession: (sessionId: string) => SessionMetrics | undefined;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a multi-session store backed by an in-memory Map. */
export const createMultiSessionStore = (): MultiSessionStore => {
  const sessions = new Map<string, SessionMetrics>();

  const addSession = (sessionId: string): void => {
    if (sessions.has(sessionId)) return;
    sessions.set(sessionId, createInitialMetrics(sessionId));
  };

  const removeSession = (sessionId: string): void => {
    sessions.delete(sessionId);
  };

  const updateSession = (sessionId: string, metrics: SessionMetrics): void => {
    if (sessions.has(sessionId)) {
      sessions.set(sessionId, metrics);
    }
  };

  const getSessions = (): ReadonlyArray<SessionMetrics> =>
    Array.from(sessions.values());

  const getSession = (sessionId: string): SessionMetrics | undefined =>
    sessions.get(sessionId);

  return { addSession, removeSession, updateSession, getSessions, getSession };
};
