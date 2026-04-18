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
  RATE_TICK_MS,
  WINDOW_MS,
  type MetricId,
  type PulseKind,
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
import { scopeHitTest } from "../../../../src/plugins/norbert-usage/domain/phosphor/scopeHitTest";
import { decayFactor } from "../../../../src/plugins/norbert-usage/domain/phosphor/pulseTiming";

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
          // positive, no projected sample may read as near-zero. Using a
          // strict lower bound (> 1e-9) mirrors IC-S11's tolerance and
          // catches near-zero fabrication that `!== 0` would miss.
          for (const sample of trace!.samples) {
            expect(sample.v).toBeGreaterThan(1e-9);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// IC-S13: @property Rate-sample append then read preserves timestamp order
// Tag: @driving_port @property @US-PM-001
//
// Generators:
//   - sessionId: non-empty string
//   - metric: one of the three MetricIds
//   - rate samples: a non-empty, strictly-ascending-timestamp sequence built
//     from unique `ageMs` offsets inside the 60s window, each paired with a
//     finite positive double value. Samples are appended oldest-to-newest.
//   - nowOffset: integer offset around a fixed logical NOW for variety
//
// Invariant: getRateHistory returns samples in the exact append order, which
// is ascending by timestamp (strict monotonicity — unique ageMs guarantees no
// ties) and preserves both `t` and `v` values at each index.
// ---------------------------------------------------------------------------

describe("IC-S13 @property: Rate-sample append then read preserves timestamp order", () => {
  it("any in-order append sequence reads back in the same order with identical values", () => {
    const metricArb: fc.Arbitrary<MetricId> = fc.constantFrom<MetricId>(
      "events",
      "tokens",
      "toolcalls",
    );

    // A non-empty, strictly-ascending-timestamp sequence inside the 60s
    // window. Unique `ageMs` sorted descending yields a strictly ascending
    // `t = now - ageMs` append sequence.
    const appendSequenceArb = fc
      .uniqueArray(fc.integer({ min: 0, max: WINDOW_MS - 1 }), {
        minLength: 1,
        maxLength: 16,
      })
      .chain((ages) => {
        const sortedAgesDesc = [...ages].sort((a, b) => b - a);
        return fc
          .array(
            fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
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
        appendSequenceArb,
        fc.integer({ min: -1000, max: 1000 }),
        (sessionId, metric, samples, nowOffset) => {
          const now = NOW + nowOffset;
          const store = createMultiSessionStore();
          store.addSession(sessionId);

          // Append in ascending-t order (samples already sorted oldest-first).
          const appended: ReadonlyArray<{ t: number; v: number }> = samples.map(
            (s) => ({ t: now - s.ageMs, v: s.v }),
          );
          for (const s of appended) {
            store.appendRateSample(sessionId, metric, s.t, s.v);
          }

          const history = store.getRateHistory(sessionId, metric);

          // Same length and identical (t, v) sequence as appended.
          expect(history).toHaveLength(appended.length);
          for (let i = 0; i < appended.length; i++) {
            expect(history[i].t).toBe(appended[i].t);
            expect(history[i].v).toBe(appended[i].v);
          }

          // Strict monotonicity in `t` — append order is timestamp order.
          for (let i = 1; i < history.length; i++) {
            expect(history[i].t).toBeGreaterThan(history[i - 1].t);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// IC-S14: @property Window trim is consistent across reads (idempotent)
// Tag: @driving_port @property @US-PM-001
//
// Generators:
//   - sessionId: non-empty string
//   - metric: one of the three MetricIds
//   - rate samples: a non-empty, strictly-ascending-timestamp sequence built
//     from unique `ageMs` offsets inside the 60s window, each paired with a
//     finite double value.
//   - queryCount: number of consecutive reads to perform (2..5)
//   - nowOffset: integer offset around a fixed logical NOW for variety
//
// Invariant: consecutive getRateHistory calls return arrays with identical
// contents (same length, same (t, v) pairs at each index). Reads must not
// mutate store state — the window-trim semantics (today: identity; later:
// window-bounded) are consistent across any sequence of reads.
// ---------------------------------------------------------------------------

describe("IC-S14 @property: Window trim is consistent across reads", () => {
  it("consecutive getRateHistory calls return arrays with identical contents", () => {
    const metricArb: fc.Arbitrary<MetricId> = fc.constantFrom<MetricId>(
      "events",
      "tokens",
      "toolcalls",
    );

    const appendSequenceArb = fc
      .uniqueArray(fc.integer({ min: 0, max: WINDOW_MS - 1 }), {
        minLength: 1,
        maxLength: 16,
      })
      .chain((ages) => {
        const sortedAgesDesc = [...ages].sort((a, b) => b - a);
        return fc
          .array(
            fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
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
        appendSequenceArb,
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: -1000, max: 1000 }),
        (sessionId, metric, samples, queryCount, nowOffset) => {
          const now = NOW + nowOffset;
          const store = createMultiSessionStore();
          store.addSession(sessionId);

          for (const s of samples) {
            store.appendRateSample(sessionId, metric, now - s.ageMs, s.v);
          }

          // Perform `queryCount` consecutive reads; each must return the
          // same (t, v) sequence as the first.
          const reads: Array<ReadonlyArray<{ t: number; v: number }>> = [];
          for (let i = 0; i < queryCount; i++) {
            reads.push(store.getRateHistory(sessionId, metric));
          }

          const first = reads[0];
          for (let i = 1; i < reads.length; i++) {
            const other = reads[i];
            expect(other).toHaveLength(first.length);
            expect(other.map((s) => s.t)).toEqual(first.map((s) => s.t));
            expect(other.map((s) => s.v)).toEqual(first.map((s) => s.v));
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// IC-S15: @property Hit-test consistency between trace value and returned value
// Tag: @driving_port @property @US-PM-001
//
// Generators:
//   - sessionId: non-empty string
//   - metric: one of the three MetricIds
//   - arrived-samples: a non-empty, ascending-timestamp sequence inside the
//     60s window. Values are STRICTLY POSITIVE (min 0.01) so on-canvas
//     samples always have a meaningful displayY (not clipped to the top edge
//     where the off-canvas zero-distance rule in scopeHitTest would short-
//     circuit the match we want to assert).
//   - width/height: positive canvas dimensions (pointer space)
//   - pointerX/pointerY: pointer inside the canvas rectangle
//   - nowOffset: integer offset around a fixed logical NOW for variety
//
// Invariant (business language): whenever the hit-test returns a hover
// selection, the selected trace's value AT the selection's reported time —
// computed by the same honest-signal lookup used by scopeProjection (last
// sample at-or-before `selection.time`; earliest sample when the cursor
// precedes all arrivals) — equals `selection.value` within a small epsilon.
// The scope never reports a hover value that disagrees with the underlying
// trace signal at that time.
// ---------------------------------------------------------------------------

describe("IC-S15 @property: Hit-test consistency between trace value and returned value", () => {
  it("selection value equals the selected trace's sampled value at selection.time within epsilon", () => {
    const metricArb: fc.Arbitrary<MetricId> = fc.constantFrom<MetricId>(
      "events",
      "tokens",
      "toolcalls",
    );

    // Non-empty, strictly-positive arrived samples at unique ages inside the
    // 60s window. A higher max value (up to 3x yMax) deliberately exercises
    // the off-canvas clipping path inside scopeHitTest, but the honest-signal
    // invariant under test is value-equality, not on/off-canvas behavior.
    const arrivedArb = fc
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
              max: 300,
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
        arrivedArb,
        fc.integer({ min: 100, max: 2000 }), // width px
        fc.integer({ min: 100, max: 800 }), // height px
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), // fractional x
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), // fractional y
        fc.integer({ min: -1000, max: 1000 }),
        (
          sessionId,
          metric,
          arrived,
          width,
          height,
          xFrac,
          yFrac,
          nowOffset,
        ) => {
          const now = NOW + nowOffset;
          const store = createMultiSessionStore();
          store.addSession(sessionId);
          for (const s of arrived) {
            store.appendRateSample(sessionId, metric, now - s.ageMs, s.v);
          }

          const frame = buildFrame(store, metric, now);
          const trace = frame.traces.find((t) => t.sessionId === sessionId);
          expect(trace).toBeDefined();

          const pointer = {
            x: xFrac * width,
            y: yFrac * height,
            width,
            height,
          };
          const selection = scopeHitTest(pointer, frame);

          // The property is conditional: whenever a selection is returned,
          // its value must match the trace's sampled value at selection.time.
          if (selection === null) return;

          expect(selection.sessionId).toBe(sessionId);

          // Independent oracle (declarative — deliberately NOT a copy of
          // production's imperative running-max loop in `valueAtCursorTime`).
          // Structure:
          //   1. Filter: keep only samples at-or-before selection.time.
          //   2. Reduce-max-by-t: among the kept samples, pick the one with
          //      the largest t. Ties broken by later-in-array (reduce's
          //      `a.t >= b.t ? a : b` keeps the current on equality).
          //   3. Fallback: if none qualify, use the minimum-t sample
          //      (earliest arrival), matching the fallback contract.
          // This shape differs from production (filter + reduce vs. single
          // imperative pass with running max), so an identical-shape mutant
          // in production cannot silently pass both.
          const samples = trace!.samples;
          const candidates = samples.filter((s) => s.t <= selection.time);
          const expected =
            candidates.length > 0
              ? candidates.reduce((a, b) => (a.t >= b.t ? a : b)).v
              : samples.reduce((a, b) => (a.t <= b.t ? a : b)).v;

          expect(selection.value).toBeCloseTo(expected, 5);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// IC-S16: @property Pulse decay factor monotonically decreases with age
// Tag: @driving_port @property @US-PM-001
//
// Generators:
//   - earlierAge / laterAge: integers inside [0, PULSE_LIFETIME_MS] with
//     earlierAge <= laterAge (built via chain to guarantee the ordering)
//   - beyondLifetimeAgeMs: integer strictly greater than PULSE_LIFETIME_MS
//     but within the pulse-retention window so the store keeps it alive
//   - kind: PulseKind (tool | subagent | lifecycle)
//   - sessionId: non-empty string
//   - metric: one of the three MetricIds
//   - nowOffset: integer offset around a fixed logical NOW for variety
//
// Invariants (business language):
//   1. decay-monotonicity: for any two ages inside the 2.5s lifetime,
//      decay at the later age is less-than-or-equal-to decay at the earlier
//      age (the flare only dims over time, never brightens).
//   2. beyond-lifetime-absent: a pulse whose age exceeds PULSE_LIFETIME_MS
//      is absent from the projected frame's `pulses` list, regardless of
//      session kind or metric (the store may retain it for a longer
//      retention window, but the frame only exposes visible pulses).
// ---------------------------------------------------------------------------

describe("IC-S16 @property: Pulse decay factor monotonically decreases with age", () => {
  it("decay at later age <= decay at earlier age, and pulses beyond lifetime are absent from the frame", () => {
    const metricArb: fc.Arbitrary<MetricId> = fc.constantFrom<MetricId>(
      "events",
      "tokens",
      "toolcalls",
    );
    const kindArb: fc.Arbitrary<PulseKind> = fc.constantFrom<PulseKind>(
      "tool",
      "subagent",
      "lifecycle",
    );

    // Two ages inside [0, PULSE_LIFETIME_MS], ordered earlier <= later.
    const agePairArb = fc
      .tuple(
        fc.integer({ min: 0, max: PULSE_LIFETIME_MS }),
        fc.integer({ min: 0, max: PULSE_LIFETIME_MS }),
      )
      .map(([a, b]) => ({
        earlierAge: Math.min(a, b),
        laterAge: Math.max(a, b),
      }));

    // A pulse age strictly past lifetime but within the store's retention
    // window so the store keeps the pulse and the frame can prove absence.
    const beyondLifetimeAgeArb = fc.integer({
      min: PULSE_LIFETIME_MS + 1,
      max: PULSE_LIFETIME_MS + 2_000,
    });

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        metricArb,
        kindArb,
        agePairArb,
        beyondLifetimeAgeArb,
        fc.integer({ min: -1000, max: 1000 }),
        (sessionId, metric, kind, agePair, beyondLifetimeAgeMs, nowOffset) => {
          const now = NOW + nowOffset;

          // Invariant 1: decay monotonicity across arbitrary in-lifetime ages.
          const decayEarlier = decayFactor(agePair.earlierAge, PULSE_LIFETIME_MS);
          const decayLater = decayFactor(agePair.laterAge, PULSE_LIFETIME_MS);
          expect(decayLater).toBeLessThanOrEqual(decayEarlier + 1e-12);
          // And decay stays within [0, 1] regardless of age ordering.
          expect(decayEarlier).toBeGreaterThanOrEqual(0);
          expect(decayEarlier).toBeLessThanOrEqual(1);
          expect(decayLater).toBeGreaterThanOrEqual(0);
          expect(decayLater).toBeLessThanOrEqual(1);

          // Invariant 2: a beyond-lifetime pulse is absent from the frame.
          const store = createMultiSessionStore();
          store.addSession(sessionId);
          store.appendPulse(sessionId, {
            t: now - beyondLifetimeAgeMs,
            kind,
            strength: PULSE_STRENGTHS[kind],
          });

          const frame = buildFrame(store, metric, now);
          const sessionPulses = frame.pulses.filter(
            (p) => p.sessionId === sessionId,
          );
          expect(sessionPulses).toHaveLength(0);
        },
      ),
    );
  });
});
