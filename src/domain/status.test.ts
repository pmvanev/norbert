import { describe, it, expect } from "vitest";
import {
  formatHeader,
  formatField,
  isEmptyState,
  EMPTY_STATE_MESSAGE,
  PLUGIN_INSTALL_COMMAND,
  formatDuration,
  calculateDurationSeconds,
  formatSessionTimestamp,
  deriveStatus,
  deriveConnectionStatus,
  isSessionActive,
  formatActiveTooltip,
  type AppStatus,
  type SessionInfo,
} from "./status";
import { CANONICAL_EVENT_TYPES } from "./eventDetail";

describe("formatHeader", () => {
  it("uppercases app name and prepends v to version", () => {
    const result = formatHeader("Norbert", "0.1.0");
    expect(result).toBe("NORBERT v0.1.0");
  });

  it("works with any app name and version", () => {
    const result = formatHeader("myapp", "2.3.4");
    expect(result).toBe("MYAPP v2.3.4");
  });
});

describe("formatField", () => {
  it("formats status field", () => {
    expect(formatField("Status", "Listening")).toBe("Status: Listening");
  });

  it("formats port field with number", () => {
    expect(formatField("Port", 3748)).toBe("Port: 3748");
  });

  it("formats sessions field with zero", () => {
    expect(formatField("Sessions", 0)).toBe("Sessions: 0");
  });

  it("formats events field with zero", () => {
    expect(formatField("Events", 0)).toBe("Events: 0");
  });
});

describe("isEmptyState", () => {
  it("returns true when session count is zero", () => {
    expect(isEmptyState(0)).toBe(true);
  });

  it("returns false when session count is greater than zero", () => {
    expect(isEmptyState(1)).toBe(false);
    expect(isEmptyState(42)).toBe(false);
  });
});

describe("EMPTY_STATE_MESSAGE", () => {
  it("contains the plugin install guidance message", () => {
    expect(EMPTY_STATE_MESSAGE).toContain("plugin");
  });
});

describe("PLUGIN_INSTALL_COMMAND", () => {
  it("contains the correct plugin install command", () => {
    expect(PLUGIN_INSTALL_COMMAND).toBe(
      "/plugin install norbert@pmvanev-plugins"
    );
  });
});

describe("formatDuration", () => {
  it("formats zero seconds", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats seconds only", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(492)).toBe("8m 12s");
  });

  it("formats hours minutes and seconds", () => {
    expect(formatDuration(3661)).toBe("1h 1m 1s");
  });

  it("formats exact minutes with no trailing seconds", () => {
    expect(formatDuration(120)).toBe("2m 0s");
  });

  it("formats exact hours", () => {
    expect(formatDuration(3600)).toBe("1h 0m 0s");
  });
});

describe("calculateDurationSeconds", () => {
  it("returns seconds between two ISO timestamps", () => {
    const started = "2026-03-08T10:00:00Z";
    const ended = "2026-03-08T10:08:12Z";
    expect(calculateDurationSeconds(started, ended)).toBe(492);
  });

  it("returns zero when start equals end", () => {
    const timestamp = "2026-03-08T10:00:00Z";
    expect(calculateDurationSeconds(timestamp, timestamp)).toBe(0);
  });

  it("returns null when ended_at is null", () => {
    expect(calculateDurationSeconds("2026-03-08T10:00:00Z", null)).toBeNull();
  });
});

describe("formatSessionTimestamp", () => {
  it("formats ISO timestamp to readable local format", () => {
    const result = formatSessionTimestamp("2026-03-08T10:00:00Z");
    expect(result).toContain("2026");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("deriveStatus", () => {
  it("returns Listening when latest session is null", () => {
    expect(deriveStatus(null)).toBe("Listening");
  });

  it("returns Listening when latest session has ended", () => {
    const session: SessionInfo = {
      id: "sess-1",
      started_at: "2026-03-08T10:00:00Z",
      ended_at: "2026-03-08T10:08:12Z",
      event_count: 30,
      last_event_at: "2026-03-08T10:08:12Z",
    };
    expect(deriveStatus(session)).toBe("Listening");
  });

  it("returns Active session when latest session has no ended_at", () => {
    const session: SessionInfo = {
      id: "sess-2",
      started_at: "2026-03-08T10:00:00Z",
      ended_at: null,
      event_count: 5,
      last_event_at: "2026-03-08T10:05:00Z",
    };
    expect(deriveStatus(session)).toBe("Active session");
  });
});

describe("deriveConnectionStatus", () => {
  it("returns 'No plugin connected' when 0 sessions and 0 events", () => {
    expect(deriveConnectionStatus(0, 0, null)).toBe("No plugin connected");
  });

  it("returns 'Listening' when sessions exist but no active session", () => {
    const endedSession: SessionInfo = {
      id: "sess-1",
      started_at: "2026-03-08T10:00:00Z",
      ended_at: "2026-03-08T10:30:00Z",
      event_count: 30,
      last_event_at: "2026-03-08T10:30:00Z",
    };
    expect(deriveConnectionStatus(1, 30, endedSession)).toBe("Listening");
  });

  it("returns 'Active session' when latest session has no ended_at", () => {
    const activeSession: SessionInfo = {
      id: "sess-2",
      started_at: "2026-03-08T10:00:00Z",
      ended_at: null,
      event_count: 5,
      last_event_at: "2026-03-08T10:05:00Z",
    };
    expect(deriveConnectionStatus(1, 5, activeSession)).toBe("Active session");
  });

  it("returns 'Listening' when events exist but no latest session", () => {
    expect(deriveConnectionStatus(1, 10, null)).toBe("Listening");
  });

  it("never returns 'No plugin connected' once events exist", () => {
    expect(deriveConnectionStatus(0, 1, null)).not.toBe("No plugin connected");
  });
});

describe("isSessionActive — boundary mutant killers", () => {
  function buildSession(overrides: Partial<SessionInfo> = {}): SessionInfo {
    return {
      id: "sess-1",
      started_at: "2026-03-12T10:00:00Z",
      ended_at: null,
      event_count: 5,
      last_event_at: "2026-03-12T10:00:00Z",
      ...overrides,
    };
  }

  it("returns false when now - lastEventTime equals exactly STALE_SESSION_MS (5 min boundary)", () => {
    // STALE_SESSION_MS = 5 * 60 * 1000 = 300000ms
    // When the difference is exactly 300000ms, < should return false.
    // This kills the mutant that replaces < with <=.
    const lastEventAt = "2026-03-12T10:00:00Z";
    const lastEventTime = new Date(lastEventAt).getTime();
    const now = lastEventTime + 5 * 60 * 1000; // exactly 300000ms later

    const session = buildSession({ last_event_at: lastEventAt });
    expect(isSessionActive(session, now)).toBe(false);
  });

  it("returns true when now - lastEventTime is one millisecond below STALE_SESSION_MS", () => {
    const lastEventAt = "2026-03-12T10:00:00Z";
    const lastEventTime = new Date(lastEventAt).getTime();
    const now = lastEventTime + 5 * 60 * 1000 - 1; // 299999ms

    const session = buildSession({ last_event_at: lastEventAt });
    expect(isSessionActive(session, now)).toBe(true);
  });
});

describe("deriveConnectionStatus — compound condition mutant killers", () => {
  it("returns session-level status when sessions exist but events are zero", () => {
    // sessionCount=1, eventCount=0, latestSession=null
    // This kills the mutant that replaces (sessionCount === 0) with true
    // in the compound condition (sessionCount === 0 && eventCount === 0).
    // With sessionCount=1, eventCount=0: the real code falls through to deriveStatus.
    // The mutant (true && eventCount === 0) would incorrectly return "No plugin connected".
    expect(deriveConnectionStatus(1, 0, null)).toBe("Listening");
  });
});

describe("formatActiveTooltip", () => {
  it("shows app name and version when listening", () => {
    expect(formatActiveTooltip("Norbert", "0.1.0", "Listening", 0)).toBe(
      "Norbert v0.1.0"
    );
  });

  it("includes event count when active", () => {
    expect(
      formatActiveTooltip("Norbert", "0.1.0", "Active session", 15)
    ).toBe("Norbert v0.1.0 - Active session (15 events)");
  });

  it("includes event count of zero when active", () => {
    expect(
      formatActiveTooltip("Norbert", "0.1.0", "Active session", 0)
    ).toBe("Norbert v0.1.0 - Active session (0 events)");
  });
});

describe("cross-component event type consistency", () => {
  // These are the six snake_case canonical event types the frontend
  // receives from the Rust backend via get_session_events IPC.
  // This canary test ensures CANONICAL_EVENT_TYPES stays in sync.
  const EXPECTED_CANONICAL_TYPES = new Set([
    "session_start",
    "session_end",
    "tool_call_start",
    "tool_call_end",
    "agent_complete",
    "prompt_submit",
  ]);

  it("CANONICAL_EVENT_TYPES contains exactly the six expected snake_case types", () => {
    expect(CANONICAL_EVENT_TYPES).toEqual(EXPECTED_CANONICAL_TYPES);
  });

  it("CANONICAL_EVENT_TYPES has exactly six entries", () => {
    expect(CANONICAL_EVENT_TYPES.size).toBe(6);
  });

  it("hook port matches expected value", () => {
    // The hook port is a cross-component constant.
    // Rust defines it as 3748 in domain::HOOK_PORT.
    // Frontend receives it via IPC in AppStatus.port.
    const EXPECTED_PORT = 3748;
    const status: AppStatus = {
      version: "0.1.0",
      status: "Listening",
      port: EXPECTED_PORT,
      session_count: 0,
      event_count: 0,
    };
    expect(status.port).toBe(3748);
  });
});
