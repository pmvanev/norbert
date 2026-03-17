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
