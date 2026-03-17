/**
 * Unit tests: Preference validation
 *
 * Tests validatePreferences for structural validation and
 * channel toggle preservation.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validatePreferences,
  validateThreshold,
} from "../../../src/plugins/norbert-notif/domain/preferenceValidator";
import type {
  NotificationPreferences,
  NotificationEventId,
  ChannelToggles,
  EventPreference,
} from "../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const eventIdArb: fc.Arbitrary<NotificationEventId> = fc.constantFrom(
  "session_response_completed",
  "session_started",
  "context_compaction_occurred",
  "cost_threshold_reached",
  "hook_error_detected"
);

const channelTogglesArb: fc.Arbitrary<ChannelToggles> = fc.record({
  toast: fc.boolean(),
  banner: fc.boolean(),
  badge: fc.boolean(),
  email: fc.boolean(),
  webhook: fc.boolean(),
});

const soundArb = fc.constantFrom(
  "phosphor-ping",
  "amber-pulse",
  "compaction",
  "session-complete",
  "des-block",
  "silence"
);

const eventPreferenceArb: fc.Arbitrary<EventPreference> = fc.record({
  eventId: eventIdArb,
  channels: channelTogglesArb,
  sound: soundArb,
  threshold: fc.option(fc.double({ min: 0.01, max: 10000, noNaN: true }), { nil: null }),
});

const uniqueEventPreferencesArb: fc.Arbitrary<readonly EventPreference[]> =
  fc.uniqueArray(eventIdArb, { minLength: 1, maxLength: 5 }).chain((ids) =>
    fc.tuple(...ids.map((id) =>
      fc.record({
        eventId: fc.constant(id),
        channels: channelTogglesArb,
        sound: soundArb,
        threshold: fc.option(fc.double({ min: 0.01, max: 10000, noNaN: true }), { nil: null }),
      })
    )).map((events) => events as readonly EventPreference[])
  );

const validPreferencesArb: fc.Arbitrary<NotificationPreferences> = fc.record({
  version: fc.constant(1 as const),
  events: uniqueEventPreferencesArb,
  globalVolume: fc.integer({ min: 0, max: 100 }),
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("validatePreferences", () => {
  it("valid preferences always pass validation", () => {
    fc.assert(
      fc.property(validPreferencesArb, (prefs) => {
        const result = validatePreferences(prefs);
        expect(result.ok).toBe(true);
      })
    );
  });

  it("channel toggle state is preserved through validation", () => {
    fc.assert(
      fc.property(validPreferencesArb, (prefs) => {
        const result = validatePreferences(prefs);
        if (result.ok) {
          for (const event of prefs.events) {
            const validated = result.value.events.find(
              (e) => e.eventId === event.eventId
            );
            expect(validated).toBeDefined();
            expect(validated!.channels).toEqual(event.channels);
          }
        }
      })
    );
  });

  it("rejects preferences with empty events array", () => {
    const emptyPrefs: NotificationPreferences = {
      version: 1,
      events: [],
      globalVolume: 100,
    };

    const result = validatePreferences(emptyPrefs);
    expect(result.ok).toBe(false);
  });

  it("rejects preferences with globalVolume out of range", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ max: -1 }),
          fc.integer({ min: 101 })
        ),
        (badVolume) => {
          const prefs: NotificationPreferences = {
            version: 1,
            events: [
              {
                eventId: "session_started",
                channels: { toast: false, banner: false, badge: false, email: false, webhook: false },
                sound: "silence",
                threshold: null,
              },
            ],
            globalVolume: badVolume,
          };

          const result = validatePreferences(prefs);
          expect(result.ok).toBe(false);
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Threshold validation properties
// ---------------------------------------------------------------------------

describe("validateThreshold", () => {
  it("any positive dollar amount passes validation", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1_000_000, noNaN: true }),
        (amount) => {
          const result = validateThreshold(amount, "$");
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value).toBe(amount);
          }
        }
      )
    );
  });

  it("negative values always rejected with positive error for any unit", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1_000_000, max: -0.01, noNaN: true }),
        fc.constantFrom("$", "%"),
        (value, unit) => {
          const result = validateThreshold(value, unit);
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error).toContain("positive");
          }
        }
      )
    );
  });

  it("zero rejected for cost threshold with positive error", () => {
    const result = validateThreshold(0, "$");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("positive");
    }
  });

  it("percentage thresholds in 1-99 range pass validation", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99 }),
        (pct) => {
          const result = validateThreshold(pct, "%");
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value).toBe(pct);
          }
        }
      )
    );
  });

  it("percentage thresholds outside 1-99 range rejected", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0),
          fc.constant(100),
          fc.integer({ min: 101, max: 1000 }),
          fc.integer({ min: -1000, max: -1 })
        ),
        (pct) => {
          const result = validateThreshold(pct, "%");
          expect(result.ok).toBe(false);
        }
      )
    );
  });
});
