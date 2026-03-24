/// Prompt Activity Aggregator: pure fold over user_prompt events.
///
/// Input: array of user_prompt events.
/// Output: PromptActivitySummary with count, rate, avg length.
///
/// No side effects, no IO imports.

// ---------------------------------------------------------------------------
// Event shape accepted by this aggregator
// ---------------------------------------------------------------------------

export interface UserPromptEvent {
  readonly eventType: "user_prompt";
  readonly payload: {
    readonly prompt_length?: number;
  };
  readonly receivedAt: string;
}

// ---------------------------------------------------------------------------
// Aggregated summary
// ---------------------------------------------------------------------------

export interface PromptActivitySummary {
  readonly totalPrompts: number;
  readonly avgLength: number;
  readonly promptsPerMinute: number;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_PROMPT_ACTIVITY_SUMMARY: PromptActivitySummary = {
  totalPrompts: 0,
  avgLength: 0,
  promptsPerMinute: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the time span in minutes between earliest and latest receivedAt. */
const computeTimeSpanMinutes = (events: ReadonlyArray<UserPromptEvent>): number => {
  if (events.length < 2) return 0;
  const timestamps = events.map((e) => Date.parse(e.receivedAt));
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  return (latest - earliest) / 60000;
};

/** Sum all prompt_length values, treating missing as 0. */
const sumPromptLengths = (events: ReadonlyArray<UserPromptEvent>): number =>
  events.reduce((sum, e) => sum + (e.payload.prompt_length ?? 0), 0);

// ---------------------------------------------------------------------------
// Aggregator (pure function)
// ---------------------------------------------------------------------------

export const aggregatePromptActivity = (
  events: ReadonlyArray<UserPromptEvent>,
): PromptActivitySummary => {
  if (events.length === 0) return EMPTY_PROMPT_ACTIVITY_SUMMARY;

  const totalPrompts = events.length;
  const totalLength = sumPromptLengths(events);
  const avgLength = totalLength / totalPrompts;
  const timeSpanMinutes = computeTimeSpanMinutes(events);
  const promptsPerMinute = timeSpanMinutes > 0 ? totalPrompts / timeSpanMinutes : 0;

  return {
    totalPrompts,
    avgLength,
    promptsPerMinute,
  };
};
