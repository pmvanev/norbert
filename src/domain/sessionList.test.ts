import { describe, it, expect } from "vitest";
import {
  isSessionActive,
  sortSessionsMostRecentFirst,
  formatSessionDuration,
  type SessionInfo,
} from "./status";

/// Helper to build a SessionInfo for tests.
function buildSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: "sess-1",
    started_at: "2026-03-12T10:00:00Z",
    ended_at: "2026-03-12T10:08:12Z",
    event_count: 30,
    ...overrides,
  };
}

describe("isSessionActive", () => {
  it("returns true when ended_at is null", () => {
    const session = buildSession({ ended_at: null });
    expect(isSessionActive(session)).toBe(true);
  });

  it("returns false when ended_at is a timestamp", () => {
    const session = buildSession({ ended_at: "2026-03-12T10:08:12Z" });
    expect(isSessionActive(session)).toBe(false);
  });
});

describe("sortSessionsMostRecentFirst", () => {
  it("returns empty array for empty input", () => {
    expect(sortSessionsMostRecentFirst([])).toEqual([]);
  });

  it("returns single session unchanged", () => {
    const sessions = [buildSession()];
    expect(sortSessionsMostRecentFirst(sessions)).toEqual(sessions);
  });

  it("sorts sessions by started_at descending", () => {
    const older = buildSession({ id: "old", started_at: "2026-03-12T08:00:00Z" });
    const newer = buildSession({ id: "new", started_at: "2026-03-12T12:00:00Z" });
    const middle = buildSession({ id: "mid", started_at: "2026-03-12T10:00:00Z" });

    const sorted = sortSessionsMostRecentFirst([older, newer, middle]);

    expect(sorted.map((s) => s.id)).toEqual(["new", "mid", "old"]);
  });

  it("does not mutate the original array", () => {
    const older = buildSession({ id: "old", started_at: "2026-03-12T08:00:00Z" });
    const newer = buildSession({ id: "new", started_at: "2026-03-12T12:00:00Z" });
    const original = [older, newer];
    const originalCopy = [...original];

    sortSessionsMostRecentFirst(original);

    expect(original).toEqual(originalCopy);
  });
});

describe("formatSessionDuration", () => {
  it("returns 'Active' for a session with no ended_at", () => {
    const session = buildSession({ ended_at: null });
    expect(formatSessionDuration(session)).toBe("Active");
  });

  it("returns formatted duration for a completed session", () => {
    const session = buildSession({
      started_at: "2026-03-12T10:00:00Z",
      ended_at: "2026-03-12T10:08:12Z",
    });
    expect(formatSessionDuration(session)).toBe("8m 12s");
  });

  it("returns '0s' when start and end are equal", () => {
    const session = buildSession({
      started_at: "2026-03-12T10:00:00Z",
      ended_at: "2026-03-12T10:00:00Z",
    });
    expect(formatSessionDuration(session)).toBe("0s");
  });

  it("returns hours for long sessions", () => {
    const session = buildSession({
      started_at: "2026-03-12T10:00:00Z",
      ended_at: "2026-03-12T11:01:01Z",
    });
    expect(formatSessionDuration(session)).toBe("1h 1m 1s");
  });
});
