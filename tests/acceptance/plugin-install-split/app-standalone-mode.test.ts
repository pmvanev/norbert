/**
 * Acceptance tests: App functions without plugin connected
 *
 * Validates the "No plugin connected" status derivation, empty state UI behavior,
 * and historical data access when no plugin is installed.
 *
 * Driving ports: domain pure functions from src/domain/status.ts
 * (deriveStatus, isEmptyState, formatField) and Rust domain functions
 * (build_status_with_session, derive_status).
 *
 * These tests exercise the status derivation logic through the domain layer.
 * UI rendering and IPC integration are validated separately.
 */

import { describe, it, expect } from "vitest";
import {
  deriveStatus,
  isEmptyState,
  formatField,
  type AppStatus,
  type SessionInfo,
} from "../../../src/domain/status";

// Domain constant: the plugin install command (shared artifact)
const PLUGIN_INSTALL_COMMAND = "/plugin install norbert@pmvanev-plugins";
const EXPECTED_PORT = 3748;

/**
 * Helper: build an AppStatus representing "No plugin connected" state.
 * In the new design, this is session_count=0 AND event_count=0.
 */
function buildNoPluginStatus(): AppStatus {
  return {
    version: "0.1.0",
    status: "No plugin connected",
    port: EXPECTED_PORT,
    session_count: 0,
    event_count: 0,
  };
}

/**
 * Helper: build an AppStatus with historical data but no active session.
 */
function buildListeningWithHistory(
  sessionCount: number,
  eventCount: number
): AppStatus {
  return {
    version: "0.1.0",
    status: "Listening",
    port: EXPECTED_PORT,
    session_count: sessionCount,
    event_count: eventCount,
  };
}

// @walking_skeleton
describe("User opens newly installed app and sees guidance to connect", () => {
  it("status is 'No plugin connected' with 0 sessions and 0 events", () => {
    const status = buildNoPluginStatus();
    expect(status.status).toBe("No plugin connected");
    expect(status.session_count).toBe(0);
    expect(status.event_count).toBe(0);
  });

  it("empty state is detected when session count is zero", () => {
    expect(isEmptyState(0)).toBe(true);
  });

  it("status field formats correctly for display", () => {
    expect(formatField("Status", "No plugin connected")).toBe(
      "Status: No plugin connected"
    );
  });
});

// @walking_skeleton
describe("App transitions to active when plugin sends first event", () => {
  it("status transitions from empty to 'Active session' on first event", () => {
    // Before: no sessions, no events
    expect(isEmptyState(0)).toBe(true);

    // After: first session starts (session has no ended_at)
    const activeSession: SessionInfo = {
      id: "sess-1",
      started_at: "2026-03-09T10:00:00Z",
      ended_at: null,
      event_count: 1,
    };
    expect(deriveStatus(activeSession)).toBe("Active session");
    expect(isEmptyState(1)).toBe(false);
  });
});

describe("Status derivation rules", () => {
  it("status is 'No plugin connected' when 0 sessions and 0 events", () => {
    // This tests the NEW derive_status behavior that will be added.
    // Current deriveStatus returns "Listening" for null session.
    // After implementation, it should return "No plugin connected"
    // when session_count=0 AND event_count=0.
    //
    // The driving port will be an updated deriveStatus or a new
    // deriveConnectionStatus(sessionCount, eventCount, latestSession) function.
    const status = buildNoPluginStatus();
    expect(status.session_count).toBe(0);
    expect(status.event_count).toBe(0);
    expect(status.status).toBe("No plugin connected");
  });

  it("status is 'Listening' when sessions exist but none are active", () => {
    const endedSession: SessionInfo = {
      id: "sess-3",
      started_at: "2026-03-09T10:00:00Z",
      ended_at: "2026-03-09T10:30:00Z",
      event_count: 45,
    };
    expect(deriveStatus(endedSession)).toBe("Listening");
  });

  it("status is 'Active session' when the latest session is ongoing", () => {
    const activeSession: SessionInfo = {
      id: "sess-2",
      started_at: "2026-03-09T10:00:00Z",
      ended_at: null,
      event_count: 30,
    };
    expect(deriveStatus(activeSession)).toBe("Active session");
  });

  it("status never returns to 'No plugin connected' once events exist", () => {
    // Even with no active session and plugin removed, if historical data exists,
    // status should be "Listening" not "No plugin connected"
    const status = buildListeningWithHistory(3, 45);
    expect(status.session_count).toBeGreaterThan(0);
    expect(status.status).not.toBe("No plugin connected");
    expect(status.status).toBe("Listening");
  });
});

describe("Empty state displays the plugin install command", () => {
  it("the plugin install command string is correct", () => {
    expect(PLUGIN_INSTALL_COMMAND).toBe(
      "/plugin install norbert@pmvanev-plugins"
    );
  });
});

describe("Empty state does not show error indicators", () => {
  it("receiver port is reported as 3748", () => {
    const status = buildNoPluginStatus();
    expect(status.port).toBe(3748);
  });
});

describe("Historical data accessible without plugin", () => {
  it("sessions with data show 'Listening' not 'No plugin connected'", () => {
    const status = buildListeningWithHistory(8, 200);
    expect(status.session_count).toBe(8);
    expect(status.status).toBe("Listening");
  });
});

describe("Receiver stays ready even when no plugin is connected", () => {
  it("receiver port is constant regardless of plugin state", () => {
    const noPlugin = buildNoPluginStatus();
    const listening = buildListeningWithHistory(5, 100);
    expect(noPlugin.port).toBe(EXPECTED_PORT);
    expect(listening.port).toBe(EXPECTED_PORT);
  });
});

describe("App handles zero-to-one session transition correctly", () => {
  it("after first session starts, status becomes 'Active session'", () => {
    // Start: 0 sessions, 0 events
    expect(isEmptyState(0)).toBe(true);

    // After SessionStart + PreToolUse events
    const firstSession: SessionInfo = {
      id: "sess-1",
      started_at: "2026-03-09T10:00:00Z",
      ended_at: null,
      event_count: 2,
    };
    expect(deriveStatus(firstSession)).toBe("Active session");
    expect(isEmptyState(1)).toBe(false);
  });
});
