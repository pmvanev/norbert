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
  const ENABLED_EVENTS: readonly {
    eventId: NotificationEventId;
    toast: boolean;
    banner: boolean;
    badge: boolean;
    email: boolean;
    webhook: boolean;
    sound: string;
    threshold: number | null;
  }[] = [
    { eventId: "session_response_completed", toast: true, banner: false, badge: false, email: false, webhook: false, sound: "phosphor-ping", threshold: null },
    { eventId: "context_compaction_occurred", toast: true, banner: false, badge: false, email: false, webhook: false, sound: "compaction", threshold: null },
    { eventId: "cost_threshold_reached", toast: true, banner: true, badge: true, email: false, webhook: false, sound: "amber-pulse", threshold: 5.0 },
    { eventId: "context_window_threshold", toast: true, banner: true, badge: true, email: false, webhook: false, sound: "amber-pulse", threshold: 75 },
    { eventId: "hook_error_detected", toast: true, banner: true, badge: true, email: false, webhook: false, sound: "des-block", threshold: null },
    { eventId: "hook_timeout", toast: true, banner: true, badge: true, email: false, webhook: false, sound: "des-block", threshold: null },
    { eventId: "des_enforcement_block", toast: true, banner: true, badge: true, email: false, webhook: false, sound: "des-block", threshold: null },
    { eventId: "anomaly_detected", toast: true, banner: true, badge: true, email: false, webhook: false, sound: "amber-pulse", threshold: null },
    { eventId: "credit_balance_low", toast: true, banner: true, badge: true, email: false, webhook: false, sound: "amber-pulse", threshold: null },
  ] as const;

  it.each(ENABLED_EVENTS)(
    "$eventId: correct channel toggles, sound $sound, threshold $threshold",
    ({ eventId, toast, banner, badge, email, webhook, sound, threshold }) => {
      const defaults = applyDefaultPreferences();
      const event = defaults.events.find((e) => e.eventId === eventId)!;
      expect(event).toBeDefined();
      expect(event.channels.toast).toBe(toast);
      expect(event.channels.banner).toBe(banner);
      expect(event.channels.badge).toBe(badge);
      expect(event.channels.email).toBe(email);
      expect(event.channels.webhook).toBe(webhook);
      expect(event.sound).toBe(sound);
      expect(event.threshold).toBe(threshold);
    }
  );
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

