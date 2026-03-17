/// Unit tests for norbert-notif DND manager.
///
/// Tests the pure DND evaluation and instruction filtering pipeline.
/// No side effects, no IO imports.

import { describe, it, expect } from "vitest";
import { evaluateDndState, applyDndToInstructions } from "./dndManager";
import type {
  DndConfig,
  DndState,
  DispatchInstruction,
} from "./types";

// ---------------------------------------------------------------------------
// SHARED FIXTURES
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

const makeInstruction = (
  overrides: Partial<DispatchInstruction> = {}
): DispatchInstruction => ({
  channel: "toast",
  title: "Test",
  body: "Test body",
  sound: "phosphor-ping",
  volume: 80,
  isTest: false,
  eventId: "session_response_completed",
  timestamp: "2026-03-17T12:00:00Z",
  metadata: {},
  ...overrides,
});

// ---------------------------------------------------------------------------
// evaluateDndState
// ---------------------------------------------------------------------------

describe("evaluateDndState", () => {
  it("returns active state with manual source when manually enabled", () => {
    const state = evaluateDndState(dndManualConfig, new Date());
    expect(state.active).toBe(true);
    expect(state.source).toBe("manual");
  });

  it("returns inactive state when DND is disabled", () => {
    const state = evaluateDndState(dndDisabledConfig, new Date());
    expect(state.active).toBe(false);
    expect(state.source).toBe("none");
  });

  it("returns null endsAt for manual toggle (no scheduled end)", () => {
    const state = evaluateDndState(dndManualConfig, new Date());
    expect(state.endsAt).toBeNull();
  });

  it("preserves queuedCount at zero for fresh evaluation", () => {
    const state = evaluateDndState(dndManualConfig, new Date());
    expect(state.queuedCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyDndToInstructions
// ---------------------------------------------------------------------------

const activeDndState: DndState = {
  active: true,
  source: "manual",
  endsAt: null,
  queuedCount: 0,
};

const inactiveDndState: DndState = {
  active: false,
  source: "none",
  endsAt: null,
  queuedCount: 0,
};

describe("applyDndToInstructions", () => {
  it("passes all instructions through when DND is inactive", () => {
    const instructions = [makeInstruction(), makeInstruction({ channel: "banner" })];
    const result = applyDndToInstructions(instructions, inactiveDndState, "queue_with_badge");
    expect(result.deliverableInstructions).toHaveLength(2);
    expect(result.queuedCount).toBe(0);
  });

  it("queue behavior suppresses all instructions and counts one queued event", () => {
    const instructions = [
      makeInstruction({ channel: "toast" }),
      makeInstruction({ channel: "banner" }),
      makeInstruction({ channel: "badge" }),
    ];
    const result = applyDndToInstructions(instructions, activeDndState, "queue_with_badge");
    expect(result.deliverableInstructions).toHaveLength(0);
    expect(result.queuedCount).toBe(1);
  });

  it("discard behavior suppresses all instructions with zero queue count", () => {
    const instructions = [makeInstruction(), makeInstruction({ channel: "banner" })];
    const result = applyDndToInstructions(instructions, activeDndState, "discard_silently");
    expect(result.deliverableInstructions).toHaveLength(0);
    expect(result.queuedCount).toBe(0);
  });

  it("banner-only behavior delivers only banner channel instructions", () => {
    const instructions = [
      makeInstruction({ channel: "toast", sound: "phosphor-ping" }),
      makeInstruction({ channel: "banner", sound: null }),
      makeInstruction({ channel: "badge", sound: null }),
    ];
    const result = applyDndToInstructions(instructions, activeDndState, "banner_only");
    expect(result.deliverableInstructions).toHaveLength(1);
    expect(result.deliverableInstructions[0].channel).toBe("banner");
  });

  it("banner-only behavior suppresses sound on delivered banners", () => {
    const instructions = [
      makeInstruction({ channel: "banner", sound: "amber-pulse" }),
    ];
    const result = applyDndToInstructions(instructions, activeDndState, "banner_only");
    expect(result.deliverableInstructions).toHaveLength(1);
    expect(result.deliverableInstructions[0].sound).toBeNull();
  });
});
