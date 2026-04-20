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

/**
 * The metric the Performance Monitor shows at first launch and on initial
 * render of the phosphor scope view. Single source of truth for the
 * first-launch metric — views initialize their `selectedMetric` state from
 * this constant rather than hard-coding `"events"`.
 *
 * Events per second is the default because it blends hook activity with
 * OTel log arrivals and is the most human-legible signal for Phil's
 * typical "is anything happening" glance at the scope.
 */
export const DEFAULT_METRIC: MetricId = "events";

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

/**
 * Per-metric floors for dynamic Y-axis auto-scaling. The floor is the
 * smallest reasonable axis ceiling — not a display preference. It exists to
 * prevent degenerate cases where `niceCeil` would resolve to 0 or a sub-
 * unit value; it should NOT hold the axis artificially high when real
 * traffic is quieter than the floor. A low-activity session peaking at
 * ~0.8 evt/s resolves to `niceCeil(0.96) = 1` and the floor must not
 * push that up to some higher number — otherwise the trace hugs the
 * bottom of the canvas and Phil's "most of my data is at the bottom of
 * the plot" complaint returns.
 *
 * Calibration: 1 evt/s and 5 tok/s are the smallest nice values at which
 * the axis labels remain legible; `toolcalls` is already sparse so 1 is
 * the natural smallest useful ceiling.
 */
export const YMAX_FLOOR: Readonly<Record<MetricId, number>> = {
  events: 1,
  tokens: 5,
  toolcalls: 1,
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
