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
    readonly rates?: Partial<Record<MetricId, ReadonlyArray<RateSample>>>;
    readonly pulses?: ReadonlyArray<Pulse>;
  }>;
}

const makeFakeStore = (seed: FakeStoreSeed): PhosphorStoreSurface => {
  const order = seed.sessions.map((s) => s.id);
  const rateMap = new Map<string, Map<MetricId, ReadonlyArray<RateSample>>>();
  const pulseMap = new Map<string, ReadonlyArray<Pulse>>();
  for (const s of seed.sessions) {
    const metricMap = new Map<MetricId, ReadonlyArray<RateSample>>();
    for (const metric of ["events", "tokens", "toolcalls"] as const) {
      metricMap.set(metric, s.rates?.[metric] ?? []);
    }
    rateMap.set(s.id, metricMap);
    pulseMap.set(s.id, s.pulses ?? []);
  }
  return {
    getSessionIds: () => order,
    getRateHistory: (sessionId, metric) => rateMap.get(sessionId)?.get(metric) ?? [],
    getPulses: (sessionId) => pulseMap.get(sessionId) ?? [],
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
    expect(frame.legend[0]).toEqual({
      sessionId: "alpha",
      color: SESSION_COLORS[0],
      latestValue: 4,
    });
    expect(frame.legend[1]).toEqual({
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
