import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  aggregatePromptActivity,
  EMPTY_PROMPT_ACTIVITY_SUMMARY,
  type UserPromptEvent,
} from "./promptActivityAggregator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildUserPromptEvent = (
  overrides: Partial<UserPromptEvent["payload"]> = {},
  receivedAt = "2026-03-24T10:00:00Z",
): UserPromptEvent => ({
  eventType: "user_prompt",
  payload: {
    prompt_length: 500,
    ...overrides,
  },
  receivedAt,
});

// ---------------------------------------------------------------------------
// Arbitrary
// ---------------------------------------------------------------------------

const isoTimestampArb = fc
  .integer({ min: 0, max: 3600000 }) // offset in ms from base
  .map((offset) => new Date(Date.parse("2026-03-24T10:00:00Z") + offset).toISOString());

const userPromptEventArb: fc.Arbitrary<UserPromptEvent> = fc.record({
  eventType: fc.constant("user_prompt" as const),
  payload: fc.record({
    prompt_length: fc.integer({ min: 1, max: 10000 }),
  }),
  receivedAt: isoTimestampArb,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("aggregatePromptActivity", () => {
  it("returns empty summary for empty events array", () => {
    const result = aggregatePromptActivity([]);
    expect(result).toEqual(EMPTY_PROMPT_ACTIVITY_SUMMARY);
  });

  it("computes correct summary for known prompts", () => {
    const events: UserPromptEvent[] = [
      buildUserPromptEvent({ prompt_length: 200 }, "2026-03-24T10:00:00Z"),
      buildUserPromptEvent({ prompt_length: 400 }, "2026-03-24T10:01:00Z"),
      buildUserPromptEvent({ prompt_length: 600 }, "2026-03-24T10:02:00Z"),
    ];
    const result = aggregatePromptActivity(events);

    expect(result.totalPrompts).toBe(3);
    expect(result.avgLength).toBeCloseTo(400, 5);
    // 3 prompts over 2 minutes = 1.5 prompts/min
    expect(result.promptsPerMinute).toBeCloseTo(1.5, 5);
  });

  it("handles single prompt with zero time span", () => {
    const events: UserPromptEvent[] = [
      buildUserPromptEvent({ prompt_length: 300 }, "2026-03-24T10:00:00Z"),
    ];
    const result = aggregatePromptActivity(events);
    expect(result.totalPrompts).toBe(1);
    expect(result.avgLength).toBe(300);
    // Single event: no time span, rate should be 0
    expect(result.promptsPerMinute).toBe(0);
  });

  it("handles events with missing prompt_length as 0", () => {
    const events: UserPromptEvent[] = [
      buildUserPromptEvent({ prompt_length: undefined }),
    ];
    const result = aggregatePromptActivity(events);
    expect(result.totalPrompts).toBe(1);
    expect(result.avgLength).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Property: totalPrompts equals event count
  // -------------------------------------------------------------------------

  it("property: totalPrompts equals number of events", () => {
    fc.assert(
      fc.property(fc.array(userPromptEventArb), (events) => {
        const result = aggregatePromptActivity(events);
        expect(result.totalPrompts).toBe(events.length);
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Property: avgLength is non-negative
  // -------------------------------------------------------------------------

  it("property: avgLength is non-negative", () => {
    fc.assert(
      fc.property(fc.array(userPromptEventArb), (events) => {
        const result = aggregatePromptActivity(events);
        expect(result.avgLength).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Property: promptsPerMinute is non-negative
  // -------------------------------------------------------------------------

  it("property: promptsPerMinute is non-negative", () => {
    fc.assert(
      fc.property(fc.array(userPromptEventArb), (events) => {
        const result = aggregatePromptActivity(events);
        expect(result.promptsPerMinute).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});
