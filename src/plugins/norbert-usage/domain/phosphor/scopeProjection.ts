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
 *   - `pulses` is projected from the store's per-session pulse log; empty
 *     when the store has no pulses for any session (fresh sessions, or all
 *     pulses aged out past the retention cutoff).
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
  PULSE_LIFETIME_MS,
  WINDOW_MS,
  type MetricId,
  type Pulse,
  type RateSample,
} from "./phosphorMetricConfig";
import { decayFactor } from "./pulseTiming";

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
  /**
   * Retrieve a session's pulse log. When `now` is supplied, the store
   * prunes pulses older than its retention window; without `now`, the
   * raw log is returned. `buildFrame` always passes `now`.
   */
  readonly getPulses: (
    sessionId: string,
    now?: number,
  ) => ReadonlyArray<Pulse>;
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

/**
 * Honest-signal sample lookup for a pulse's vertical position: find the
 * value at (or most recently before) time `t` in the session's rate
 * history. Returns `0` (baseline) when no sample at-or-before `t` exists
 * — a session with no arrived history still projects its pulses at
 * baseline, without fabricating rate samples that were never observed.
 *
 * No interpolation between samples. The vertical position is literally
 * the last observed arrival value, which is what "honest signal" means
 * in the phosphor scope design (see v2-phosphor-architecture.md §5 Q1).
 */
const sampleAt = (samples: ReadonlyArray<RateSample>, t: number): number => {
  let latestValue = 0;
  let latestTime = Number.NEGATIVE_INFINITY;
  for (const sample of samples) {
    if (sample.t <= t && sample.t >= latestTime) {
      latestTime = sample.t;
      latestValue = sample.v;
    }
  }
  return latestValue;
};

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

/**
 * Project a single pulse into a `FramePulse`. The vertical position (`v`)
 * is looked up from the session's trace samples at the pulse's time —
 * this enforces the honest-signal invariant: a pulse sits on the trace
 * line, not between interpolated points.
 */
const projectPulse = (
  pulse: Pulse,
  trace: FrameTrace,
  now: number,
): FramePulse => ({
  sessionId: trace.sessionId,
  t: pulse.t,
  v: sampleAt(trace.samples, pulse.t),
  decay: decayFactor(now - pulse.t, PULSE_LIFETIME_MS),
  strength: pulse.strength,
  kind: pulse.kind,
  color: trace.color,
});

/**
 * Project all visible pulses for a single session's trace. "Visible"
 * means `decay > 0` — pulses at or past the lifetime boundary are absent
 * from the frame even if the store still retains them (retention window
 * > visual lifetime by design).
 */
const projectPulsesForTrace = (
  trace: FrameTrace,
  store: PhosphorStoreSurface,
  now: number,
): ReadonlyArray<FramePulse> => {
  const pulses = store.getPulses(trace.sessionId, now);
  const projected: FramePulse[] = [];
  for (const pulse of pulses) {
    const framePulse = projectPulse(pulse, trace, now);
    if (framePulse.decay > 0) projected.push(framePulse);
  }
  return projected;
};

/**
 * Stable sort by strength descending. Pulses with higher strength appear
 * first; equal-strength pulses preserve their input relative order (stable).
 *
 * Renderer contract: the dominant flare (tool, strength 1.0) paints on top
 * of softer pulses (subagent 0.75, lifecycle 0.5), so the frame must expose
 * pulses in strength-descending order regardless of store insertion order.
 *
 * Returns a NEW array; the input is never mutated.
 */
const sortPulsesByStrengthDescending = (
  pulses: ReadonlyArray<FramePulse>,
): ReadonlyArray<FramePulse> => {
  // Decorate-sort-undecorate to guarantee stability under engines whose
  // Array#sort is stable (Node/V8 since 10.x). The index tiebreak keeps
  // equal-strength pulses in their original relative order.
  const decorated = pulses.map((pulse, index) => ({ pulse, index }));
  decorated.sort((a, b) => {
    if (b.pulse.strength !== a.pulse.strength) {
      return b.pulse.strength - a.pulse.strength;
    }
    return a.index - b.index;
  });
  return decorated.map((entry) => entry.pulse);
};

// ---------------------------------------------------------------------------
// buildFrame — the driving port
// ---------------------------------------------------------------------------

/**
 * Pure projection. Deterministic in (store snapshot, metric, now). No side
 * effects, no hidden state.
 *
 * Contract:
 *   - One trace per session returned by `store.getSessionIds()`.
 *   - Trace samples are the session's arrived rate history, trimmed to
 *     the 60s window ending at `now`.
 *   - Trace color is assigned by session-registration index into
 *     `SESSION_COLORS` (palette-wrapping beyond its length).
 *   - `latestValue` is the most recent raw arrived value, or `null`.
 *   - `yMax` and `unit` come from `METRICS[metric]`.
 *   - `pulses` contains one `FramePulse` per still-visible pulse across
 *     all sessions. A pulse is visible iff `decay(age, PULSE_LIFETIME_MS)`
 *     is greater than 0; pulses at or past the lifetime are absent even
 *     if the store retains them (retention > lifetime by design). Pulses
 *     are sorted by strength descending (stable within equal strength),
 *     so the dominant flare renders on top of softer ones.
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
  const pulses = sortPulsesByStrengthDescending(
    traces.flatMap((trace) => projectPulsesForTrace(trace, store, now)),
  );
  const legend = traces.map(legendEntryFor);
  const config = METRICS[metric];
  return {
    now,
    metric,
    yMax: config.yMax,
    unit: config.unit,
    traces,
    pulses,
    legend,
  };
};
