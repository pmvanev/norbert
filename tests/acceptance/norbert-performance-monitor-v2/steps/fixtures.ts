/**
 * Shared fixtures and types for Performance Monitor v2 (Phosphor) acceptance tests.
 *
 * These types describe the driving-port surfaces that the DELIVER wave will
 * implement. Keeping them here lets the acceptance tests compile incrementally
 * while the crafter implements each module.
 *
 * Driving ports (target, not yet implemented):
 *   - buildFrame(store, metric, now): Frame
 *   - scopeHitTest(pointer, frame): HoverSelection | null
 *   - multiSessionStore.appendRateSample(sessionId, metric, t, v)
 *   - multiSessionStore.appendPulse(sessionId, pulse)
 *   - multiSessionStore.getRateHistory(sessionId, metric)
 *   - multiSessionStore.getPulses(sessionId)
 *   - hookProcessor derivation helpers (derive events/s, tokens/s, toolcalls/s, emit pulse)
 *
 * Business language only: session, trace, pulse, flare, metric, scope, hover.
 */

// ---------------------------------------------------------------------------
// Metric identifiers (business-language enumeration)
// ---------------------------------------------------------------------------

export type MetricId = "events" | "tokens" | "toolcalls";

export interface MetricConfig {
  readonly id: MetricId;
  readonly name: string;
  readonly unit: string;
  readonly yMax: number;
  readonly caption: string;
}

// Prototype-derived values (docs/design/performance-monitor-phosphor-prototype.html).
export const METRICS: Readonly<Record<MetricId, MetricConfig>> = {
  events: {
    id: "events",
    name: "Events per second",
    unit: "evt/s",
    yMax: 15,
    caption: "Events/s blends hook events with OTel log arrivals.",
  },
  tokens: {
    id: "tokens",
    name: "Tokens per second",
    unit: "tok/s",
    yMax: 100,
    caption: "Tokens/s is throughput-proper.",
  },
  toolcalls: {
    id: "toolcalls",
    name: "Tool-calls per second",
    unit: "calls/s",
    yMax: 3,
    caption: "Tool-calls/s is sparsest and most diagnostic.",
  },
};

// Prototype palette — stable session colors indexed by session registration order.
export const SESSION_COLORS = [
  "#f472b6", // rose
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fbbf24", // amber
  "#60a5fa", // sky
] as const;

export const WINDOW_MS = 60_000;
export const RATE_TICK_MS = 5_000;
export const PULSE_LIFETIME_MS = 2_500;
export const PULSE_RETENTION_MS = 5_000;
export const HOVER_SNAP_DISTANCE_PX = 18;

// ---------------------------------------------------------------------------
// Rate samples and pulses
// ---------------------------------------------------------------------------

export interface RateSample {
  readonly t: number;
  readonly v: number;
}

export type PulseKind = "tool" | "subagent" | "lifecycle";

export interface Pulse {
  readonly t: number;
  readonly strength: number;
  readonly kind: PulseKind;
}

// Pulse kind strength convention (from design doc Q1):
//   tool > subagent > lifecycle (tool use is the strongest visual flare)
export const PULSE_STRENGTHS: Readonly<Record<PulseKind, number>> = {
  tool: 1.0,
  subagent: 0.75,
  lifecycle: 0.5,
};

// ---------------------------------------------------------------------------
// Frame (output of buildFrame) — the driving-port return shape
// ---------------------------------------------------------------------------

export interface FrameTraceSample {
  readonly t: number;
  readonly v: number;
}

export interface FrameTrace {
  readonly sessionId: string;
  readonly color: string;
  readonly samples: ReadonlyArray<FrameTraceSample>;
  readonly latestValue: number | null;
}

export interface FramePulse {
  readonly sessionId: string;
  readonly t: number;
  readonly v: number; // trace value at pulse time (for vertical positioning)
  readonly decay: number; // 0..1, where 1 is fresh and 0 is at lifetime boundary
  readonly strength: number;
  readonly kind: PulseKind;
  readonly color: string;
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

export interface LegendEntry {
  readonly sessionId: string;
  readonly color: string;
  readonly latestValue: number | null;
}

// ---------------------------------------------------------------------------
// Hover selection (output of scopeHitTest)
// ---------------------------------------------------------------------------

export interface PointerPosition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface HoverSelection {
  readonly sessionId: string;
  readonly color: string;
  readonly value: number;
  readonly time: number;
  readonly ageMs: number;
  readonly displayX: number;
  readonly displayY: number;
}

// ---------------------------------------------------------------------------
// Store surface (target shape for multiSessionStore's new public API)
// ---------------------------------------------------------------------------

export interface MultiSessionStoreSurface {
  readonly addSession: (sessionId: string) => void;
  readonly removeSession: (sessionId: string) => void;
  readonly appendRateSample: (sessionId: string, metric: MetricId, t: number, v: number) => void;
  readonly appendPulse: (sessionId: string, pulse: Pulse) => void;
  readonly getRateHistory: (sessionId: string, metric: MetricId) => ReadonlyArray<RateSample>;
  readonly getPulses: (sessionId: string) => ReadonlyArray<Pulse>;
  readonly getSessionIds: () => ReadonlyArray<string>;
  readonly subscribe: (callback: () => void) => () => void;
}

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

export const NOW = 1_000_000_000;

export function makeRateSample(tOffsetMsAgo: number, v: number): RateSample {
  return { t: NOW - tOffsetMsAgo, v };
}

export function makePulse(
  tOffsetMsAgo: number,
  kind: PulseKind = "tool",
): Pulse {
  return {
    t: NOW - tOffsetMsAgo,
    kind,
    strength: PULSE_STRENGTHS[kind],
  };
}

/**
 * Generate a synthetic arrived rate history at RATE_TICK_MS cadence ending at
 * NOW, with a caller-supplied value generator. Returns oldest-first order.
 */
export function synthesizeArrivedHistory(
  count: number,
  valueAt: (index: number) => number,
  tickMs: number = RATE_TICK_MS,
): ReadonlyArray<RateSample> {
  const samples: RateSample[] = [];
  for (let i = count - 1; i >= 0; i--) {
    samples.push({ t: NOW - i * tickMs, v: valueAt(count - 1 - i) });
  }
  return samples;
}
