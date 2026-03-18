/// Session discovery adapter: polls a query function to discover active sessions.
///
/// Port: QueryActiveSessions = () => Promise<ReadonlyArray<ActiveSessionRow>>
/// Adapter: discoverSessions(query) => Promise<ReadonlyArray<ActiveSessionRow>>
///
/// Dependency injection via function parameter. No IO imports in this module;
/// the actual database query is injected at the composition root.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Row shape returned by the active sessions query. */
export interface ActiveSessionRow {
  readonly id: string;
  readonly startedAt: string;
}

/** Port: query function that returns active session rows. */
export type QueryActiveSessions = () => Promise<ReadonlyArray<ActiveSessionRow>>;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover active sessions by invoking the injected query function.
 *
 * Pure adapter: delegates to the query port and returns the result unchanged.
 */
export const discoverSessions = async (
  query: QueryActiveSessions,
): Promise<ReadonlyArray<ActiveSessionRow>> => query();
