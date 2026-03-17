/// Unit tests: Default notification preferences
///
/// Validates that applyDefaultPreferences produces correct channel toggles,
/// sounds, and threshold values for all 14 notification events per the
/// product specification.
///
/// Pure function tests -- no side effects, no adapters.

import { describe, it, expect } from "vitest";
import {
  applyDefaultPreferences,
  DEFAULT_PREFERENCES,
} from "../../../src/plugins/norbert-notif/domain/defaults";
import type { NotificationEventId } from "../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// All 14 events have default preferences
// ---------------------------------------------------------------------------

describe("All 14 events have default preferences", () => {
  const ALL_EVENT_IDS: readonly NotificationEventId[] = [
    "session_response_completed",
    "session_started",
    "context_compaction_occurred",
    "token_count_threshold",
    "cost_threshold_reached",
    "context_window_threshold",
    "hook_error_detected",
    "hook_timeout",
    "des_enforcement_block",
    "agent_spawned",
    "agent_completed",
    "anomaly_detected",
    "session_digest_ready",
    "credit_balance_low",
  ] as const;

  it("produces exactly 14 event preferences", () => {
    const defaults = applyDefaultPreferences();
    expect(defaults.events).toHaveLength(14);
  });

  it("every event ID in the type system has a default preference entry", () => {
    const defaults = applyDefaultPreferences();
    const defaultEventIds = defaults.events.map((e) => e.eventId);
    for (const eventId of ALL_EVENT_IDS) {
      expect(defaultEventIds).toContain(eventId);
    }
  });
});

// ---------------------------------------------------------------------------
// Enabled events have correct channel defaults
// ---------------------------------------------------------------------------

describe("Enabled events have correct channel and sound defaults", () => {
  it("session_response_completed: toast on, banner off, badge off, sound phosphor-ping", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "session_response_completed"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(false);
    expect(event.channels.badge).toBe(false);
    expect(event.channels.email).toBe(false);
    expect(event.channels.webhook).toBe(false);
    expect(event.sound).toBe("phosphor-ping");
    expect(event.threshold).toBeNull();
  });

  it("context_compaction_occurred: toast on, sound compaction", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "context_compaction_occurred"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(false);
    expect(event.channels.badge).toBe(false);
    expect(event.sound).toBe("compaction");
    expect(event.threshold).toBeNull();
  });

  it("cost_threshold_reached: toast+banner+badge on, sound amber-pulse, threshold $5.00", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "cost_threshold_reached"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(true);
    expect(event.channels.badge).toBe(true);
    expect(event.sound).toBe("amber-pulse");
    expect(event.threshold).toBe(5.0);
  });

  it("context_window_threshold: toast+banner+badge on, sound amber-pulse, threshold 75%", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "context_window_threshold"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(true);
    expect(event.channels.badge).toBe(true);
    expect(event.sound).toBe("amber-pulse");
    expect(event.threshold).toBe(75);
  });

  it("hook_error_detected: toast+banner+badge on, sound des-block", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "hook_error_detected"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(true);
    expect(event.channels.badge).toBe(true);
    expect(event.sound).toBe("des-block");
    expect(event.threshold).toBeNull();
  });

  it("hook_timeout: toast+banner+badge on, sound des-block", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "hook_timeout"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(true);
    expect(event.channels.badge).toBe(true);
    expect(event.sound).toBe("des-block");
    expect(event.threshold).toBeNull();
  });

  it("des_enforcement_block: toast+banner+badge on, sound des-block", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "des_enforcement_block"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(true);
    expect(event.channels.badge).toBe(true);
    expect(event.sound).toBe("des-block");
    expect(event.threshold).toBeNull();
  });

  it("anomaly_detected: toast+banner+badge on, sound amber-pulse", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "anomaly_detected"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(true);
    expect(event.channels.badge).toBe(true);
    expect(event.sound).toBe("amber-pulse");
    expect(event.threshold).toBeNull();
  });

  it("credit_balance_low: toast+banner+badge on, sound amber-pulse", () => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find(
      (e) => e.eventId === "credit_balance_low"
    )!;
    expect(event.channels.toast).toBe(true);
    expect(event.channels.banner).toBe(true);
    expect(event.channels.badge).toBe(true);
    expect(event.sound).toBe("amber-pulse");
    expect(event.threshold).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Disabled events have all channels off with silence
// ---------------------------------------------------------------------------

describe("Disabled events default to all channels off with silence", () => {
  const DISABLED_EVENTS: readonly NotificationEventId[] = [
    "session_started",
    "token_count_threshold",
    "agent_spawned",
    "agent_completed",
    "session_digest_ready",
  ];

  it.each(DISABLED_EVENTS)("%s: all channels off, sound silence", (eventId) => {
    const defaults = applyDefaultPreferences();
    const event = defaults.events.find((e) => e.eventId === eventId)!;
    expect(event).toBeDefined();
    expect(event.channels.toast).toBe(false);
    expect(event.channels.banner).toBe(false);
    expect(event.channels.badge).toBe(false);
    expect(event.channels.email).toBe(false);
    expect(event.channels.webhook).toBe(false);
    expect(event.sound).toBe("silence");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_PREFERENCES constant
// ---------------------------------------------------------------------------

describe("DEFAULT_PREFERENCES constant", () => {
  it("is identical to applyDefaultPreferences() output", () => {
    expect(DEFAULT_PREFERENCES).toEqual(applyDefaultPreferences());
  });

  it("has globalVolume of 100", () => {
    expect(DEFAULT_PREFERENCES.globalVolume).toBe(100);
  });

  it("has version 1", () => {
    expect(DEFAULT_PREFERENCES.version).toBe(1);
  });
});
