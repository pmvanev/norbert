/**
 * Acceptance tests: Event and Channel Configuration (US-NOTIF-02)
 *
 * Validates preference management: default values match specification,
 * channel toggles update preferences, threshold validation, and
 * preference persistence semantics.
 *
 * Driving ports: validatePreferences, applyDefaultPreferences (pure functions)
 * Domain: preference validation, defaults, event registry
 *
 * Traces to: US-NOTIF-02 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  applyDefaultPreferences,
} from "../../../src/plugins/norbert-notif/domain/defaults";
import {
  validatePreferences,
  validateThreshold,
} from "../../../src/plugins/norbert-notif/domain/preferenceValidator";
import {
  type NotificationPreferences,
  type EventPreference,
} from "../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Default Values
// ---------------------------------------------------------------------------

describe("Default preferences match product specification", () => {
  it("first-launch defaults have correct channel toggles and sounds per event", () => {
    // Given a user opens Notification Events settings for the first time
    // When default preferences are generated
    const defaults = applyDefaultPreferences();

    // Then "Session response completed" has Toast enabled, sound "phosphor-ping"
    const sessionCompleted = defaults.events.find(
      (e) => e.eventId === "session_response_completed"
    )!;
    expect(sessionCompleted.channels.toast).toBe(true);
    expect(sessionCompleted.channels.banner).toBe(false);
    expect(sessionCompleted.sound).toBe("phosphor-ping");

    // And "Session started" has all channels disabled, sound "silence"
    const sessionStarted = defaults.events.find(
      (e) => e.eventId === "session_started"
    )!;
    expect(sessionStarted.channels.toast).toBe(false);
    expect(sessionStarted.channels.banner).toBe(false);
    expect(sessionStarted.channels.badge).toBe(false);
    expect(sessionStarted.sound).toBe("silence");

    // And "Cost threshold reached" has Toast, Banner, Badge enabled, sound "amber-pulse"
    const costThreshold = defaults.events.find(
      (e) => e.eventId === "cost_threshold_reached"
    )!;
    expect(costThreshold.channels.toast).toBe(true);
    expect(costThreshold.channels.banner).toBe(true);
    expect(costThreshold.channels.badge).toBe(true);
    expect(costThreshold.sound).toBe("amber-pulse");
    expect(costThreshold.threshold).toBe(5.0);

    // And "Hook error detected" has Toast, Banner, Badge enabled, sound "des-block"
    const hookError = defaults.events.find(
      (e) => e.eventId === "hook_error_detected"
    )!;
    expect(hookError.channels.toast).toBe(true);
    expect(hookError.channels.banner).toBe(true);
    expect(hookError.channels.badge).toBe(true);
    expect(hookError.sound).toBe("des-block");

    // And global volume defaults to 100%
    expect(defaults.globalVolume).toBe(100);
  });
});

describe("Enable banner channel for an event updates preferences", () => {
  it("toggling banner on for session completion reflects in validated preferences", () => {
    // Given "Session response completed" has Toast enabled and Banner disabled
    const prefs: NotificationPreferences = {
      version: 1,
      events: [
        {
          eventId: "session_response_completed",
          channels: { toast: true, banner: true, badge: false, email: false, webhook: false },
          sound: "phosphor-ping",
          threshold: null,
        },
      ],
      globalVolume: 100,
    };

    // When the preferences are validated
    const result = validatePreferences(prefs);

    // Then the preferences are valid
    expect(result.ok).toBe(true);

    // And the banner channel is enabled for session completion
    if (result.ok) {
      const event = result.value.events.find(
        (e) => e.eventId === "session_response_completed"
      )!;
      expect(event.channels.banner).toBe(true);
    }
  });
});

describe("Change cost threshold to $25.00", () => {
  it("threshold value of 25.00 passes validation for cost event", () => {
    // Given the cost threshold is currently $5.00
    // When the user changes the threshold to $25.00
    const result = validateThreshold(25.0, "$");

    // Then the threshold is valid
    expect(result.ok).toBe(true);

    // And the validated value is 25.00
    if (result.ok) {
      expect(result.value).toBe(25.0);
    }
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Invalid threshold value rejected with validation error", () => {
  it("negative threshold returns validation error", () => {
    // Given the user is editing the cost threshold
    // When the user enters "-5"
    const result = validateThreshold(-5, "$");

    // Then validation fails
    expect(result.ok).toBe(false);

    // And the error message indicates threshold must be positive
    if (!result.ok) {
      expect(result.error).toContain("positive");
    }
  });
});

describe("Context window threshold validates range 1-99%", () => {
  it("threshold outside 1-99 range is rejected", () => {
    // Given the user is editing the context window threshold
    // When the user enters 0%
    const zeroResult = validateThreshold(0, "%");
    expect(zeroResult.ok).toBe(false);

    // And when the user enters 100%
    const hundredResult = validateThreshold(100, "%");
    expect(hundredResult.ok).toBe(false);

    // And when the user enters 75% (valid)
    const validResult = validateThreshold(75, "%");
    expect(validResult.ok).toBe(true);
  });
});

describe("Threshold must be a positive number (zero rejected)", () => {
  it("zero value is rejected for cost threshold", () => {
    // Given the user is editing the cost threshold
    // When the user enters 0
    const result = validateThreshold(0, "$");

    // Then validation fails
    expect(result.ok).toBe(false);

    // And the error indicates threshold must be positive
    if (!result.ok) {
      expect(result.error).toContain("positive");
    }
  });
});
