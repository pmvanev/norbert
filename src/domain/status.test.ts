import { describe, it, expect } from "vitest";
import {
  formatHeader,
  formatField,
  isEmptyState,
  EMPTY_STATE_MESSAGE,
  formatDuration,
  calculateDurationSeconds,
  formatSessionTimestamp,
  type AppStatus,
  type SessionInfo,
} from "./status";

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
  it("contains the expected waiting message", () => {
    expect(EMPTY_STATE_MESSAGE).toBe(
      "Waiting for first Claude Code session..."
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

describe("SessionInfo type", () => {
  it("represents a session with correct shape", () => {
    const session: SessionInfo = {
      id: "sess-1",
      started_at: "2026-03-08T10:00:00Z",
      ended_at: "2026-03-08T10:08:12Z",
      event_count: 30,
    };
    expect(session.id).toBe("sess-1");
    expect(session.started_at).toBe("2026-03-08T10:00:00Z");
    expect(session.ended_at).toBe("2026-03-08T10:08:12Z");
    expect(session.event_count).toBe(30);
  });

  it("allows null ended_at for active sessions", () => {
    const session: SessionInfo = {
      id: "sess-2",
      started_at: "2026-03-08T10:00:00Z",
      ended_at: null,
      event_count: 5,
    };
    expect(session.ended_at).toBeNull();
  });
});

describe("AppStatus type", () => {
  it("represents initial status with correct shape", () => {
    const status: AppStatus = {
      version: "0.1.0",
      status: "Listening",
      port: 3748,
      session_count: 0,
      event_count: 0,
    };

    expect(status.version).toBe("0.1.0");
    expect(status.status).toBe("Listening");
    expect(status.port).toBe(3748);
    expect(status.session_count).toBe(0);
    expect(status.event_count).toBe(0);
  });
});
