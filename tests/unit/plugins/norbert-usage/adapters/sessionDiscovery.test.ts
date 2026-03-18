/**
 * Unit tests: Session Discovery adapter (Step 01-01)
 *
 * Smoke test for the pass-through adapter. discoverSessions delegates
 * to the injected query function and returns the result unchanged.
 * A single test suffices since the adapter contains no logic.
 *
 * Port: QueryActiveSessions = () => Promise<ReadonlyArray<{ id: string; startedAt: string }>>
 */

import { describe, it, expect } from "vitest";
import {
  discoverSessions,
  type ActiveSessionRow,
} from "../../../../../src/plugins/norbert-usage/adapters/sessionDiscovery";

describe("sessionDiscovery", () => {
  it("delegates to query function and returns result unchanged", async () => {
    const rows: ReadonlyArray<ActiveSessionRow> = [
      { id: "session-1", startedAt: "2026-03-18T10:00:00Z" },
      { id: "session-2", startedAt: "2026-03-18T11:00:00Z" },
    ];
    const stubQuery = async () => rows;

    const result = await discoverSessions(stubQuery);
    expect(result).toEqual(rows);
  });
});
