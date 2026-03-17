/**
 * Unit tests: DND Manager schedule evaluation
 *
 * Tests pure functions for mapping dates to schedule entries
 * and evaluating DND state from schedule configuration.
 *
 * Driving port: evaluateDndState
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  evaluateDndState,
  createDndQueueSummary,
} from "../../../src/plugins/norbert-notif/domain/dndManager";
import type {
  DndConfig,
  DndScheduleEntry,
  DayOfWeek,
} from "../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

const dayNames: readonly DayOfWeek[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/** Build a schedule config where a specific day has a time window. */
const buildScheduleConfig = (
  day: DayOfWeek,
  startTime: string,
  endTime: string
): DndConfig => ({
  manuallyEnabled: false,
  scheduleEnabled: true,
  schedule: dayNames.map((d) => ({
    day: d,
    enabled: d === day,
    startTime: d === day ? startTime : null,
    endTime: d === day ? endTime : null,
  })),
  behavior: "queue_with_badge",
});

/** Build a Date for a specific day-of-week and time (HH:MM). */
const buildDateForDay = (dayIndex: number, hour: number, minute: number): Date => {
  // 2026-03-15 is a Sunday (dayIndex 0)
  const baseDate = new Date(2026, 2, 15 + dayIndex, hour, minute, 0, 0);
  return baseDate;
};

// ---------------------------------------------------------------------------
// PROPERTY TESTS: Schedule evaluation
// ---------------------------------------------------------------------------

describe("DND schedule evaluation", () => {
  it("activates DND during any scheduled window", () => {
    // Property: for any day with an enabled schedule entry,
    // a time within the window produces active DND with source "schedule"
    const dayIndexArb = fc.integer({ min: 0, max: 6 });
    const hourArb = fc.integer({ min: 1, max: 22 });

    fc.assert(
      fc.property(dayIndexArb, hourArb, (dayIndex, startHour) => {
        const day = dayNames[dayIndex];
        const endHour = Math.min(startHour + 1, 23);
        const startTime = `${String(startHour).padStart(2, "0")}:00`;
        const endTime = `${String(endHour).padStart(2, "0")}:00`;

        const config = buildScheduleConfig(day, startTime, endTime);
        const midTime = buildDateForDay(dayIndex, startHour, 30);

        const state = evaluateDndState(config, midTime);

        expect(state.active).toBe(true);
        expect(state.source).toBe("schedule");
        expect(state.endsAt).toContain(endTime);
      }),
      { numRuns: 50 }
    );
  });

  it("DND inactive outside scheduled window", () => {
    // Property: a time after the window produces inactive DND
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 6 }),
        fc.integer({ min: 1, max: 20 }),
        (dayIndex, startHour) => {
          const day = dayNames[dayIndex];
          const endHour = startHour + 1;
          const startTime = `${String(startHour).padStart(2, "0")}:00`;
          const endTime = `${String(endHour).padStart(2, "0")}:00`;

          const config = buildScheduleConfig(day, startTime, endTime);
          // Time 2 hours after window end
          const afterTime = buildDateForDay(dayIndex, endHour + 2, 0);

          const state = evaluateDndState(config, afterTime);

          expect(state.active).toBe(false);
          expect(state.source).toBe("none");
        }
      ),
      { numRuns: 50 }
    );
  });

  it("manual toggle takes precedence over schedule", () => {
    const config: DndConfig = {
      manuallyEnabled: true,
      scheduleEnabled: true,
      schedule: dayNames.map((d) => ({
        day: d,
        enabled: true,
        startTime: "09:00",
        endTime: "10:00",
      })),
      behavior: "queue_with_badge",
    };

    const state = evaluateDndState(config, new Date());

    expect(state.active).toBe(true);
    expect(state.source).toBe("manual");
  });
});

// ---------------------------------------------------------------------------
// PROPERTY TESTS: Queue summary
// ---------------------------------------------------------------------------

describe("DND queue summary", () => {
  it("summary body contains queued count and DND for any positive count", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (count) => {
        const summary = createDndQueueSummary(count);

        expect(summary.channel).toBe("toast");
        expect(summary.body).toContain(String(count));
        expect(summary.body).toContain("DND");
      }),
      { numRuns: 100 }
    );
  });

  it("summary channel is always toast", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), (count) => {
        const summary = createDndQueueSummary(count);
        expect(summary.channel).toBe("toast");
      }),
      { numRuns: 50 }
    );
  });
});
