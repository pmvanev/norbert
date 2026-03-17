/// DND (Do Not Disturb) manager for norbert-notif notification center.
///
/// Pure functions for evaluating DND state from configuration and time,
/// and filtering dispatch instructions based on active DND behavior.
///
/// No side effects. No IO imports.

import type {
  DndConfig,
  DndState,
  DndBehavior,
  DispatchInstruction,
} from "./types";

// ---------------------------------------------------------------------------
// DND State Evaluation
// ---------------------------------------------------------------------------

/// Evaluate the current DND state from a DND configuration and the current time.
///
/// Pure function: (config, currentTime) -> DndState
///
/// Manual toggle takes precedence over schedule. When neither is active,
/// returns inactive state with source "none".
/// Build an inactive DND state.
const inactiveDndState: DndState = {
  active: false,
  source: "none",
  endsAt: null,
  queuedCount: 0,
};

/// Build an active manual DND state.
const manualDndState: DndState = {
  active: true,
  source: "manual",
  endsAt: null,
  queuedCount: 0,
};

export const evaluateDndState = (
  config: DndConfig,
  _currentTime: Date
): DndState => {
  if (config.manuallyEnabled) {
    return manualDndState;
  }

  return inactiveDndState;
};

// ---------------------------------------------------------------------------
// DND Instruction Filtering
// ---------------------------------------------------------------------------

/// Result of applying DND filtering to a set of dispatch instructions.
export interface DndFilterResult {
  readonly deliverableInstructions: readonly DispatchInstruction[];
  readonly queuedCount: number;
}

/// Apply DND behavior to a set of dispatch instructions.
///
/// Pure function: (instructions, dndState, behavior) -> DndFilterResult
///
/// When DND is inactive, all instructions pass through unchanged.
/// When DND is active, behavior determines filtering:
/// - "queue_with_badge": suppress all, increment queue count
/// - "discard_silently": suppress all, queue count stays zero
/// - "banner_only": only banner instructions pass through, sound suppressed
export const applyDndToInstructions = (
  _instructions: readonly DispatchInstruction[],
  _dndState: DndState,
  _behavior: DndBehavior
): DndFilterResult => ({
  deliverableInstructions: [],
  queuedCount: 0,
});

// ---------------------------------------------------------------------------
// DND Queue Summary
// ---------------------------------------------------------------------------

/// Create a summary dispatch instruction for queued notifications when DND ends.
///
/// Pure function: (queuedCount) -> DispatchInstruction
export const createDndQueueSummary = (
  _queuedCount: number
): DispatchInstruction => ({
  channel: "toast",
  title: "DND Summary",
  body: "",
  sound: null,
  volume: 0,
  isTest: false,
  eventId: "session_response_completed",
  timestamp: new Date().toISOString(),
  metadata: {},
});
