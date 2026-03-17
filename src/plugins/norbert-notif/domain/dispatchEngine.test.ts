/// Unit tests for norbert-notif dispatch engine.
///
/// Tests the pure dispatch pipeline: given a hook event, user preferences,
/// and DND state, produce dispatch instructions for enabled channels.
///
/// The dispatch engine is a pure function with no side effects.

import { describe, it, expect } from "vitest";
import { createDispatchInstructions } from "./dispatchEngine";
import type {
  NotificationPreferences,
  EventPreference,
  DndState,
} from "./types";

// ---------------------------------------------------------------------------
// SHARED FIXTURES
// ---------------------------------------------------------------------------

const dndOff: DndState = {
  active: false,
  source: "none",
  endsAt: null,
  queuedCount: 0,
};

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

    const instructions = createDispatchInstructions(event, prefs, dndOff);
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

    const instructions = createDispatchInstructions(event, prefs, dndOff);
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

    const instructions = createDispatchInstructions(event, prefs, dndOff);
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

    const instructions = createDispatchInstructions(event, prefs, dndOff);
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

    const instructions = createDispatchInstructions(event, prefs, dndOff);
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

    const instructions = createDispatchInstructions(event, prefs, dndOff);
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

    const instructions = createDispatchInstructions(event, prefs, dndOff);
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

    const instructions = createDispatchInstructions(event, prefs, dndOff);
    expect(instructions[0].metadata).toEqual({
      sessionName: "project-alpha",
      duration: "4m 32s",
      cost: 5.12,
    });
  });
});
