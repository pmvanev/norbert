/**
 * Unit tests: Dispatch Engine -- cost threshold multi-channel dispatch
 *
 * Validates that cost threshold events produce correct dispatch instructions
 * across toast, banner, and badge channels with proper content formatting.
 * Also validates global volume is applied to every dispatch instruction.
 *
 * Tests the dispatch pipeline as a pure function through the driving port.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createDispatchInstructions,
} from "../../../../../src/plugins/norbert-notif/domain/dispatchEngine";
import type {
  NotificationPreferences,
  HookEvent,
} from "../../../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCostThresholdEvent = (cost: number, threshold: number): HookEvent => ({
  hookName: "usage-event",
  eventType: "cost_threshold_reached",
  payload: {
    sessionName: "test-session",
    cost,
    threshold,
  },
});

const makeCostThresholdPrefs = (
  channels: { toast: boolean; banner: boolean; badge: boolean }
): NotificationPreferences => ({
  version: 1,
  events: [
    {
      eventId: "cost_threshold_reached",
      channels: { ...channels, email: false, webhook: false },
      sound: "amber-pulse",
      threshold: 25.0,
    },
  ],
  globalVolume: 80,
});

// ---------------------------------------------------------------------------
// Cost threshold dispatch behavior
// ---------------------------------------------------------------------------

describe("Cost threshold dispatch produces instructions for each enabled channel", () => {
  it("produces exactly toast, banner, and badge when all three enabled", () => {
    const event = makeCostThresholdEvent(25.12, 25.0);
    const prefs = makeCostThresholdPrefs({ toast: true, banner: true, badge: true });

    const instructions = createDispatchInstructions(event, prefs);

    const channels = instructions.map((i) => i.channel);
    expect(channels).toEqual(["toast", "banner", "badge"]);
  });

  it("produces only toast when banner and badge are disabled", () => {
    const event = makeCostThresholdEvent(30.0, 25.0);
    const prefs = makeCostThresholdPrefs({ toast: true, banner: false, badge: false });

    const instructions = createDispatchInstructions(event, prefs);

    expect(instructions).toHaveLength(1);
    expect(instructions[0].channel).toBe("toast");
  });
});

describe("Cost threshold toast body includes cost and threshold amounts", () => {
  it("formats cost and threshold with two decimal places", () => {
    const event = makeCostThresholdEvent(25.12, 25.0);
    const prefs = makeCostThresholdPrefs({ toast: true, banner: false, badge: false });

    const instructions = createDispatchInstructions(event, prefs);
    const toast = instructions[0];

    expect(toast.body).toContain("25.12");
    expect(toast.body).toContain("25.00");
  });

  it("includes session name in the body", () => {
    const event = makeCostThresholdEvent(50.0, 40.0);
    const prefs = makeCostThresholdPrefs({ toast: true, banner: false, badge: false });

    const instructions = createDispatchInstructions(event, prefs);

    expect(instructions[0].body).toContain("test-session");
  });
});

describe("Badge instruction carries event ID for count tracking", () => {
  it("badge instruction includes cost_threshold_reached as eventId", () => {
    const event = makeCostThresholdEvent(25.12, 25.0);
    const prefs = makeCostThresholdPrefs({ toast: false, banner: false, badge: true });

    const instructions = createDispatchInstructions(event, prefs);
    const badge = instructions.find((i) => i.channel === "badge");

    expect(badge).toBeDefined();
    expect(badge!.eventId).toBe("cost_threshold_reached");
  });

  it("badge instruction has no sound", () => {
    const event = makeCostThresholdEvent(25.12, 25.0);
    const prefs = makeCostThresholdPrefs({ toast: false, banner: false, badge: true });

    const instructions = createDispatchInstructions(event, prefs);
    const badge = instructions[0];

    expect(badge.sound).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Global volume applied to dispatch instructions
// ---------------------------------------------------------------------------

describe("Every dispatch instruction volume equals global volume from preferences", () => {
  it("all instructions carry the globalVolume value regardless of channel", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (volume) => {
          const event = makeCostThresholdEvent(25.12, 25.0);
          const prefs: NotificationPreferences = {
            version: 1,
            events: [
              {
                eventId: "cost_threshold_reached",
                channels: { toast: true, banner: true, badge: true, email: false, webhook: false },
                sound: "amber-pulse",
                threshold: 25.0,
              },
            ],
            globalVolume: volume,
          };

          const instructions = createDispatchInstructions(event, prefs);

          expect(instructions.length).toBeGreaterThan(0);
          for (const instruction of instructions) {
            expect(instruction.volume).toBe(volume);
          }
        }
      )
    );
  });

  it("volume 0 produces instructions with zero volume", () => {
    const event = makeCostThresholdEvent(25.12, 25.0);
    const prefs: NotificationPreferences = {
      version: 1,
      events: [
        {
          eventId: "cost_threshold_reached",
          channels: { toast: true, banner: false, badge: false, email: false, webhook: false },
          sound: "amber-pulse",
          threshold: 25.0,
        },
      ],
      globalVolume: 0,
    };

    const instructions = createDispatchInstructions(event, prefs);

    expect(instructions).toHaveLength(1);
    expect(instructions[0].volume).toBe(0);
  });
});
