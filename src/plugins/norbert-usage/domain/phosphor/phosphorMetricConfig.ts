/**
 * Phosphor metric configuration — pure data.
 *
 * Three user-toggleable Y-axis metrics for the Performance Monitor v2
 * phosphor scope. Each entry declares the display name, unit, Y-axis
 * maximum, and legend caption. Values are sourced from the prototype
 * (docs/design/performance-monitor-phosphor-prototype.html).
 *
 * Also exports:
 *   - `MetricId` union — the business-language enumeration of supported
 *     metrics. Using a union over a raw string makes illegal metric values
 *     unrepresentable in downstream types.
 *   - `SESSION_COLORS` — stable palette (rose, violet, emerald, amber, sky)
 *     indexed by session registration order. Five entries ≥ the minimum
 *     concurrent-session count Phil expects.
 *   - `RateSample`, `PulseKind`, `Pulse` — seam types used by the phosphor
 *     domain. Defined here (not in `adapters/` or `domain/types.ts`) so
 *     pure modules under `domain/phosphor/` remain self-contained and do
 *     not cross the dependency-cruiser boundary.
 *
 * Also exports window/lifetime constants to eliminate magic numbers
 * downstream.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`,
 * or `domain/oscilloscope`.
 */

// ---------------------------------------------------------------------------
// Metric identifiers and configuration
// ---------------------------------------------------------------------------

/** Business-language identifier for each supported Y-axis metric. */
export type MetricId = "events" | "tokens" | "toolcalls";

/** Ordered list for iteration where a canonical order is needed. */
export const METRIC_IDS: ReadonlyArray<MetricId> = ["events", "tokens", "toolcalls"];

export interface MetricConfig {
  readonly id: MetricId;
  readonly name: string;
  readonly unit: string;
  readonly yMax: number;
  readonly caption: string;
}

/**
 * Per-metric display configuration.
 *
 * yMax values are chosen so that the prototype's typical envelopes sit in
 * the middle third of the scope: events up to ~10 evt/s, tokens up to
 * ~80 tok/s, tool-calls up to ~2 calls/s. See prototype HTML.
 */
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

// ---------------------------------------------------------------------------
// Session color palette
// ---------------------------------------------------------------------------

/**
 * Stable color palette for per-session traces. A session's color is its
 * registration-order index modulo the palette length; this makes color
 * assignment deterministic and palette-bounded.
 *
 * Palette entries (rose, violet, emerald, amber, sky) come from the
 * prototype's visual spec. Minimum five entries ensures palette-wrap is
 * only hit beyond the typical concurrent-session count.
 */
export const SESSION_COLORS: ReadonlyArray<string> = [
  "#f472b6", // rose
  "#a78bfa", // violet
  "#34d399", // emerald
  "#fbbf24", // amber
  "#60a5fa", // sky
];

/** Select the session's color by registration index, with modulo wrap. */
export const colorForSessionIndex = (index: number): string =>
  SESSION_COLORS[((index % SESSION_COLORS.length) + SESSION_COLORS.length) % SESSION_COLORS.length];

// ---------------------------------------------------------------------------
// Window and pulse lifetime constants
// ---------------------------------------------------------------------------

/** Rolling time window rendered on the scope (ms). */
export const WINDOW_MS = 60_000;

/** Cadence at which rate samples are emitted upstream (ms). */
export const RATE_TICK_MS = 5_000;

/** Pulse visual lifetime — after this age, pulses are absent from frames. */
export const PULSE_LIFETIME_MS = 2_500;

/** Pulse storage retention — pulses older than this are absent from the store. */
export const PULSE_RETENTION_MS = 5_000;

// ---------------------------------------------------------------------------
// Rate + pulse value shapes (seam types for domain/phosphor)
// ---------------------------------------------------------------------------

/**
 * A time-stamped rate sample for a single metric. `v` is always a
 * non-negative rate expressed in the metric's unit (e.g. events/s).
 */
export interface RateSample {
  readonly t: number;
  readonly v: number;
}

/** The kinds of hook activity that can emit a pulse on the scope. */
export type PulseKind = "tool" | "subagent" | "lifecycle";

/**
 * Relative visual strength by pulse kind (tool > subagent > lifecycle).
 * Each entry is in the closed interval [0, 1].
 */
export const PULSE_STRENGTHS: Readonly<Record<PulseKind, number>> = {
  tool: 1.0,
  subagent: 0.75,
  lifecycle: 0.5,
};

export interface Pulse {
  readonly t: number;
  readonly strength: number;
  readonly kind: PulseKind;
}
