/**
 * Scope projection — pure transformation from (store, metric, now) to Frame.
 *
 * This is the driving-port pure core for the phosphor scope. A frame is
 * the snapshot the effect-side `PhosphorCanvasHost` renders on each rAF
 * tick. The projection is honest:
 *
 *   - Each active session becomes one trace whose samples are the session's
 *     arrived rate history for the requested metric, trimmed to the 60-second
 *     window ending at `now`. No sub-interval interpolation. No zero-fill.
 *   - Each session's color is deterministic: its registration-order index
 *     modulo `SESSION_COLORS.length`.
 *   - `latestValue` is the most recent arrived sample value (raw, not
 *     EWMA-smoothed) so the legend and trace edge stay honest with the data.
 *   - `pulses` is projected from the store's per-session pulse log (empty
 *     for WS-1 scenarios; populated once WS-2 lands).
 *   - `yMax` and `unit` come from the METRICS config for the requested metric.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`,
 * or `domain/oscilloscope`. The store is consumed via a structural surface
 * (`PhosphorStoreSurface`) so the dependency-cruiser boundary rule for
 * `domain/phosphor/` is not crossed.
 */

import {
  colorForSessionIndex,
  METRICS,
  WINDOW_MS,
  type MetricId,
  type Pulse,
  type RateSample,
} from "./phosphorMetricConfig";

// ---------------------------------------------------------------------------
// Store surface — structural type, satisfied by adapters/multiSessionStore
// ---------------------------------------------------------------------------

/**
 * The minimum store surface required by `buildFrame`. Declared here so the
 * phosphor domain does not reach into `adapters/` (which would violate the
 * functional-paradigm boundary). Any implementation whose method
 * signatures match this interface is a valid projection source.
 */
export interface PhosphorStoreSurface {
  readonly getSessionIds: () => ReadonlyArray<string>;
  readonly getRateHistory: (
    sessionId: string,
    metric: MetricId,
  ) => ReadonlyArray<RateSample>;
  readonly getPulses: (sessionId: string) => ReadonlyArray<Pulse>;
}

// ---------------------------------------------------------------------------
// Frame output shapes — what the effect-side canvas host consumes
// ---------------------------------------------------------------------------

export interface FrameTrace {
  readonly sessionId: string;
  readonly color: string;
  readonly samples: ReadonlyArray<RateSample>;
  readonly latestValue: number | null;
}

export interface FramePulse {
  readonly sessionId: string;
  readonly t: number;
  readonly v: number;
  readonly decay: number;
  readonly strength: number;
  readonly kind: Pulse["kind"];
  readonly color: string;
}

export interface LegendEntry {
  readonly sessionId: string;
  readonly color: string;
  readonly latestValue: number | null;
}

export interface Frame {
  readonly now: number;
  readonly metric: MetricId;
  readonly yMax: number;
  readonly unit: string;
  readonly traces: ReadonlyArray<FrameTrace>;
  readonly pulses: ReadonlyArray<FramePulse>;
  readonly legend: ReadonlyArray<LegendEntry>;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Keep only samples whose timestamp is inside the 60-second window ending
 * at `now`. Window-trimming is idempotent — calling repeatedly with the
 * same (history, now) produces the same result.
 */
const trimToWindow = (
  samples: ReadonlyArray<RateSample>,
  now: number,
): ReadonlyArray<RateSample> => {
  const cutoff = now - WINDOW_MS;
  // Filter (not slice) so callers may pass histories that are not strictly
  // sorted by time without risking incorrect truncation.
  return samples.filter((s) => s.t >= cutoff);
};

/** Latest sample's `v`, or `null` when the history is empty. */
const latestValueOf = (samples: ReadonlyArray<RateSample>): number | null =>
  samples.length === 0 ? null : samples[samples.length - 1].v;

/** Project a single session's trace for the requested metric. */
const projectTrace = (
  sessionId: string,
  index: number,
  store: PhosphorStoreSurface,
  metric: MetricId,
  now: number,
): FrameTrace => {
  const color = colorForSessionIndex(index);
  const history = store.getRateHistory(sessionId, metric);
  const samples = trimToWindow(history, now);
  return {
    sessionId,
    color,
    samples,
    latestValue: latestValueOf(samples),
  };
};

/** Derive the legend row for a trace — same identity triple. */
const legendEntryFor = (trace: FrameTrace): LegendEntry => ({
  sessionId: trace.sessionId,
  color: trace.color,
  latestValue: trace.latestValue,
});

// ---------------------------------------------------------------------------
// buildFrame — the driving port
// ---------------------------------------------------------------------------

/**
 * Pure projection. Deterministic in (store snapshot, metric, now). No side
 * effects, no hidden state.
 *
 * WS-1 contract:
 *   - One trace per session returned by `store.getSessionIds()`.
 *   - Trace samples are the session's arrived rate history, trimmed to
 *     the 60s window ending at `now`.
 *   - Trace color is assigned by session-registration index into
 *     `SESSION_COLORS` (palette-wrapping beyond its length).
 *   - `latestValue` is the most recent raw arrived value, or `null`.
 *   - `yMax` and `unit` come from `METRICS[metric]`.
 *   - `pulses` is empty for WS-1 (pulse projection lands in WS-2).
 *   - `legend` parallels `traces` 1:1.
 */
export const buildFrame = (
  store: PhosphorStoreSurface,
  metric: MetricId,
  now: number,
): Frame => {
  const sessionIds = store.getSessionIds();
  const traces = sessionIds.map((sessionId, index) =>
    projectTrace(sessionId, index, store, metric, now),
  );
  const legend = traces.map(legendEntryFor);
  const config = METRICS[metric];
  return {
    now,
    metric,
    yMax: config.yMax,
    unit: config.unit,
    traces,
    pulses: [],
    legend,
  };
};
