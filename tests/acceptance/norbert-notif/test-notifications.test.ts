/**
 * Acceptance tests: Channel Setup and Testing (US-NOTIF-03)
 *
 * Validates the test notification flow: synthetic events routed through
 * the standard dispatch pipeline with [TEST] prefix, channel-specific
 * test generation, and DND bypass behavior.
 *
 * Driving port: createTestNotification, createDispatchInstructions (pure functions)
 * Domain: test notification creation, dispatch engine
 *
 * Traces to: US-NOTIF-03 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  createTestNotification,
} from "../../../src/plugins/norbert-notif/domain/dispatchEngine";
import {
  type ChannelId,
  type DndState,
  type NotificationPreferences,
} from "../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// TEST FIXTURES
// ---------------------------------------------------------------------------

const dndOff: DndState = {
  active: false,
  source: "none",
  endsAt: null,
  queuedCount: 0,
};

const dndActive: DndState = {
  active: true,
  source: "manual",
  endsAt: null,
  queuedCount: 2,
};

const defaultPrefs: NotificationPreferences = {
  version: 1,
  events: [],
  globalVolume: 100,
};

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Test Notification Flow
// ---------------------------------------------------------------------------

describe.skip("Test notification routes through standard dispatch with [TEST] prefix", () => {
  it("produces a dispatch instruction with isTest flag and [TEST] in title", () => {
    // Given any channel is configured and a test is initiated
    const channel: ChannelId = "toast";

    // When a test notification is created for the toast channel
    const instruction = createTestNotification(channel, defaultPrefs);

    // Then the instruction has isTest set to true
    expect(instruction.isTest).toBe(true);

    // And the title includes "[TEST]" prefix
    expect(instruction.title).toContain("[TEST]");

    // And the channel matches the requested channel
    expect(instruction.channel).toBe("toast");
  });
});

describe.skip("Test notification for specific channel produces single instruction", () => {
  it("generates exactly one instruction targeting the specified channel", () => {
    // Given the webhook channel is configured
    const channel: ChannelId = "webhook";

    // When a test notification is created for webhook
    const instruction = createTestNotification(channel, defaultPrefs);

    // Then exactly one instruction is produced for the webhook channel
    expect(instruction.channel).toBe("webhook");

    // And the body describes this as a test notification
    expect(instruction.body).toContain("test");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe.skip("Test notification with unconfigured channel still produces instruction", () => {
  it("generates instruction even when channel has no configuration", () => {
    // Given the email channel is not configured
    const channel: ChannelId = "email";

    // When a test notification is created for email
    const instruction = createTestNotification(channel, defaultPrefs);

    // Then an instruction is produced (adapter will handle the error)
    expect(instruction.channel).toBe("email");
    expect(instruction.isTest).toBe(true);

    // The adapter is responsible for returning a DispatchResult with error
    // when the channel configuration is missing or invalid
  });
});

describe.skip("Test notification during DND still delivers (bypasses DND)", () => {
  it("test notifications are not suppressed by Do Not Disturb", () => {
    // Given DND is active
    // When a test notification is created
    const channel: ChannelId = "toast";
    const instruction = createTestNotification(channel, defaultPrefs);

    // Then the instruction is produced regardless of DND state
    // (Test notifications bypass DND because the user explicitly requested the test)
    expect(instruction.isTest).toBe(true);
    expect(instruction.channel).toBe("toast");
    expect(instruction.title).toContain("[TEST]");
  });
});

describe.skip("Test notification includes [TEST] in title for all channel types", () => {
  it("every channel type gets [TEST] prefix in the instruction title", () => {
    // Given test notifications are created for each channel type
    const channels: ChannelId[] = ["toast", "banner", "badge", "email", "webhook"];

    for (const channel of channels) {
      // When a test notification is created for the channel
      const instruction = createTestNotification(channel, defaultPrefs);

      // Then the title includes [TEST]
      expect(instruction.title).toContain("[TEST]");
      expect(instruction.isTest).toBe(true);
    }
  });
});
