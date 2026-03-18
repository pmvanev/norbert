/**
 * Unit tests: Session Discovery adapter (Step 01-01)
 *
 * Polls a sessions query function to discover active sessions.
 * Port: QueryActiveSessions = () => Promise<ReadonlyArray<{ id: string; startedAt: string }>>
 *
 * Behaviors tested:
 * - discoverSessions returns session IDs from query result
 * - Empty query result yields empty array
 * - Session IDs are passed through unchanged
 */

import { describe, it, expect } from "vitest";
import {
  discoverSessions,
  type ActiveSessionRow,
} from "../../../../../src/plugins/norbert-usage/adapters/sessionDiscovery";

// ---------------------------------------------------------------------------
// Stubs (pure functions satisfying the port signature)
// ---------------------------------------------------------------------------

const stubQueryEmpty = async (): Promise<ReadonlyArray<ActiveSessionRow>> => [];

const stubQuerySessions = (
  rows: ReadonlyArray<ActiveSessionRow>,
) => async (): Promise<ReadonlyArray<ActiveSessionRow>> => rows;

// ---------------------------------------------------------------------------
// Discovery behavior
// ---------------------------------------------------------------------------

describe("sessionDiscovery", () => {
  it("returns empty array when no active sessions", async () => {
    const result = await discoverSessions(stubQueryEmpty);
    expect(result).toEqual([]);
  });

  it("returns session IDs from query result", async () => {
    const rows: ReadonlyArray<ActiveSessionRow> = [
      { id: "session-1", startedAt: "2026-03-18T10:00:00Z" },
      { id: "session-2", startedAt: "2026-03-18T11:00:00Z" },
    ];

    const result = await discoverSessions(stubQuerySessions(rows));
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("session-1");
    expect(result[1].id).toBe("session-2");
  });

  it("preserves session data unchanged", async () => {
    const rows: ReadonlyArray<ActiveSessionRow> = [
      { id: "alpha", startedAt: "2026-01-01T00:00:00Z" },
    ];

    const result = await discoverSessions(stubQuerySessions(rows));
    expect(result).toEqual(rows);
  });
});
