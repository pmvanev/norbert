/**
 * Unit tests: createTestNotification
 *
 * Validates that createTestNotification produces a DispatchInstruction
 * with isTest=true, [TEST] prefix in title, targeting the specified channel.
 *
 * Uses property-based testing: for any ChannelId, the instruction
 * always satisfies the test notification invariants.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createTestNotification,
} from "../../../../../src/plugins/norbert-notif/domain/dispatchEngine";
import type {
  ChannelId,
  NotificationPreferences,
} from "../../../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const defaultPrefs: NotificationPreferences = {
  version: 1,
  events: [],
  globalVolume: 100,
};

const channelIdArb: fc.Arbitrary<ChannelId> = fc.constantFrom(
  "toast",
  "banner",
  "badge",
  "email",
  "webhook"
);

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("createTestNotification always produces isTest=true instruction", () => {
  it("isTest flag is true for any channel", () => {
    fc.assert(
      fc.property(channelIdArb, (channel) => {
        const instruction = createTestNotification(channel, defaultPrefs);
        expect(instruction.isTest).toBe(true);
      })
    );
  });
});

describe("createTestNotification title always contains [TEST] prefix", () => {
  it("[TEST] appears in the title for any channel", () => {
    fc.assert(
      fc.property(channelIdArb, (channel) => {
        const instruction = createTestNotification(channel, defaultPrefs);
        expect(instruction.title).toContain("[TEST]");
      })
    );
  });
});

describe("createTestNotification targets the specified channel", () => {
  it("instruction channel matches the requested channel", () => {
    fc.assert(
      fc.property(channelIdArb, (channel) => {
        const instruction = createTestNotification(channel, defaultPrefs);
        expect(instruction.channel).toBe(channel);
      })
    );
  });
});

describe("createTestNotification body describes test notification", () => {
  it("body contains the word test", () => {
    fc.assert(
      fc.property(channelIdArb, (channel) => {
        const instruction = createTestNotification(channel, defaultPrefs);
        expect(instruction.body.toLowerCase()).toContain("test");
      })
    );
  });
});
