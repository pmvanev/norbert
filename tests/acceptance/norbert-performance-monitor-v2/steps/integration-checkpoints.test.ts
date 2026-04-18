/**
 * Acceptance tests: Performance Monitor v2 Phosphor Scope — Integration Checkpoints.
 *
 * These checkpoints exercise the derivation seam (hookProcessor helpers that
 * convert hook and OTel events into rate samples and pulses) and the store
 * seam (multiSessionStore's public append and query contract). They prove
 * the upstream event stream correctly lands in the store, and the store
 * preserves the temporal contracts the scope depends on.
 *
 * Driving ports (DELIVER wave will implement):
 *   - multiSessionStore.addSession / removeSession / appendRateSample /
 *     appendPulse / getRateHistory / getPulses / getSessionIds / subscribe
 *   - hookProcessor derivation helpers: deriveEventsRate, deriveTokensRate,
 *     deriveToolCallsRate, emitPulse
 *   - buildFrame(store, metric, now) -> Frame  (for property-shaped scenarios)
 *
 * Feature file: integration-checkpoints.feature
 *
 * Traces to: US-PM-001 (amended), v2-phosphor-architecture.md §4 Q1
 * (derivation pipeline), ADR-049 (per-metric rate buffers + pulse log).
 *
 * Property-shaped scenarios use fast-check (added as dev-dep during DELIVER).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  NOW,
  PULSE_LIFETIME_MS,
  PULSE_STRENGTHS,
  PULSE_RETENTION_MS,
  RATE_TICK_MS,
  WINDOW_MS,
  type Frame,
  type HoverSelection,
  type MetricId,
  type MultiSessionStoreSurface,
  type Pulse,
  type PulseKind,
  synthesizeArrivedHistory,
} from "./fixtures";

// Driving ports (resolved as DELIVER wave lands modules).
import { createMultiSessionStore } from "../../../../src/plugins/norbert-usage/adapters/multiSessionStore";
import {
  deriveEventsRate,
  deriveTokensRate,
  deriveToolCallsRate,
  emitPulse,
} from "../../../../src/plugins/norbert-usage/hookProcessor";
import { buildFrame } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeProjection";
// import { scopeHitTest } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeHitTest";
// import { decayFactor } from "../../../../src/plugins/norbert-usage/domain/phosphor/pulseTiming";

declare const scopeHitTest: (
  pointer: { x: number; y: number; width: number; height: number },
  frame: Frame,
) => HoverSelection | null;
declare const decayFactor: (ageMs: number, lifetimeMs: number) => number;

/**
 * Derivation helpers — signatures target the hookProcessor shape. Each returns
 * the derived RateSample (or pulse) for a single tick/event, without mutating
 * store state. The caller appends. `deriveEventsRate`, `deriveTokensRate`,
 * `deriveToolCallsRate`, and `emitPulse` are imported from the real module
 * (delivered in steps 08-01 / 08-02 / 08-03 / 08-04); the remaining helpers
 * stay `declare`d until their respective IC scenarios are un-skipped.
 */

// ---------------------------------------------------------------------------
// IC-S1: A 5-second tick of hook arrivals derives an events-per-second sample
// Tag: @driving_port @US-PM-001
// First scenario of this file — must fail for a BUSINESS-logic reason.
// ---------------------------------------------------------------------------

describe("IC-S1: A 5-second tick of hook arrivals derives an events-per-second sample", () => {
  it("15 events over 5 seconds yields a sample of 3 at the tick boundary", () => {
    // Given 15 hook events arrive for session-1 across a 5-second tick
    const eventCount = 15;
    const windowMs = RATE_TICK_MS;
    const tickBoundary = NOW;

    // When the events-per-second derivation runs for that tick
    const sample = deriveEventsRate(eventCount, windowMs, tickBoundary);

    // Then the sample is 3 evt/s timestamped at the tick boundary
    expect(sample.v).toBeCloseTo(3, 5);
    expect(sample.t).toBe(tickBoundary);
  });
});

// ---------------------------------------------------------------------------
// IC-S2: An OTel api-request event derives a tokens-per-second sample
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S2: An OTel api-request event derives a tokens-per-second sample", () => {
  it("500 tokens over 2 seconds yields a sample of 250", () => {
    // Given an OTel api-request event with 500 tokens and 2-second duration
    const totalTokens = 500;
    const durationMs = 2000;
    const t = NOW;

    // When the tokens-per-second derivation runs for that event
    const sample = deriveTokensRate(totalTokens, durationMs, t);

    // Then a sample of 250 tok/s is produced
    expect(sample.v).toBeCloseTo(250, 5);
    expect(sample.t).toBe(t);
  });
});

// ---------------------------------------------------------------------------
// IC-S3: Tool-call events within a 5-second tick derive a tool-calls-per-second sample
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S3: Tool-call events within a 5-second tick derive a tool-calls-per-second sample", () => {
  it("10 tool calls over 5 seconds yields a sample of 2", () => {
    // Given 10 tool-call events arrive across a 5-second tick
    const sample = deriveToolCallsRate(10, RATE_TICK_MS, NOW);

    // Then the sample is 2 calls/s at the tick boundary
    expect(sample.v).toBeCloseTo(2, 5);
    expect(sample.t).toBe(NOW);
  });
});

// ---------------------------------------------------------------------------
// IC-S4: A tool-use hook event emits a pulse at the event's timestamp
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S4: A tool-use hook event emits a pulse at the event's timestamp", () => {
  it("pulse kind is tool and t matches the event time", () => {
    const eventTime = NOW - 500;
    const pulse = emitPulse("tool", eventTime);

    expect(pulse.kind).toBe("tool");
    expect(pulse.t).toBe(eventTime);
    expect(pulse.strength).toBe(PULSE_STRENGTHS.tool);
  });
});

// ---------------------------------------------------------------------------
// IC-S5: A lifecycle hook event emits a pulse with a smaller strength than a tool-use pulse
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S5: A lifecycle hook event emits a pulse with a smaller strength than a tool-use pulse", () => {
  it("tool-use pulse strength exceeds lifecycle pulse strength", () => {
    const toolPulse = emitPulse("tool", NOW);
    const lifecyclePulse = emitPulse("lifecycle", NOW);

    expect(toolPulse.strength).toBeGreaterThan(lifecyclePulse.strength);
    expect(toolPulse.strength).toBe(PULSE_STRENGTHS.tool);
    expect(lifecyclePulse.strength).toBe(PULSE_STRENGTHS.lifecycle);
  });
});

// ---------------------------------------------------------------------------
// IC-S6: Appending rate samples preserves temporal order on read
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S6: Appending rate samples preserves temporal order on read", () => {
  it("samples read back in oldest-to-newest order", () => {
    // Given rate samples at 10, 20, 30 seconds ago, appended in that order
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.appendRateSample("session-1", "events", NOW - 30_000, 2);
    store.appendRateSample("session-1", "events", NOW - 20_000, 4);
    store.appendRateSample("session-1", "events", NOW - 10_000, 6);

    // When the store is queried
    const history = store.getRateHistory("session-1", "events");

    // Then the samples are ordered oldest to newest
    expect(history).toHaveLength(3);
    for (let i = 1; i < history.length; i++) {
      expect(history[i].t).toBeGreaterThan(history[i - 1].t);
    }
  });
});

// ---------------------------------------------------------------------------
// IC-S7: Appending pulses preserves arrival order on read
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S7: Appending pulses preserves arrival order on read", () => {
  it("pulses read back in the arrival order they were appended", () => {
    // Given pulses at 4, 2, and 1 seconds ago appended in that order
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const arrivals = [4000, 2000, 1000];
    for (const ageMs of arrivals) {
      store.appendPulse("session-1", {
        t: NOW - ageMs,
        kind: "tool",
        strength: PULSE_STRENGTHS.tool,
      });
    }

    // When the store is queried (logical clock so retention trim aligns with NOW)
    const pulses = store.getPulses("session-1", NOW);

    // Then the pulses are returned in arrival order
    expect(pulses).toHaveLength(3);
    for (let i = 1; i < pulses.length; i++) {
      // Since appended at decreasing ages (newer each time), timestamps are increasing.
      expect(pulses[i].t).toBeGreaterThan(pulses[i - 1].t);
    }
  });
});

// ---------------------------------------------------------------------------
// IC-S8: Querying a non-existent session returns empty history and pulses
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S8: Querying a non-existent session returns empty history and pulses", () => {
  it("returns empty collections for a never-added session id", () => {
    const store = createMultiSessionStore();

    expect(store.getRateHistory("session-ghost", "events")).toHaveLength(0);
    expect(store.getPulses("session-ghost")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// IC-S9: Subscribers are notified after appendRateSample
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S9: Subscribers are notified after appendRateSample", () => {
  it("subscriber callback is invoked exactly once", () => {
    const store = createMultiSessionStore();
    store.addSession("session-1");

    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });
    notifications = 0; // reset after any setup-time notification

    store.appendRateSample("session-1", "events", NOW, 5);
    expect(notifications).toBe(1);

    unsubscribe();
  });
});

// ---------------------------------------------------------------------------
// IC-S10: Subscribers are notified after appendPulse
// Tag: @driving_port @US-PM-001
// ---------------------------------------------------------------------------

describe("IC-S10: Subscribers are notified after appendPulse", () => {
  it("subscriber callback is invoked exactly once", () => {
    const store = createMultiSessionStore();
    store.addSession("session-1");

    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });
    notifications = 0;

    store.appendPulse("session-1", {
      t: NOW,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });
    expect(notifications).toBe(1);

    unsubscribe();
  });
});

// ---------------------------------------------------------------------------
// IC-S10b: Subscribers are notified after addSession and removeSession
// Tag: @driving_port @US-PM-001
// ADR-049 Contract A: lifecycle notifies via the same pub/sub.
// NOTE: No counter reset between the two lifecycle calls — the exactly-once
// invariant per call is what we are contracting. A reset would hide double
// notifies on the second call.
// ---------------------------------------------------------------------------

describe("IC-S10b: Subscribers are notified after addSession and removeSession", () => {
  it("addSession notifies once and removeSession notifies once — two total", () => {
    const store = createMultiSessionStore();

    let notifications = 0;
    const unsubscribe = store.subscribe(() => {
      notifications += 1;
    });

    store.addSession("session-1");
    expect(notifications).toBe(1);

    store.removeSession("session-1");
    expect(notifications).toBe(2);

    unsubscribe();
  });
});

// ---------------------------------------------------------------------------
// IC-S11: @property Frame values never invent sub-interval spikes beyond
//         bracketing arrived values
// Tag: @driving_port @property @US-PM-001
//
// Generators:
//   - sessionId: non-empty string
//   - metric: one of the three MetricIds
//   - arrived-samples: a non-empty array of (ageMsFromNow, v) pairs strictly
//     inside the 60s window, monotonically increasing in timestamp (i.e.
//     decreasing ageMs). Values are positive finite doubles.
//   - nowOffset: integer offset around a fixed logical NOW for variety
//
// Invariant: for every projected trace sample, locate its two bracketing
// arrived samples (the arrived pair (left, right) with left.t <= sample.t
// <= right.t; or a single arrived sample when the projected sample lies at
// an endpoint). The projected sample.v must fall within
// [min(left.v, right.v), max(left.v, right.v)] — i.e. no invented
// sub-interval spike above the higher or below the lower bracketing value.
// ---------------------------------------------------------------------------

describe("IC-S11 @property: Frame values never invent sub-interval spikes beyond bracketing arrived values", () => {
  it("every projected trace value is bounded by its two bracketing arrived samples", () => {
    const metricArb: fc.Arbitrary<MetricId> = fc.constantFrom<MetricId>(
      "events",
      "tokens",
      "toolcalls",
    );

    // A non-empty, timestamp-sorted sequence of arrived samples inside the
    // 60s window. We generate unique `ageMs` in [0, WINDOW_MS - 1] then sort
    // descending so the resulting `t = now - ageMs` sequence is ascending.
    const arrivedArb = fc
      .uniqueArray(fc.integer({ min: 0, max: WINDOW_MS - 1 }), {
        minLength: 1,
        maxLength: 12,
      })
      .chain((ages) => {
        const sortedAgesDesc = [...ages].sort((a, b) => b - a);
        return fc
          .array(fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }), {
            minLength: sortedAgesDesc.length,
            maxLength: sortedAgesDesc.length,
          })
          .map((values) =>
            sortedAgesDesc.map((ageMs, i) => ({ ageMs, v: values[i] })),
          );
      });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        metricArb,
        arrivedArb,
        fc.integer({ min: -1000, max: 1000 }),
        (sessionId, metric, arrived, nowOffset) => {
          const now = NOW + nowOffset;
          const store = createMultiSessionStore();
          store.addSession(sessionId);
          for (const s of arrived) {
            store.appendRateSample(sessionId, metric, now - s.ageMs, s.v);
          }

          const frame = buildFrame(store, metric, now);
          const trace = frame.traces.find((t) => t.sessionId === sessionId);
          expect(trace).toBeDefined();

          // Bracketing lookup over arrived samples (ascending timestamp).
          const sortedArrived = arrived
            .map((s) => ({ t: now - s.ageMs, v: s.v }))
            .sort((a, b) => a.t - b.t);

          for (const sample of trace!.samples) {
            let left = sortedArrived[0];
            let right = sortedArrived[sortedArrived.length - 1];
            if (sample.t <= sortedArrived[0].t) {
              left = sortedArrived[0];
              right = sortedArrived[0];
            } else if (sample.t >= sortedArrived[sortedArrived.length - 1].t) {
              left = sortedArrived[sortedArrived.length - 1];
              right = sortedArrived[sortedArrived.length - 1];
            } else {
              for (let i = 0; i < sortedArrived.length - 1; i++) {
                if (
                  sortedArrived[i].t <= sample.t &&
                  sample.t <= sortedArrived[i + 1].t
                ) {
                  left = sortedArrived[i];
                  right = sortedArrived[i + 1];
                  break;
                }
              }
            }
            const hi = Math.max(left.v, right.v);
            const lo = Math.min(left.v, right.v);
            expect(sample.v).toBeLessThanOrEqual(hi + 1e-9);
            expect(sample.v).toBeGreaterThanOrEqual(lo - 1e-9);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// IC-S12: @property Frame values never zero-fill between arrivals when the
//         last arrived value is non-zero
// Tag: @driving_port @property @US-PM-001
//
// Generators:
//   - sessionId: non-empty string
//   - metric: one of the three MetricIds
//   - arrived-samples: a non-empty, ascending-timestamp sequence inside the
//     60s window; every value is STRICTLY POSITIVE (min 0.01). The last
//     arrived sample is the most recent, and no further samples arrive
//     after it (silence up to `now`).
//   - nowOffset: integer offset around a fixed logical NOW
//
// Invariants:
//   1. edge-value: the projected trace's current-time-edge sample value
//      equals the last arrived value (the scope does not zero-fill during
//      silence).
//   2. no-zero-fill: no projected sample value equals 0 purely because time
//      has elapsed without arrivals.
// ---------------------------------------------------------------------------

describe("IC-S12 @property: Frame values never zero-fill between arrivals", () => {
  it("edge value equals last arrived value and no sample zero-fills while the last arrival is non-zero", () => {
    const metricArb: fc.Arbitrary<MetricId> = fc.constantFrom<MetricId>(
      "events",
      "tokens",
      "toolcalls",
    );

    const arrivedNonZeroArb = fc
      .uniqueArray(fc.integer({ min: 0, max: WINDOW_MS - 1 }), {
        minLength: 1,
        maxLength: 12,
      })
      .chain((ages) => {
        const sortedAgesDesc = [...ages].sort((a, b) => b - a);
        return fc
          .array(
            fc.double({
              min: 0.01,
              max: 1000,
              noNaN: true,
              noDefaultInfinity: true,
            }),
            {
              minLength: sortedAgesDesc.length,
              maxLength: sortedAgesDesc.length,
            },
          )
          .map((values) =>
            sortedAgesDesc.map((ageMs, i) => ({ ageMs, v: values[i] })),
          );
      });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        metricArb,
        arrivedNonZeroArb,
        fc.integer({ min: -1000, max: 1000 }),
        (sessionId, metric, arrived, nowOffset) => {
          const now = NOW + nowOffset;
          const store = createMultiSessionStore();
          store.addSession(sessionId);
          for (const s of arrived) {
            store.appendRateSample(sessionId, metric, now - s.ageMs, s.v);
          }

          const frame = buildFrame(store, metric, now);
          const trace = frame.traces.find((t) => t.sessionId === sessionId);
          expect(trace).toBeDefined();

          // The last arrived sample (smallest ageMs -> largest t).
          const sortedByT = arrived
            .map((s) => ({ t: now - s.ageMs, v: s.v }))
            .sort((a, b) => a.t - b.t);
          const lastArrived = sortedByT[sortedByT.length - 1];

          // Edge-value invariant: the projected edge sample equals the last
          // arrived value. (When samples is empty something upstream
          // silently zero-filled / dropped the last arrival — a violation.)
          expect(trace!.samples.length).toBeGreaterThan(0);
          const edge = trace!.samples[trace!.samples.length - 1];
          expect(edge.v).toBeCloseTo(lastArrived.v, 5);

          // No-zero-fill invariant: since every arrival is strictly
          // positive, no projected sample may read as zero.
          for (const sample of trace!.samples) {
            expect(sample.v).not.toBe(0);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// IC-S13: @property Rate-sample append then read preserves timestamp order
// Tag: @driving_port @property @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("IC-S13 @property: Rate-sample append then read preserves timestamp order", () => {
  it("any finite sequence appended in timestamp order reads back in the same order", () => {
    // DELIVER wave will generalize to fast-check.
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const timestamps = [
      NOW - 55_000,
      NOW - 40_000,
      NOW - 25_000,
      NOW - 10_000,
    ];
    for (const [i, t] of timestamps.entries()) {
      store.appendRateSample("session-1", "events", t, i + 1);
    }

    const history = store.getRateHistory("session-1", "events");
    for (let i = 1; i < history.length; i++) {
      expect(history[i].t).toBeGreaterThan(history[i - 1].t);
    }
  });
});

// ---------------------------------------------------------------------------
// IC-S14: @property Window trim is consistent across reads (idempotent)
// Tag: @driving_port @property @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("IC-S14 @property: Window trim is consistent across reads", () => {
  it("trimming is idempotent; repeat reads all return only in-window samples", () => {
    // DELIVER wave will generalize to fast-check.
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const ages = [90_000, 70_000, 55_000, 30_000, 10_000];
    for (const ageMs of ages) {
      store.appendRateSample("session-1", "events", NOW - ageMs, 5);
    }

    const first = store.getRateHistory("session-1", "events");
    const second = store.getRateHistory("session-1", "events");

    // All returned samples are within window
    for (const sample of first) {
      expect(NOW - sample.t).toBeLessThanOrEqual(WINDOW_MS);
    }

    // Idempotence: repeat reads return the same in-window sample sequence
    expect(second.map((s) => s.t)).toEqual(first.map((s) => s.t));
    expect(second.map((s) => s.v)).toEqual(first.map((s) => s.v));
  });
});

// ---------------------------------------------------------------------------
// IC-S15: @property Hit-test consistency between trace value and returned value
// Tag: @driving_port @property @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("IC-S15 @property: Hit-test consistency between trace value and returned value", () => {
  it("selection value matches the selected trace's sampled value at selection.time", () => {
    // DELIVER wave will generalize to fast-check.
    const store = createMultiSessionStore();
    store.addSession("session-1");
    const history = synthesizeArrivedHistory(12, (i) => 3 + i * 0.4);
    for (const s of history) store.appendRateSample("session-1", "events", s.t, s.v);

    const frame = buildFrame(store, "events", NOW);
    const trace = frame.traces.find((t) => t.sessionId === "session-1");
    expect(trace).toBeDefined();

    const width = 1000;
    const height = 400;
    const targetSample = trace!.samples[Math.floor(trace!.samples.length / 2)];
    const ageMs = NOW - targetSample.t;
    const x = width * (1 - ageMs / WINDOW_MS);
    const yMax = frame.yMax;
    const y = height - (targetSample.v / yMax) * height;

    const selection = scopeHitTest({ x, y, width, height }, frame);
    expect(selection).not.toBeNull();

    // Selection value matches trace sample at selection.time within small epsilon
    const matchingSample = trace!.samples.reduce((best, s) =>
      Math.abs(s.t - selection!.time) < Math.abs(best.t - selection!.time) ? s : best,
    );
    expect(selection!.value).toBeCloseTo(matchingSample.v, 1);
  });
});

// ---------------------------------------------------------------------------
// IC-S16: @property Pulse decay factor monotonically decreases with age
// Tag: @driving_port @property @US-PM-001
// ---------------------------------------------------------------------------

describe.skip("IC-S16 @property: Pulse decay factor monotonically decreases with age", () => {
  it("decay at later age is less than or equal to decay at earlier age", () => {
    // DELIVER wave will generalize to fast-check.
    // A representative fixed case: two points inside the lifetime.
    const earlierAge = 500;
    const laterAge = 2000;
    expect(decayFactor(laterAge, PULSE_LIFETIME_MS)).toBeLessThanOrEqual(
      decayFactor(earlierAge, PULSE_LIFETIME_MS),
    );

    // And a pulse beyond lifetime is absent from the frame.
    const store = createMultiSessionStore();
    store.addSession("session-1");
    store.appendPulse("session-1", {
      t: NOW - 3000,
      kind: "tool",
      strength: PULSE_STRENGTHS.tool,
    });
    const frame = buildFrame(store, "events", NOW);
    const pulses = frame.pulses.filter((p) => p.sessionId === "session-1");
    expect(pulses).toHaveLength(0);

    // Silence warnings for unused constants.
    void PULSE_RETENTION_MS;
  });
});
