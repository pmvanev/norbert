/**
 * Acceptance tests: Notification Dispatch Engine (US-NOTIF-01)
 *
 * Validates the core dispatch pipeline: given an event, user preferences,
 * and DND state, produce dispatch instructions for enabled channels.
 *
 * Driving port: createDispatchInstructions (pure function)
 * Domain: dispatch engine, event registry, preferences, DND state
 *
 * The dispatch engine is a pure function with no side effects.
 * It produces DispatchInstruction values that adapters execute independently.
 *
 * Traces to: US-NOTIF-01 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  createDispatchInstructions,
} from "../../../src/plugins/norbert-notif/domain/dispatchEngine";
import {
  type NotificationPreferences,
  type EventPreference,
  type DndState,
  type DispatchInstruction,
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

const sessionCompletedEvent = {
  hookName: "session-event",
  eventType: "session_response_completed",
  payload: {
    sessionName: "project-alpha",
    duration: "4m 32s",
    cost: 5.12,
  },
};

const costThresholdEvent = {
  hookName: "usage-event",
  eventType: "cost_threshold_reached",
  payload: {
    sessionName: "api-refactor",
    cost: 25.12,
    threshold: 25.0,
  },
};

const hookErrorEvent = {
  hookName: "config-event",
  eventType: "hook_error_detected",
  payload: {
    hookName: "lint-check",
    errorMessage: "ESLint process exited with code 1",
    sessionName: "secure-api",
  },
};

const contextCompactionEvent = {
  hookName: "session-event",
  eventType: "context_compaction_occurred",
  payload: {
    sessionName: "client-dashboard",
  },
};

const sessionStartedEvent = {
  hookName: "session-event",
  eventType: "session_started",
  payload: {
    sessionName: "bugfix-login",
  },
};

const makePreferences = (
  overrides: Partial<EventPreference>[]
): NotificationPreferences => ({
  version: 1,
  events: [
    {
      eventId: "session_response_completed",
      channels: { toast: true, banner: false, badge: false, email: false, webhook: false },
      sound: "phosphor-ping",
      threshold: null,
      ...overrides.find((o) => o.eventId === "session_response_completed"),
    },
    {
      eventId: "cost_threshold_reached",
      channels: { toast: true, banner: true, badge: true, email: false, webhook: false },
      sound: "amber-pulse",
      threshold: 25.0,
      ...overrides.find((o) => o.eventId === "cost_threshold_reached"),
    },
    {
      eventId: "hook_error_detected",
      channels: { toast: true, banner: true, badge: true, email: false, webhook: false },
      sound: "des-block",
      threshold: null,
      ...overrides.find((o) => o.eventId === "hook_error_detected"),
    },
    {
      eventId: "context_compaction_occurred",
      channels: { toast: true, banner: false, badge: false, email: false, webhook: false },
      sound: "compaction",
      threshold: null,
      ...overrides.find((o) => o.eventId === "context_compaction_occurred"),
    },
    {
      eventId: "session_started",
      channels: { toast: false, banner: false, badge: false, email: false, webhook: false },
      sound: "silence",
      threshold: null,
      ...overrides.find((o) => o.eventId === "session_started"),
    },
  ] as EventPreference[],
  globalVolume: 80,
});

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User receives notification when session completes", () => {
  it("dispatch produces toast instruction for session completion with session details", () => {
    // Given "Session response completed" has Toast enabled
    // And the sound is set to "phosphor-ping" at 80% volume
    // And DND is not active
    const prefs = makePreferences([]);

    // When the session "project-alpha" completes after 4 minutes 32 seconds with cost $5.12
    const instructions = createDispatchInstructions(
      sessionCompletedEvent,
      prefs,
      dndOff
    );

    // Then a dispatch instruction is produced for the toast channel
    expect(instructions.length).toBeGreaterThanOrEqual(1);
    const toastInstruction = instructions.find((i) => i.channel === "toast");
    expect(toastInstruction).toBeDefined();

    // And the instruction title contains "Session Response Completed"
    expect(toastInstruction!.title).toContain("Session Response Completed");

    // And the body includes session name "project-alpha"
    expect(toastInstruction!.body).toContain("project-alpha");

    // And the sound is "phosphor-ping" at 80% volume
    expect(toastInstruction!.sound).toBe("phosphor-ping");
    expect(toastInstruction!.volume).toBe(80);

    // And the instruction is not a test notification
    expect(toastInstruction!.isTest).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Multi-Channel and Event Types
// ---------------------------------------------------------------------------

describe("Cost threshold triggers multi-channel dispatch", () => {
  it("produces instructions for toast, banner, and badge when all are enabled", () => {
    // Given "Cost threshold reached" is enabled for Toast, Banner, and Badge
    // And the cost threshold is set to $25.00
    const prefs = makePreferences([]);

    // When session "api-refactor" cost reaches $25.12
    const instructions = createDispatchInstructions(
      costThresholdEvent,
      prefs,
      dndOff
    );

    // Then dispatch instructions are produced for toast, banner, and badge
    const channels = instructions.map((i) => i.channel);
    expect(channels).toContain("toast");
    expect(channels).toContain("banner");
    expect(channels).toContain("badge");

    // And the toast instruction body includes cost and threshold
    const toast = instructions.find((i) => i.channel === "toast")!;
    expect(toast.body).toContain("25.12");
    expect(toast.body).toContain("25.00");
  });
});

describe("Hook error dispatch includes context", () => {
  it("produces instructions with hook name and error message", () => {
    // Given "Hook error detected" is enabled for Toast and Banner
    const prefs = makePreferences([]);

    // When hook "lint-check" returns error "ESLint process exited with code 1" in session "secure-api"
    const instructions = createDispatchInstructions(
      hookErrorEvent,
      prefs,
      dndOff
    );

    // Then the toast instruction title contains "Hook Error"
    const toast = instructions.find((i) => i.channel === "toast")!;
    expect(toast.title).toContain("Hook Error");

    // And the banner instruction body includes hook name and error message
    const banner = instructions.find((i) => i.channel === "banner")!;
    expect(banner.body).toContain("lint-check");
    expect(banner.body).toContain("ESLint process exited with code 1");
  });
});

describe("Context compaction produces toast with session details", () => {
  it("includes session name in compaction notification", () => {
    // Given "Context compaction occurred" is enabled for Toast
    const prefs = makePreferences([]);

    // When context compaction occurs in session "client-dashboard"
    const instructions = createDispatchInstructions(
      contextCompactionEvent,
      prefs,
      dndOff
    );

    // Then a toast instruction is produced
    const toast = instructions.find((i) => i.channel === "toast");
    expect(toast).toBeDefined();

    // And the body includes "client-dashboard"
    expect(toast!.body).toContain("client-dashboard");

    // And the sound is "compaction"
    expect(toast!.sound).toBe("compaction");
  });
});

describe.skip("Disabled event produces no dispatch instructions", () => {
  it("returns empty instructions when all channels are disabled for event", () => {
    // Given "Session started" has all channels disabled
    const prefs = makePreferences([]);

    // When a new session "bugfix-login" starts
    const instructions = createDispatchInstructions(
      sessionStartedEvent,
      prefs,
      dndOff
    );

    // Then no dispatch instructions are produced
    expect(instructions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe.skip("Dispatch produces independent instructions per channel", () => {
  it("each enabled channel gets its own instruction with full payload", () => {
    // Given "Cost threshold reached" is enabled for Toast, Banner, and Badge
    const prefs = makePreferences([]);

    // When the cost threshold is reached
    const instructions = createDispatchInstructions(
      costThresholdEvent,
      prefs,
      dndOff
    );

    // Then each instruction is independent with its own channel, title, body
    for (const instruction of instructions) {
      expect(instruction.channel).toBeDefined();
      expect(instruction.title).toBeDefined();
      expect(instruction.body).toBeDefined();
      expect(instruction.eventId).toBe("cost_threshold_reached");
    }
  });
});

describe("Badge count increments for banner instructions", () => {
  it("banner instructions carry metadata for badge count update", () => {
    // Given "Cost threshold reached" is enabled for Banner and Badge
    const prefs = makePreferences([]);

    // When the cost threshold is reached
    const instructions = createDispatchInstructions(
      costThresholdEvent,
      prefs,
      dndOff
    );

    // Then a badge instruction is produced
    const badge = instructions.find((i) => i.channel === "badge");
    expect(badge).toBeDefined();

    // And the badge instruction carries the event ID for count tracking
    expect(badge!.eventId).toBe("cost_threshold_reached");
  });
});

// @property
describe.skip("Dispatch never produces instructions for disabled channels", () => {
  it("no instruction channel matches a disabled channel in preferences", () => {
    // Given any event with specific channels disabled
    // When dispatch instructions are produced
    // Then no instruction targets a disabled channel
    const prefs = makePreferences([]);

    // Session started has all channels disabled
    const instructions = createDispatchInstructions(
      sessionStartedEvent,
      prefs,
      dndOff
    );

    expect(instructions).toHaveLength(0);

    // Session completed has only toast enabled
    const sessionInstructions = createDispatchInstructions(
      sessionCompletedEvent,
      prefs,
      dndOff
    );

    for (const instruction of sessionInstructions) {
      expect(instruction.channel).toBe("toast");
    }
  });
});

// @property
describe.skip("Every dispatch instruction includes event ID and timestamp metadata", () => {
  it("all instructions carry event identification regardless of channel", () => {
    // Given any event that produces dispatch instructions
    const prefs = makePreferences([]);

    const instructions = createDispatchInstructions(
      costThresholdEvent,
      prefs,
      dndOff
    );

    // Then every instruction includes the event ID
    for (const instruction of instructions) {
      expect(instruction.eventId).toBe("cost_threshold_reached");
    }
  });
});

describe.skip("Unknown event type produces no dispatch instructions", () => {
  it("gracefully handles events not in the registry", () => {
    // Given a hook event with an unrecognized event type
    const unknownEvent = {
      hookName: "session-event",
      eventType: "completely_unknown_event",
      payload: { sessionName: "test" },
    };
    const prefs = makePreferences([]);

    // When dispatch instructions are produced
    const instructions = createDispatchInstructions(
      unknownEvent,
      prefs,
      dndOff
    );

    // Then no instructions are produced (event is silently ignored)
    expect(instructions).toHaveLength(0);
  });
});

describe.skip("Event with missing payload fields produces safe instructions", () => {
  it("handles partial payload without crashing", () => {
    // Given a session completion event with missing cost field
    const incompleteEvent = {
      hookName: "session-event",
      eventType: "session_response_completed",
      payload: {
        sessionName: "partial-session",
        // duration and cost are missing
      },
    };
    const prefs = makePreferences([]);

    // When dispatch instructions are produced
    const instructions = createDispatchInstructions(
      incompleteEvent,
      prefs,
      dndOff
    );

    // Then instructions are still produced for enabled channels
    expect(instructions.length).toBeGreaterThanOrEqual(1);

    // And the instruction body contains the session name
    const toast = instructions.find((i) => i.channel === "toast");
    expect(toast).toBeDefined();
    expect(toast!.body).toContain("partial-session");
  });
});
