/// Unit tests for norbert-notif dispatch engine.
///
/// Tests the pure dispatch pipeline: given a hook event, user preferences,
/// and DND state, produce dispatch instructions for enabled channels.
///
/// The dispatch engine is a pure function with no side effects.

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createDispatchInstructions } from "./dispatchEngine";
import type {
  NotificationPreferences,
  EventPreference,
  ChannelId,
  ChannelToggles,
  NotificationEventId,
} from "./types";

// ---------------------------------------------------------------------------
// SHARED FIXTURES
// ---------------------------------------------------------------------------

const makePreferences = (
  events: EventPreference[],
  globalVolume = 80
): NotificationPreferences => ({
  version: 1,
  events,
  globalVolume,
});

const makeEventPreference = (
  overrides: Partial<EventPreference> & { eventId: EventPreference["eventId"] }
): EventPreference => ({
  channels: { toast: false, banner: false, badge: false, email: false, webhook: false },
  sound: "silence",
  threshold: null,
  ...overrides,
});

// ---------------------------------------------------------------------------
// DISPATCH INSTRUCTION GENERATION
// ---------------------------------------------------------------------------

describe("createDispatchInstructions", () => {
  it("produces one instruction per enabled channel", () => {
    const prefs = makePreferences([
      makeEventPreference({
        eventId: "session_response_completed",
        channels: { toast: true, banner: true, badge: false, email: false, webhook: false },
        sound: "phosphor-ping",
      }),
    ]);

    const event = {
      hookName: "session-event",
      eventType: "session_response_completed",
      payload: { sessionName: "test-session" },
    };

    const instructions = createDispatchInstructions(event, prefs);
    const channels = instructions.map((i) => i.channel);
    expect(channels).toContain("toast");
    expect(channels).toContain("banner");
    expect(channels).not.toContain("badge");
    expect(instructions).toHaveLength(2);
  });

  it("returns empty array when no channels enabled for event", () => {
    const prefs = makePreferences([
      makeEventPreference({
        eventId: "session_started",
        channels: { toast: false, banner: false, badge: false, email: false, webhook: false },
      }),
    ]);

    const event = {
      hookName: "session-event",
      eventType: "session_started",
      payload: { sessionName: "test" },
    };

    const instructions = createDispatchInstructions(event, prefs);
    expect(instructions).toHaveLength(0);
  });

  it("returns empty array for unknown event type", () => {
    const prefs = makePreferences([
      makeEventPreference({ eventId: "session_response_completed" }),
    ]);

    const event = {
      hookName: "session-event",
      eventType: "unknown_event_xyz",
      payload: {},
    };

    const instructions = createDispatchInstructions(event, prefs);
    expect(instructions).toHaveLength(0);
  });

  it("applies globalVolume to all instructions", () => {
    const prefs = makePreferences(
      [
        makeEventPreference({
          eventId: "session_response_completed",
          channels: { toast: true, banner: false, badge: false, email: false, webhook: false },
          sound: "phosphor-ping",
        }),
      ],
      60
    );

    const event = {
      hookName: "session-event",
      eventType: "session_response_completed",
      payload: { sessionName: "test" },
    };

    const instructions = createDispatchInstructions(event, prefs);
    expect(instructions[0].volume).toBe(60);
  });

  it("sets isTest to false for normal events", () => {
    const prefs = makePreferences([
      makeEventPreference({
        eventId: "session_response_completed",
        channels: { toast: true, banner: false, badge: false, email: false, webhook: false },
        sound: "phosphor-ping",
      }),
    ]);

    const event = {
      hookName: "session-event",
      eventType: "session_response_completed",
      payload: { sessionName: "test" },
    };

    const instructions = createDispatchInstructions(event, prefs);
    expect(instructions[0].isTest).toBe(false);
  });

  it("sets sound to null for badge channel", () => {
    const prefs = makePreferences([
      makeEventPreference({
        eventId: "session_response_completed",
        channels: { toast: false, banner: false, badge: true, email: false, webhook: false },
        sound: "phosphor-ping",
      }),
    ]);

    const event = {
      hookName: "session-event",
      eventType: "session_response_completed",
      payload: { sessionName: "test" },
    };

    const instructions = createDispatchInstructions(event, prefs);
    expect(instructions[0].channel).toBe("badge");
    expect(instructions[0].sound).toBeNull();
  });

  it("includes eventId on every instruction", () => {
    const prefs = makePreferences([
      makeEventPreference({
        eventId: "cost_threshold_reached",
        channels: { toast: true, banner: true, badge: true, email: false, webhook: false },
        sound: "amber-pulse",
        threshold: 25.0,
      }),
    ]);

    const event = {
      hookName: "usage-event",
      eventType: "cost_threshold_reached",
      payload: { sessionName: "api-refactor", cost: 25.12, threshold: 25.0 },
    };

    const instructions = createDispatchInstructions(event, prefs);
    for (const instruction of instructions) {
      expect(instruction.eventId).toBe("cost_threshold_reached");
    }
  });

  it("includes payload data in metadata", () => {
    const prefs = makePreferences([
      makeEventPreference({
        eventId: "session_response_completed",
        channels: { toast: true, banner: false, badge: false, email: false, webhook: false },
        sound: "phosphor-ping",
      }),
    ]);

    const event = {
      hookName: "session-event",
      eventType: "session_response_completed",
      payload: { sessionName: "project-alpha", duration: "4m 32s", cost: 5.12 },
    };

    const instructions = createDispatchInstructions(event, prefs);
    expect(instructions[0].metadata).toEqual({
      sessionName: "project-alpha",
      duration: "4m 32s",
      cost: 5.12,
    });
  });

  // -------------------------------------------------------------------------
  // Step 02-04: Disabled events and channel independence
  // -------------------------------------------------------------------------

  it("disabled event produces no dispatch instructions", () => {
    const prefs = makePreferences([
      makeEventPreference({
        eventId: "agent_spawned",
        channels: { toast: false, banner: false, badge: false, email: false, webhook: false },
      }),
      makeEventPreference({
        eventId: "agent_completed",
        channels: { toast: false, banner: false, badge: false, email: false, webhook: false },
      }),
    ]);

    const event = {
      hookName: "agent-event",
      eventType: "agent_spawned",
      payload: { sessionName: "disabled-test" },
    };

    const instructions = createDispatchInstructions(event, prefs);
    expect(instructions).toHaveLength(0);
  });

  it("dispatch produces independent instructions per channel", () => {
    const prefs = makePreferences([
      makeEventPreference({
        eventId: "cost_threshold_reached",
        channels: { toast: true, banner: true, badge: true, email: false, webhook: false },
        sound: "amber-pulse",
        threshold: 10.0,
      }),
    ]);

    const event = {
      hookName: "usage-event",
      eventType: "cost_threshold_reached",
      payload: { sessionName: "cost-session", cost: 12.50, threshold: 10.0 },
    };

    const instructions = createDispatchInstructions(event, prefs);
    expect(instructions).toHaveLength(3);

    // Each instruction is self-contained with channel, title, body, and event ID
    for (const instruction of instructions) {
      expect(instruction.channel).toBeDefined();
      expect(instruction.title).toBeTruthy();
      expect(instruction.body).toBeTruthy();
      expect(instruction.eventId).toBe("cost_threshold_reached");
      expect(instruction.timestamp).toBeDefined();
    }

    // All three enabled channels are represented
    const channels = instructions.map((i) => i.channel);
    expect(channels).toContain("toast");
    expect(channels).toContain("banner");
    expect(channels).toContain("badge");
    // Disabled channels must not appear
    expect(channels).not.toContain("email");
    expect(channels).not.toContain("webhook");
  });

  it("@property dispatch never produces instructions for disabled channels", () => {
    const ALL_CHANNEL_IDS: ChannelId[] = ["toast", "banner", "badge", "email", "webhook"];
    const KNOWN_EVENT_IDS: NotificationEventId[] = [
      "session_response_completed",
      "session_started",
      "cost_threshold_reached",
      "hook_error_detected",
      "agent_spawned",
      "agent_completed",
    ];

    const channelTogglesArb = fc.record({
      toast: fc.boolean(),
      banner: fc.boolean(),
      badge: fc.boolean(),
      email: fc.boolean(),
      webhook: fc.boolean(),
    }) as fc.Arbitrary<ChannelToggles>;

    const eventIdArb = fc.constantFrom(...KNOWN_EVENT_IDS);

    fc.assert(
      fc.property(eventIdArb, channelTogglesArb, (eventId, toggles) => {
        const prefs = makePreferences([
          makeEventPreference({ eventId, channels: toggles }),
        ]);

        const event = {
          hookName: "test-hook",
          eventType: eventId,
          payload: { sessionName: "prop-test" },
        };

        const instructions = createDispatchInstructions(event, prefs);

        const disabledChannels = ALL_CHANNEL_IDS.filter((ch) => !toggles[ch]);
        const instructionChannels = instructions.map((i) => i.channel);

        for (const disabled of disabledChannels) {
          expect(instructionChannels).not.toContain(disabled);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("@property every dispatch instruction includes event ID and timestamp metadata", () => {
    const KNOWN_EVENT_IDS: NotificationEventId[] = [
      "session_response_completed",
      "session_started",
      "cost_threshold_reached",
      "hook_error_detected",
      "agent_spawned",
      "agent_completed",
    ];

    const channelTogglesWithAtLeastOneEnabled = fc
      .record({
        toast: fc.boolean(),
        banner: fc.boolean(),
        badge: fc.boolean(),
        email: fc.boolean(),
        webhook: fc.boolean(),
      })
      .filter(
        (toggles) =>
          toggles.toast || toggles.banner || toggles.badge || toggles.email || toggles.webhook
      ) as fc.Arbitrary<ChannelToggles>;

    const eventIdArb = fc.constantFrom(...KNOWN_EVENT_IDS);

    fc.assert(
      fc.property(
        eventIdArb,
        channelTogglesWithAtLeastOneEnabled,
        (eventId, toggles) => {
          const prefs = makePreferences([
            makeEventPreference({ eventId, channels: toggles }),
          ]);

          const event = {
            hookName: "test-hook",
            eventType: eventId,
            payload: { sessionName: "prop-test" },
          };

          const instructions = createDispatchInstructions(event, prefs);
          expect(instructions.length).toBeGreaterThan(0);

          for (const instruction of instructions) {
            // Every instruction must carry the event ID
            expect(instruction.eventId).toBe(eventId);
            // Every instruction must carry a timestamp
            expect(typeof instruction.timestamp).toBe("string");
            expect(instruction.timestamp.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
