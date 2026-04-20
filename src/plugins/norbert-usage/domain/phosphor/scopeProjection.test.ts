/**
 * Unit tests: buildFrame — pure projection from (store, metric, now) to Frame.
 *
 * Behaviors:
 *   1. One trace per session returned by store.getSessionIds().
 *   2. Each trace carries the session's color assigned by registration order
 *      (SESSION_COLORS[0], SESSION_COLORS[1], ...).
 *   3. Each trace's samples come from the session's arrived rate history for
 *      the requested metric.
 *   4. Each trace's latestValue is the most recent arrived sample value
 *      (null when the session has no history).
 *   5. The frame's yMax and unit come from METRICS[metric].
 *   6. The legend parallels the traces with the same (sessionId, color,
 *      latestValue) triples.
 *   7. pulses is empty for WS-1 (no pulses in the store).
 *   8. Only samples within the 60-second window back from `now` appear in
 *      trace samples.
 *
 * No effects; pure function under test. A minimal in-test store object
 * satisfying the structural surface is used to isolate the projection.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { buildFrame, type PhosphorStoreSurface } from "./scopeProjection";
import {
  METRICS,
  PULSE_STRENGTHS,
  SESSION_COLORS,
  YMAX_FLOOR,
  type MetricId,
  type Pulse,
  type PulseKind,
  type RateSample,
} from "./phosphorMetricConfig";

// ---------------------------------------------------------------------------
// Minimal store fixture — structural surface, no adapter coupling
// ---------------------------------------------------------------------------

interface FakeStoreSeed {
  readonly sessions: ReadonlyArray<{
    readonly id: string;
    readonly label?: string;
    readonly rates?: Partial<Record<MetricId, ReadonlyArray<RateSample>>>;
    readonly pulses?: ReadonlyArray<Pulse>;
  }>;
}

const makeFakeStore = (seed: FakeStoreSeed): PhosphorStoreSurface => {
  const order = seed.sessions.map((s) => s.id);
  const rateMap = new Map<string, Map<MetricId, ReadonlyArray<RateSample>>>();
  const pulseMap = new Map<string, ReadonlyArray<Pulse>>();
  const labelMap = new Map<string, string>();
  for (const s of seed.sessions) {
    const metricMap = new Map<MetricId, ReadonlyArray<RateSample>>();
    for (const metric of ["events", "tokens", "toolcalls"] as const) {
      metricMap.set(metric, s.rates?.[metric] ?? []);
    }
    rateMap.set(s.id, metricMap);
    pulseMap.set(s.id, s.pulses ?? []);
    if (s.label !== undefined) labelMap.set(s.id, s.label);
  }
  return {
    getSessionIds: () => order,
    getRateHistory: (sessionId, metric) => rateMap.get(sessionId)?.get(metric) ?? [],
    getPulses: (sessionId) => pulseMap.get(sessionId) ?? [],
    getSessionLabel: (sessionId) => labelMap.get(sessionId),
  };
};

const NOW = 1_000_000_000;
const TICK = 5_000;

const history = (count: number, valueAt: (i: number) => number): ReadonlyArray<RateSample> => {
  const samples: RateSample[] = [];
  for (let i = count - 1; i >= 0; i--) {
    samples.push({ t: NOW - i * TICK, v: valueAt(count - 1 - i) });
  }
  return samples;
};

// ---------------------------------------------------------------------------
// Trace projection
// ---------------------------------------------------------------------------

describe("buildFrame — trace projection", () => {
  it("returns one trace per session from getSessionIds", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "s1", rates: { events: history(6, () => 4) } },
        { id: "s2", rates: { events: history(6, () => 7) } },
        { id: "s3", rates: { events: history(6, () => 2) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces).toHaveLength(3);
    expect(frame.traces.map((t) => t.sessionId)).toEqual(["s1", "s2", "s3"]);
  });

  it("assigns session colors by registration order from SESSION_COLORS", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "first", rates: { events: history(3, () => 1) } },
        { id: "second", rates: { events: history(3, () => 1) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces[0].color).toBe(SESSION_COLORS[0]);
    expect(frame.traces[1].color).toBe(SESSION_COLORS[1]);
  });

  it("wraps color palette when session count exceeds palette length", () => {
    const sessions = Array.from({ length: SESSION_COLORS.length + 2 }, (_, i) => ({
      id: `s${i}`,
      rates: { events: history(2, () => 1) as ReadonlyArray<RateSample> },
    }));
    const store = makeFakeStore({ sessions });
    const frame = buildFrame(store, "events", NOW);
    // Session at palette-length index wraps back to SESSION_COLORS[0].
    expect(frame.traces[SESSION_COLORS.length].color).toBe(SESSION_COLORS[0]);
  });

  it("each trace carries the session's arrived history for the requested metric", () => {
    const tokenHistory = history(4, (i) => 30 + i * 5); // 30, 35, 40, 45 -> latest 45
    const eventHistory = history(4, () => 1);
    const store = makeFakeStore({
      sessions: [
        { id: "s1", rates: { events: eventHistory, tokens: tokenHistory } },
      ],
    });
    const frame = buildFrame(store, "tokens", NOW);
    const trace = frame.traces[0];
    expect(trace.samples.map((s) => s.v)).toEqual([30, 35, 40, 45]);
  });

  it("trace.latestValue equals the most recent arrived sample value", () => {
    const h = history(5, (i) => 2 + i); // 2,3,4,5,6 -> latest 6
    const store = makeFakeStore({ sessions: [{ id: "s1", rates: { events: h } }] });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces[0].latestValue).toBe(6);
  });

  it("trace.latestValue is null when session has no history for the metric", () => {
    const store = makeFakeStore({ sessions: [{ id: "s1" }] });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces[0].latestValue).toBeNull();
    expect(frame.traces[0].samples).toHaveLength(0);
  });

  it("excludes samples older than the 60-second window", () => {
    const stale: RateSample = { t: NOW - 120_000, v: 999 };
    const fresh: RateSample = { t: NOW - 10_000, v: 5 };
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { events: [stale, fresh] } }],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces[0].samples).toEqual([fresh]);
  });
});

// ---------------------------------------------------------------------------
// Frame-level metadata
// ---------------------------------------------------------------------------

describe("buildFrame — frame metadata", () => {
  it("sets metric, yMax, unit, and now from METRICS config and argument", () => {
    const store = makeFakeStore({ sessions: [] });
    const frame = buildFrame(store, "tokens", NOW);
    expect(frame.metric).toBe("tokens");
    expect(frame.yMax).toBe(METRICS.tokens.yMax);
    expect(frame.unit).toBe(METRICS.tokens.unit);
    expect(frame.now).toBe(NOW);
  });

  it("has empty pulses array when store has no pulses", () => {
    const store = makeFakeStore({ sessions: [{ id: "s1" }] });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.pulses).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

describe("buildFrame — legend", () => {
  it("lists one legend entry per session with session color and latest value", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "alpha", rates: { events: history(3, () => 4) } },
        { id: "beta", rates: { events: history(3, (i) => 10 + i) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.legend).toHaveLength(2);
    // Legend entries carry the same (sessionId, color, latestValue) triple
    // as before plus the new `displayLabel`. Using `toMatchObject` keeps the
    // core-triple assertion intact while allowing additive fields.
    expect(frame.legend[0]).toMatchObject({
      sessionId: "alpha",
      color: SESSION_COLORS[0],
      latestValue: 4,
    });
    expect(frame.legend[1]).toMatchObject({
      sessionId: "beta",
      color: SESSION_COLORS[1],
      latestValue: 12,
    });
  });

  it("reports null latestValue for sessions with no arrived history", () => {
    const store = makeFakeStore({ sessions: [{ id: "silent" }] });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.legend[0].latestValue).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Display label — legend, trace, and hover-selection derived labels
//
// Each session's visible identifier comes from the store's sessionLabel
// (populated from cwd on first hook event, matching the Sessions tab). When
// the label is empty or the store has no label for the session, buildFrame
// falls back to a truncated session id (first 8 chars + ellipsis) so the
// legend and hover tooltip never show a raw UUID.
// ---------------------------------------------------------------------------

describe("buildFrame — display label", () => {
  const UUID = "9ea8ff2a-5207-4e3b-9bba-3fffffffffff";

  it("uses the store-provided session label when non-empty", () => {
    const store = makeFakeStore({
      sessions: [{ id: UUID, label: "norbert" }],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces[0].displayLabel).toBe("norbert");
    expect(frame.legend[0].displayLabel).toBe("norbert");
  });

  it("falls back to the truncated session id when the label is empty string", () => {
    const store = makeFakeStore({
      sessions: [{ id: UUID, label: "" }],
    });
    const frame = buildFrame(store, "events", NOW);
    // Truncate to first 8 chars + ellipsis.
    expect(frame.traces[0].displayLabel).toBe("9ea8ff2a…");
    expect(frame.legend[0].displayLabel).toBe("9ea8ff2a…");
  });

  it("falls back to the truncated session id when the store has no label for the session", () => {
    const store = makeFakeStore({
      sessions: [{ id: UUID }], // no label key at all
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces[0].displayLabel).toBe("9ea8ff2a…");
    expect(frame.legend[0].displayLabel).toBe("9ea8ff2a…");
  });

  it("does not add an ellipsis when the session id is already 8 characters or fewer", () => {
    const store = makeFakeStore({
      sessions: [{ id: "short-id" }],
    });
    const frame = buildFrame(store, "events", NOW);
    // "short-id" is exactly 8 chars — no truncation, no ellipsis.
    expect(frame.traces[0].displayLabel).toBe("short-id");
    expect(frame.legend[0].displayLabel).toBe("short-id");
  });
});

// ---------------------------------------------------------------------------
// Pulse ordering (Step 04-02 / PA finding 3)
//
// When multiple pulse kinds coexist within a single frame, the projection
// must expose them sorted by strength descending. This guarantees renderers
// paint the dominant flare (tool) on top and the softest (lifecycle) beneath,
// regardless of store insertion order.
// ---------------------------------------------------------------------------

describe("buildFrame — pulse ordering by strength", () => {
  const pulseAtNow = (kind: PulseKind): Pulse => ({
    t: NOW,
    kind,
    strength: PULSE_STRENGTHS[kind],
  });

  it("sorts three coexisting kinds as tool, subagent, lifecycle descending", () => {
    const store = makeFakeStore({
      sessions: [
        {
          id: "s1",
          rates: { events: history(3, () => 5) },
          // Intentional non-strength insertion order.
          pulses: [
            pulseAtNow("lifecycle"),
            pulseAtNow("tool"),
            pulseAtNow("subagent"),
          ],
        },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.pulses.map((p) => p.kind)).toEqual([
      "tool",
      "subagent",
      "lifecycle",
    ]);
  });

  it("places higher-strength pulses before equal-or-lower-strength pulses", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom<PulseKind>("tool", "subagent", "lifecycle"),
          { minLength: 2, maxLength: 8 },
        ),
        (kinds) => {
          const store = makeFakeStore({
            sessions: [
              {
                id: "s1",
                rates: { events: history(3, () => 5) },
                pulses: kinds.map((kind) => pulseAtNow(kind)),
              },
            ],
          });
          const frame = buildFrame(store, "events", NOW);
          for (let i = 1; i < frame.pulses.length; i++) {
            expect(frame.pulses[i - 1].strength).toBeGreaterThanOrEqual(
              frame.pulses[i].strength,
            );
          }
        },
      ),
    );
  });

  it("is stable within the same strength: preserves relative insertion order", () => {
    // Three tool pulses at distinct timestamps; stable sort must keep them
    // in their original order since all share the same strength.
    const store = makeFakeStore({
      sessions: [
        {
          id: "s1",
          rates: { events: history(3, () => 5) },
          pulses: [
            { t: NOW - 100, kind: "tool", strength: PULSE_STRENGTHS.tool },
            { t: NOW - 300, kind: "tool", strength: PULSE_STRENGTHS.tool },
            { t: NOW - 200, kind: "tool", strength: PULSE_STRENGTHS.tool },
          ],
        },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.pulses.map((p) => p.t)).toEqual([NOW - 100, NOW - 300, NOW - 200]);
  });
});

// ---------------------------------------------------------------------------
// Pulse vertical-position honesty (Step 04-05 / M2-S7, M2-S8)
//
// A pulse's `v` is the session's arrived rate value at (or most recently
// before) the pulse's time. No interpolation, no fabrication. When the
// session has no arrived history at all, the pulse degrades to the zero
// baseline WITHOUT any fabricated sample being inserted into the trace.
//
// These behaviors are lightweight but easy to regress — the branch in
// `sampleAt` that returns 0 for empty history, and the exact-match lookup
// for a sample coincident with the pulse time.
// ---------------------------------------------------------------------------

describe("buildFrame — pulse vertical-position honesty", () => {
  it("pulse v equals the arrived rate value exactly at the pulse's time", () => {
    // Arrived rate of 10 at NOW - 1000; pulse also at NOW - 1000 -> v = 10 exactly.
    const store = makeFakeStore({
      sessions: [
        {
          id: "s1",
          rates: {
            events: [
              { t: NOW - 5000, v: 10 },
              { t: NOW - 1000, v: 10 },
            ],
          },
          pulses: [
            { t: NOW - 1000, kind: "tool", strength: PULSE_STRENGTHS.tool },
          ],
        },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    const pulse = frame.pulses.find((p) => p.sessionId === "s1");
    expect(pulse).toBeDefined();
    expect(pulse!.v).toBe(10);
  });

  it("pulse v uses the most recent arrived value at-or-before the pulse time (no interpolation)", () => {
    // Two bracketing samples: 4 at NOW - 2000 and 12 at NOW - 500.
    // Pulse at NOW - 1000 falls between them. Honest lookup returns 4
    // (the sample at-or-before the pulse), NOT an interpolated 8.
    const store = makeFakeStore({
      sessions: [
        {
          id: "s1",
          rates: {
            events: [
              { t: NOW - 2000, v: 4 },
              { t: NOW - 500, v: 12 },
            ],
          },
          pulses: [
            { t: NOW - 1000, kind: "tool", strength: PULSE_STRENGTHS.tool },
          ],
        },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    const pulse = frame.pulses.find((p) => p.sessionId === "s1");
    expect(pulse).toBeDefined();
    expect(pulse!.v).toBe(4);
  });

  it("pulse v is 0 when the session has no arrived rate history (baseline)", () => {
    // Session exists with a pulse but zero arrived samples.
    // Pulse must degrade to v = 0, and the trace must remain empty
    // (no fabricated sample).
    const store = makeFakeStore({
      sessions: [
        {
          id: "s1",
          pulses: [
            { t: NOW, kind: "lifecycle", strength: PULSE_STRENGTHS.lifecycle },
          ],
        },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    const pulse = frame.pulses.find((p) => p.sessionId === "s1");
    expect(pulse).toBeDefined();
    expect(pulse!.v).toBe(0);

    const trace = frame.traces.find((t) => t.sessionId === "s1");
    expect(trace).toBeDefined();
    expect(trace!.samples).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Dynamic yMax auto-scaling
//
// When opts.yMaxMode is "dynamic", buildFrame computes yMax from the 60s-
// window peak across all active sessions' samples, snapped to the next nice
// number (niceCeil(peak * 1.2)), then clamped to [YMAX_FLOOR, METRICS.yMax].
// When the store is empty or has no samples, the resolved yMax falls back
// to METRICS[metric].yMax (the fixed cap).
//
// The default mode ("fixed", also the absence of opts) preserves the
// pre-existing acceptance-test contract: yMax always equals METRICS.yMax.
// ---------------------------------------------------------------------------

describe("buildFrame — yMax resolution (fixed mode, default)", () => {
  it("defaults to fixed mode when opts is omitted — yMax equals METRICS.yMax", () => {
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { events: history(3, () => 2) } }],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.yMax).toBe(METRICS.events.yMax);
  });

  it("uses fixed cap when opts.yMaxMode is explicitly 'fixed'", () => {
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { events: history(3, () => 2) } }],
    });
    const frame = buildFrame(store, "events", NOW, { yMaxMode: "fixed" });
    expect(frame.yMax).toBe(METRICS.events.yMax);
  });
});

describe("buildFrame — yMax resolution (dynamic mode)", () => {
  it("uses METRICS.yMax as-is when the store has no sessions", () => {
    const store = makeFakeStore({ sessions: [] });
    const frame = buildFrame(store, "events", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(METRICS.events.yMax);
  });

  it("uses METRICS.yMax as-is when sessions have no samples in-window", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "s1" }, // no rates at all
        { id: "s2", rates: { events: [{ t: NOW - 120_000, v: 99 }] } }, // stale
      ],
    });
    const frame = buildFrame(store, "events", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(METRICS.events.yMax);
  });

  it("snaps low peaks up to the floor (events floor is 1)", () => {
    // peak = 0.2 evt/s; niceCeil(0.24) = 1; floor (events) = 1; cap = 15.
    // Resolved yMax clamps up to the floor when niceCeil lands below it —
    // here niceCeil already equals the floor, so no adjustment is needed
    // but the contract still holds: floor <= resolved <= cap.
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { events: history(3, () => 0.2) } }],
    });
    const frame = buildFrame(store, "events", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(YMAX_FLOOR.events);
  });

  it("picks the next nice number above peak * 1.2 for mid-range peaks", () => {
    // peak = 5 evt/s; peak * 1.2 = 6; niceCeil(6) = 7; within [1, 15].
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { events: history(3, () => 5) } }],
    });
    const frame = buildFrame(store, "events", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(7);
  });

  it("clamps to the METRICS.yMax cap when peak would produce a higher nice number", () => {
    // peak = 14 evt/s; peak * 1.2 = 16.8; niceCeil(16.8) = 20; clamp to
    // events cap (15). A user watching a spike near the cap gets the cap,
    // not 20.
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { events: history(3, () => 14) } }],
    });
    const frame = buildFrame(store, "events", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(METRICS.events.yMax);
  });

  it("gathers the peak across all active sessions", () => {
    // Three sessions with peaks 2, 7, 3. Overall peak = 7. peak * 1.2 = 8.4;
    // niceCeil(8.4) = 10.
    const store = makeFakeStore({
      sessions: [
        { id: "s1", rates: { events: history(3, () => 2) } },
        { id: "s2", rates: { events: history(3, () => 7) } },
        { id: "s3", rates: { events: history(3, () => 3) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(10);
  });

  it("ignores samples outside the 60s window when computing peak", () => {
    // One stale sample at v=999 (older than 60s) and a fresh sample at v=2.
    // Stale sample is outside the window and must not drive the scale.
    // peak = 2; peak * 1.2 = 2.4; niceCeil(2.4) = 3; events floor = 1 and
    // cap = 15 so no clamp; resolved = 3.
    const store = makeFakeStore({
      sessions: [
        {
          id: "s1",
          rates: {
            events: [
              { t: NOW - 120_000, v: 999 },
              { t: NOW - 10_000, v: 2 },
            ],
          },
        },
      ],
    });
    const frame = buildFrame(store, "events", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(3);
  });

  it("reads from the requested metric's history only", () => {
    // Tokens history has a spike at 5000, events history is quiet at 1.
    // When the caller requests 'tokens', the tokens spike drives the scale.
    // (Tokens/min scales up two orders of magnitude from evt/s, so the
    // spike value must be large enough to dominate.)
    const store = makeFakeStore({
      sessions: [
        {
          id: "s1",
          rates: {
            events: history(3, () => 1),
            tokens: history(3, () => 5000),
          },
        },
      ],
    });
    const frame = buildFrame(store, "tokens", NOW, { yMaxMode: "dynamic" });
    // peak = 5000; peak * 1.2 = 6000; niceCeil(6000) = 7000; under cap.
    expect(frame.yMax).toBe(7000);
  });

  it("clamps up to floor for toolcalls when peak is tiny", () => {
    // peak = 0.1 calls/s; niceCeil(0.12) = 1; toolcalls floor = 1; cap = 3.
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { toolcalls: history(3, () => 0.1) } }],
    });
    const frame = buildFrame(store, "toolcalls", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(YMAX_FLOOR.toolcalls);
  });

  it("never exceeds the fixed cap regardless of sample spikes", () => {
    // peak = 1_000_000 tok/min (far above the tokens cap); niceCeil of
    // 1_200_000 would exceed METRICS.tokens.yMax so the resolver clamps.
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { tokens: history(3, () => 1_000_000) } }],
    });
    const frame = buildFrame(store, "tokens", NOW, { yMaxMode: "dynamic" });
    expect(frame.yMax).toBe(METRICS.tokens.yMax);
  });
});

// ---------------------------------------------------------------------------
// Hidden-session filtering — drives the legend-click "hide trace" feature
//
// `buildFrame` accepts an optional `hiddenSessions: ReadonlySet<string>`.
// Sessions named there are:
//   - EXCLUDED from `frame.traces` (so the canvas host does not draw them
//     and `scopeHitTest` naturally skips them).
//   - EXCLUDED from `frame.pulses` (a hidden session's pulses must not
//     flash on an otherwise-empty column).
//   - STILL PRESENT in `frame.legend` with `hidden: true` so the user can
//     un-hide them. Visible sessions carry `hidden: false`.
// Dynamic yMax computes its peak from VISIBLE sessions only — hiding a
// spiky session lets the remaining traces fill the canvas.
// Default (omitted option, or empty set) preserves existing behavior.
// ---------------------------------------------------------------------------

describe("buildFrame — hidden-session filtering", () => {
  it("excludes hidden sessions from frame.traces", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "visible", rates: { events: history(3, () => 5) } },
        { id: "hidden", rates: { events: history(3, () => 7) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW, {
      hiddenSessions: new Set(["hidden"]),
    });
    expect(frame.traces.map((t) => t.sessionId)).toEqual(["visible"]);
  });

  it("excludes hidden sessions' pulses from frame.pulses", () => {
    const store = makeFakeStore({
      sessions: [
        {
          id: "visible",
          rates: { events: history(3, () => 5) },
          pulses: [{ t: NOW - 100, kind: "tool", strength: PULSE_STRENGTHS.tool }],
        },
        {
          id: "hidden",
          rates: { events: history(3, () => 7) },
          pulses: [{ t: NOW - 100, kind: "tool", strength: PULSE_STRENGTHS.tool }],
        },
      ],
    });
    const frame = buildFrame(store, "events", NOW, {
      hiddenSessions: new Set(["hidden"]),
    });
    expect(frame.pulses.map((p) => p.sessionId)).toEqual(["visible"]);
  });

  it("keeps hidden sessions in frame.legend with hidden:true and visible ones with hidden:false", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "visible", rates: { events: history(3, () => 5) } },
        { id: "hidden", rates: { events: history(3, () => 7) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW, {
      hiddenSessions: new Set(["hidden"]),
    });
    const byId = new Map(frame.legend.map((e) => [e.sessionId, e]));
    expect(byId.get("visible")?.hidden).toBe(false);
    expect(byId.get("hidden")?.hidden).toBe(true);
    // Legend still parallels the store's session order.
    expect(frame.legend.map((e) => e.sessionId)).toEqual(["visible", "hidden"]);
  });

  it("computes dynamic yMax from VISIBLE sessions only — hiding a spike lets the quiet trace fill the canvas", () => {
    // Big hidden trace peaks at 14 evt/s; small visible trace peaks at 2.
    // If the hidden peak leaked into yMax we would get yMax clamped to the
    // events cap of 15. With hidden filtered out, yMax scales to the visible
    // peak: peak = 2, peak * 1.2 = 2.4, niceCeil = 3.
    const store = makeFakeStore({
      sessions: [
        { id: "spiky", rates: { events: history(3, () => 14) } },
        { id: "quiet", rates: { events: history(3, () => 2) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW, {
      yMaxMode: "dynamic",
      hiddenSessions: new Set(["spiky"]),
    });
    expect(frame.yMax).toBe(3);
  });

  it("default (no hiddenSessions option) marks every legend entry as hidden:false and includes every trace", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "s1", rates: { events: history(3, () => 5) } },
        { id: "s2", rates: { events: history(3, () => 7) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces).toHaveLength(2);
    for (const entry of frame.legend) {
      expect(entry.hidden).toBe(false);
    }
  });

  it("treats an empty hiddenSessions set the same as omitting the option", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "s1", rates: { events: history(3, () => 5) } },
        { id: "s2", rates: { events: history(3, () => 7) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW, {
      hiddenSessions: new Set<string>(),
    });
    expect(frame.traces).toHaveLength(2);
    for (const entry of frame.legend) {
      expect(entry.hidden).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Theme-aware session-color palette (opts.sessionColors)
//
// `buildFrame` accepts an optional `sessionColors: ReadonlyArray<string>`.
// When provided, session → color assignment reads from THAT palette by
// registration index (modulo length) instead of the default SESSION_COLORS.
// The legend and trace colors match by index. When omitted, the default
// `SESSION_COLORS` palette is used so existing callers need no changes.
// Empty arrays are treated as "omitted" so a misconfigured theme cannot
// erase trace color entirely.
// ---------------------------------------------------------------------------

describe("buildFrame — theme-aware session-color palette", () => {
  it("uses default SESSION_COLORS when opts.sessionColors is omitted", () => {
    const store = makeFakeStore({
      sessions: [
        { id: "s1", rates: { events: history(3, () => 1) } },
        { id: "s2", rates: { events: history(3, () => 1) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW);
    expect(frame.traces[0].color).toBe(SESSION_COLORS[0]);
    expect(frame.traces[1].color).toBe(SESSION_COLORS[1]);
    expect(frame.legend[0].color).toBe(SESSION_COLORS[0]);
    expect(frame.legend[1].color).toBe(SESSION_COLORS[1]);
  });

  it("uses the caller-supplied palette for trace AND legend colors by index", () => {
    const customPalette: ReadonlyArray<string> = [
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#ffff00",
      "#ff00ff",
    ];
    const store = makeFakeStore({
      sessions: [
        { id: "s1", rates: { events: history(3, () => 1) } },
        { id: "s2", rates: { events: history(3, () => 1) } },
        { id: "s3", rates: { events: history(3, () => 1) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW, {
      sessionColors: customPalette,
    });
    expect(frame.traces[0].color).toBe("#ff0000");
    expect(frame.traces[1].color).toBe("#00ff00");
    expect(frame.traces[2].color).toBe("#0000ff");
    expect(frame.legend[0].color).toBe("#ff0000");
    expect(frame.legend[1].color).toBe("#00ff00");
    expect(frame.legend[2].color).toBe("#0000ff");
  });

  it("wraps modulo the caller-supplied palette length when sessions exceed it", () => {
    // Custom palette of 3 colors, 5 sessions — sessions 3 and 4 wrap.
    const threeColorPalette: ReadonlyArray<string> = ["#a11", "#2b2", "#33c"];
    const store = makeFakeStore({
      sessions: [
        { id: "s0", rates: { events: history(2, () => 1) } },
        { id: "s1", rates: { events: history(2, () => 1) } },
        { id: "s2", rates: { events: history(2, () => 1) } },
        { id: "s3", rates: { events: history(2, () => 1) } },
        { id: "s4", rates: { events: history(2, () => 1) } },
      ],
    });
    const frame = buildFrame(store, "events", NOW, {
      sessionColors: threeColorPalette,
    });
    expect(frame.traces[0].color).toBe("#a11");
    expect(frame.traces[3].color).toBe("#a11"); // wraps back to index 0
    expect(frame.traces[4].color).toBe("#2b2"); // wraps to index 1
  });

  it("propagates custom palette colors through pulses via the owning trace", () => {
    // A pulse's `color` mirrors its trace's color; changing the palette
    // must change the pulse color in lockstep.
    const customPalette: ReadonlyArray<string> = ["#cafe00"];
    const store = makeFakeStore({
      sessions: [
        {
          id: "s1",
          rates: { events: history(3, () => 5) },
          pulses: [
            { t: NOW - 100, kind: "tool", strength: PULSE_STRENGTHS.tool },
          ],
        },
      ],
    });
    const frame = buildFrame(store, "events", NOW, {
      sessionColors: customPalette,
    });
    expect(frame.pulses[0].color).toBe("#cafe00");
    expect(frame.traces[0].color).toBe("#cafe00");
  });

  it("falls back to default SESSION_COLORS when caller passes an empty palette", () => {
    // A misconfigured theme (no --phosphor-session-* variables resolved)
    // could pass an empty array. Treat it the same as omitted so traces
    // still render in a visible color.
    const store = makeFakeStore({
      sessions: [{ id: "s1", rates: { events: history(3, () => 1) } }],
    });
    const frame = buildFrame(store, "events", NOW, { sessionColors: [] });
    expect(frame.traces[0].color).toBe(SESSION_COLORS[0]);
  });
});
