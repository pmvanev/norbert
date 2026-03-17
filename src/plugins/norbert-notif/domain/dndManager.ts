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
  DndScheduleEntry,
  DayOfWeek,
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

/// Map JS Date.getDay() index (0=Sun) to DayOfWeek.
const dayIndexToDay: readonly DayOfWeek[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/// Extract the DayOfWeek from a Date.
const getDayOfWeek = (date: Date): DayOfWeek => dayIndexToDay[date.getDay()];

/// Parse "HH:MM" time string into total minutes since midnight.
const parseTimeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

/// Get the current time-of-day as minutes since midnight.
const getMinutesSinceMidnight = (date: Date): number =>
  date.getHours() * 60 + date.getMinutes();

/// Check whether a time falls within a schedule entry's window.
const isWithinScheduleWindow = (
  entry: DndScheduleEntry,
  currentMinutes: number
): boolean => {
  if (!entry.enabled || entry.startTime === null || entry.endTime === null) {
    return false;
  }
  const startMinutes = parseTimeToMinutes(entry.startTime);
  const endMinutes = parseTimeToMinutes(entry.endTime);
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

/// Find the active schedule entry for the current time, if any.
const findActiveScheduleEntry = (
  schedule: readonly DndScheduleEntry[],
  currentTime: Date
): DndScheduleEntry | undefined => {
  const currentDay = getDayOfWeek(currentTime);
  const currentMinutes = getMinutesSinceMidnight(currentTime);
  return schedule.find(
    (entry) => entry.day === currentDay && isWithinScheduleWindow(entry, currentMinutes)
  );
};

/// Build an active schedule DND state with end time.
const scheduleDndState = (endTime: string): DndState => ({
  active: true,
  source: "schedule",
  endsAt: endTime,
  queuedCount: 0,
});

export const evaluateDndState = (
  config: DndConfig,
  currentTime: Date
): DndState => {
  if (config.manuallyEnabled) {
    return manualDndState;
  }

  if (config.scheduleEnabled) {
    const activeEntry = findActiveScheduleEntry(config.schedule, currentTime);
    if (activeEntry && activeEntry.endTime !== null) {
      return scheduleDndState(activeEntry.endTime);
    }
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
/// When DND is inactive, pass all instructions through unchanged.
const passThrough = (
  instructions: readonly DispatchInstruction[]
): DndFilterResult => ({
  deliverableInstructions: instructions,
  queuedCount: 0,
});

/// Queue behavior: suppress all instructions, count one queued notification event.
const applyQueueBehavior = (): DndFilterResult => ({
  deliverableInstructions: [],
  queuedCount: 1,
});

/// Discard behavior: suppress all instructions, nothing queued.
const applyDiscardBehavior = (): DndFilterResult => ({
  deliverableInstructions: [],
  queuedCount: 0,
});

/// Suppress sound on a dispatch instruction.
const suppressSound = (
  instruction: DispatchInstruction
): DispatchInstruction => ({
  ...instruction,
  sound: null,
});

/// Banner-only behavior: keep only banner channel instructions, suppress sound.
const applyBannerOnlyBehavior = (
  instructions: readonly DispatchInstruction[]
): DndFilterResult => ({
  deliverableInstructions: instructions
    .filter((instruction) => instruction.channel === "banner")
    .map(suppressSound),
  queuedCount: 0,
});

/// Apply the appropriate DND behavior based on the behavior mode.
const applyActiveDndBehavior = (
  instructions: readonly DispatchInstruction[],
  behavior: DndBehavior
): DndFilterResult => {
  switch (behavior) {
    case "queue_with_badge":
      return applyQueueBehavior();
    case "discard_silently":
      return applyDiscardBehavior();
    case "banner_only":
      return applyBannerOnlyBehavior(instructions);
  }
};

export const applyDndToInstructions = (
  instructions: readonly DispatchInstruction[],
  dndState: DndState,
  behavior: DndBehavior
): DndFilterResult => {
  if (!dndState.active) {
    return passThrough(instructions);
  }
  return applyActiveDndBehavior(instructions, behavior);
};

// ---------------------------------------------------------------------------
// DND Queue Summary
// ---------------------------------------------------------------------------

/// Format the summary body describing queued notifications during DND.
const formatQueueSummaryBody = (queuedCount: number): string =>
  `${queuedCount} notification${queuedCount === 1 ? "" : "s"} received while DND was active`;

/// Create a summary dispatch instruction for queued notifications when DND ends.
///
/// Pure function: (queuedCount) -> DispatchInstruction
export const createDndQueueSummary = (
  queuedCount: number
): DispatchInstruction => ({
  channel: "toast",
  title: "DND Summary",
  body: formatQueueSummaryBody(queuedCount),
  sound: null,
  volume: 0,
  isTest: false,
  eventId: "session_response_completed",
  timestamp: new Date().toISOString(),
  metadata: { queuedCount },
});
