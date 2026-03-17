/**
 * Acceptance tests: Do Not Disturb (US-NOTIF-04)
 *
 * Validates DND state evaluation: manual toggle, schedule activation,
 * behavior modes (queue, discard, banner-only), and batch delivery
 * when DND ends.
 *
 * Driving ports: evaluateDndState, applyDndToInstructions (pure functions)
 * Domain: DND manager, DND state, DND config
 *
 * Traces to: US-NOTIF-04 acceptance criteria
 */

import { describe, it, expect } from "vitest";
import {
  evaluateDndState,
  applyDndToInstructions,
  createDndQueueSummary,
} from "../../../src/plugins/norbert-notif/domain/dndManager";
import {
  type DndConfig,
  type DndState,
  type DispatchInstruction,
} from "../../../src/plugins/norbert-notif/domain/types";

// ---------------------------------------------------------------------------
// TEST FIXTURES
// ---------------------------------------------------------------------------

const dndDisabledConfig: DndConfig = {
  manuallyEnabled: false,
  scheduleEnabled: false,
  schedule: [],
  behavior: "queue_with_badge",
};

const dndManualConfig: DndConfig = {
  manuallyEnabled: true,
  scheduleEnabled: false,
  schedule: [],
  behavior: "queue_with_badge",
};

const dndScheduleConfig: DndConfig = {
  manuallyEnabled: false,
  scheduleEnabled: true,
  schedule: [
    { day: "mon", enabled: true, startTime: "09:00", endTime: "10:00" },
    { day: "tue", enabled: true, startTime: "09:00", endTime: "10:00" },
    { day: "wed", enabled: true, startTime: "09:00", endTime: "10:00" },
    { day: "thu", enabled: true, startTime: "09:00", endTime: "10:00" },
    { day: "fri", enabled: true, startTime: "09:00", endTime: "10:00" },
    { day: "sat", enabled: false, startTime: null, endTime: null },
    { day: "sun", enabled: false, startTime: null, endTime: null },
  ],
  behavior: "queue_with_badge",
};

const sampleInstructions: readonly DispatchInstruction[] = [
  {
    channel: "toast",
    title: "Cost Threshold Reached",
    body: "api-refactor: $25.12 of $25.00 limit",
    sound: "amber-pulse",
    volume: 80,
    isTest: false,
    eventId: "cost_threshold_reached",
    timestamp: "2026-03-17T12:00:00Z",
    metadata: { cost: 25.12, threshold: 25.0 },
  },
  {
    channel: "banner",
    title: "Cost Threshold Reached",
    body: "api-refactor: $25.12 of $25.00 limit",
    sound: null,
    volume: 0,
    isTest: false,
    eventId: "cost_threshold_reached",
    timestamp: "2026-03-17T12:00:00Z",
    metadata: { cost: 25.12, threshold: 25.0 },
  },
  {
    channel: "badge",
    title: "Cost Threshold Reached",
    body: "",
    sound: null,
    volume: 0,
    isTest: false,
    eventId: "cost_threshold_reached",
    timestamp: "2026-03-17T12:00:00Z",
    metadata: { cost: 25.12, threshold: 25.0 },
  },
];

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: DND State and Behavior
// ---------------------------------------------------------------------------

describe("Manual DND toggle suppresses dispatch", () => {
  it("evaluates DND as active when manually enabled", () => {
    // Given DND is manually enabled
    // When DND state is evaluated
    const state = evaluateDndState(dndManualConfig, new Date());

    // Then DND is active
    expect(state.active).toBe(true);

    // And the source is "manual"
    expect(state.source).toBe("manual");
  });
});

describe("DND with queue behavior tags instructions for queuing", () => {
  it("returns empty instructions and increments queue count", () => {
    // Given DND is active with "Queue and show count badge" behavior
    const dndState: DndState = {
      active: true,
      source: "manual",
      endsAt: null,
      queuedCount: 0,
    };

    // When dispatch instructions are filtered through DND
    const result = applyDndToInstructions(
      sampleInstructions,
      dndState,
      "queue_with_badge"
    );

    // Then no instructions are delivered
    expect(result.deliverableInstructions).toHaveLength(0);

    // And the queued count increases by the number of suppressed notifications
    expect(result.queuedCount).toBe(1); // 1 notification event queued
  });
});

describe("DND with discard behavior produces no instructions", () => {
  it("silently discards all instructions without queuing", () => {
    // Given DND is active with "discard silently" behavior
    const dndState: DndState = {
      active: true,
      source: "manual",
      endsAt: null,
      queuedCount: 0,
    };

    // When dispatch instructions are filtered through DND
    const result = applyDndToInstructions(
      sampleInstructions,
      dndState,
      "discard_silently"
    );

    // Then no instructions are delivered
    expect(result.deliverableInstructions).toHaveLength(0);

    // And nothing is queued
    expect(result.queuedCount).toBe(0);
  });
});

describe("DND with banner-only behavior produces only banner instructions", () => {
  it("filters to banner channel only, suppressing toast and sound", () => {
    // Given DND is active with "banner only" behavior
    const dndState: DndState = {
      active: true,
      source: "manual",
      endsAt: null,
      queuedCount: 0,
    };

    // When dispatch instructions are filtered through DND
    const result = applyDndToInstructions(
      sampleInstructions,
      dndState,
      "banner_only"
    );

    // Then only banner instructions are delivered
    expect(result.deliverableInstructions.length).toBeGreaterThanOrEqual(1);
    for (const instruction of result.deliverableInstructions) {
      expect(instruction.channel).toBe("banner");
      // And sound is suppressed
      expect(instruction.sound).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Scheduled DND activates at configured time", () => {
  it("evaluates DND as active during scheduled window", () => {
    // Given DND is scheduled for Monday 09:00-10:00
    // And it is Monday at 09:30
    const monday930 = new Date("2026-03-16T09:30:00"); // Monday

    // When DND state is evaluated
    const state = evaluateDndState(dndScheduleConfig, monday930);

    // Then DND is active
    expect(state.active).toBe(true);

    // And the source is "schedule"
    expect(state.source).toBe("schedule");

    // And it ends at 10:00
    expect(state.endsAt).toContain("10:00");
  });

  it("evaluates DND as inactive outside scheduled window", () => {
    // Given it is Monday at 10:30 (after schedule)
    const monday1030 = new Date("2026-03-16T10:30:00");

    // When DND state is evaluated
    const state = evaluateDndState(dndScheduleConfig, monday1030);

    // Then DND is not active
    expect(state.active).toBe(false);
  });
});

describe("Queued notifications produce batch summary on DND end", () => {
  it("creates a summary instruction when DND ends with queued notifications", () => {
    // Given DND has been active and 3 notifications were queued
    const queuedCount = 3;

    // When DND ends and a summary is created
    const summary = createDndQueueSummary(queuedCount);

    // Then a summary toast instruction is produced
    expect(summary.channel).toBe("toast");

    // And the body shows "3 notifications received while DND was active"
    expect(summary.body).toContain("3");
    expect(summary.body).toContain("DND");
  });
});

describe("DND state persists across evaluations", () => {
  it("same config and time produce consistent DND state", () => {
    // Given DND is manually enabled
    // When evaluated multiple times with same config
    const state1 = evaluateDndState(dndManualConfig, new Date());
    const state2 = evaluateDndState(dndManualConfig, new Date());

    // Then both evaluations produce active DND
    expect(state1.active).toBe(true);
    expect(state2.active).toBe(true);

    // And when DND is disabled
    const state3 = evaluateDndState(dndDisabledConfig, new Date());

    // Then evaluation reflects the change
    expect(state3.active).toBe(false);
  });
});
