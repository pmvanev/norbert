/**
 * Unit tests: ensurePersistenceBuffer (Step 09-02)
 *
 * Invariant (per v2-phosphor-architecture.md §5 Q3):
 *   The persistence buffer is invalidated and recreated when ANY of
 *   `{canvas width, canvas height, selected metric, DPR}` changes, and
 *   remains stable across calls where the packed key `${w}x${h}:${metric}:${dpr}`
 *   is unchanged.
 *
 * These tests assert the identity contract exhaustively by exercising each
 * dimension of the packed key independently (w, h, metric, dpr) and by
 * property-testing that key-equal calls return the same buffer object.
 *
 * The helper is a VIEW-LAYER utility (not a driving port) and is therefore
 * colocated under `views/phosphor/`. It injects a buffer factory so tests can
 * run under jsdom without a real offscreen canvas.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  ensurePersistenceBuffer,
  type PersistenceBufferCell,
} from "./ensurePersistenceBuffer";
import type { MetricId } from "../../domain/phosphor/phosphorMetricConfig";

// Minimal stand-in for an offscreen canvas. Tests only care about object
// identity and the requested dimensions; they never draw to the buffer.
interface FakeBuffer {
  readonly id: number;
  readonly width: number;
  readonly height: number;
}

const makeFactory = () => {
  let nextId = 0;
  const created: FakeBuffer[] = [];
  const create = (width: number, height: number): FakeBuffer => {
    const buffer: FakeBuffer = { id: nextId++, width, height };
    created.push(buffer);
    return buffer;
  };
  return { create, created };
};

const makeCell = <T>(): PersistenceBufferCell<T> => ({
  key: null,
  buffer: null,
});

describe("ensurePersistenceBuffer", () => {
  it("creates a new buffer on the first call", () => {
    const cell = makeCell<FakeBuffer>();
    const factory = makeFactory();
    const result = ensurePersistenceBuffer<FakeBuffer>(
      cell,
      100,
      50,
      "events",
      2,
      factory.create,
    );
    expect(result.buffer).not.toBeNull();
    expect(result.key).toBe("100x50:events:2");
    expect(factory.created.length).toBe(1);
    expect(factory.created[0]).toEqual({ id: 0, width: 100, height: 50 });
  });

  it("returns the same buffer when width, height, metric, and dpr are unchanged", () => {
    const cell = makeCell<FakeBuffer>();
    const factory = makeFactory();
    const first = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "events", 2, factory.create);
    const second = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "events", 2, factory.create);
    expect(second.buffer).toBe(first.buffer);
    expect(factory.created.length).toBe(1);
  });

  it("recreates the buffer when width changes", () => {
    const cell = makeCell<FakeBuffer>();
    const factory = makeFactory();
    const first = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "events", 2, factory.create);
    const second = ensurePersistenceBuffer<FakeBuffer>(cell, 200, 50, "events", 2, factory.create);
    expect(second.buffer).not.toBe(first.buffer);
    expect(factory.created.length).toBe(2);
    expect(factory.created[1].width).toBe(200);
  });

  it("recreates the buffer when height changes", () => {
    const cell = makeCell<FakeBuffer>();
    const factory = makeFactory();
    const first = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "events", 2, factory.create);
    const second = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 80, "events", 2, factory.create);
    expect(second.buffer).not.toBe(first.buffer);
    expect(factory.created.length).toBe(2);
    expect(factory.created[1].height).toBe(80);
  });

  it("recreates the buffer when metric changes", () => {
    const cell = makeCell<FakeBuffer>();
    const factory = makeFactory();
    const first = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "events", 2, factory.create);
    const second = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "tokens", 2, factory.create);
    expect(second.buffer).not.toBe(first.buffer);
    expect(factory.created.length).toBe(2);
  });

  it("recreates the buffer when dpr changes", () => {
    const cell = makeCell<FakeBuffer>();
    const factory = makeFactory();
    const first = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "events", 2, factory.create);
    const second = ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "events", 1, factory.create);
    expect(second.buffer).not.toBe(first.buffer);
    expect(factory.created.length).toBe(2);
  });

  it("mutates the cell so subsequent reads observe the latest key/buffer", () => {
    const cell = makeCell<FakeBuffer>();
    const factory = makeFactory();
    ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "events", 2, factory.create);
    expect(cell.key).toBe("100x50:events:2");
    expect(cell.buffer).toEqual({ id: 0, width: 100, height: 50 });
    ensurePersistenceBuffer<FakeBuffer>(cell, 100, 50, "tokens", 2, factory.create);
    expect(cell.key).toBe("100x50:tokens:2");
    expect(cell.buffer).toEqual({ id: 1, width: 100, height: 50 });
  });

  // Property: for any pair of distinct (w, h, metric, dpr) tuples, the
  // helper returns different buffer objects; for any pair of equal tuples,
  // the helper returns the same buffer object.
  it("property: buffer identity tracks packed-key equality", () => {
    const metricArb = fc.constantFrom<MetricId>("events", "tokens", "toolcalls");
    const tupleArb = fc.tuple(
      fc.integer({ min: 1, max: 4000 }),
      fc.integer({ min: 1, max: 4000 }),
      metricArb,
      fc.integer({ min: 1, max: 4 }),
    );
    fc.assert(
      fc.property(tupleArb, tupleArb, (t1, t2) => {
        const cell = makeCell<FakeBuffer>();
        const factory = makeFactory();
        const first = ensurePersistenceBuffer<FakeBuffer>(
          cell,
          t1[0],
          t1[1],
          t1[2],
          t1[3],
          factory.create,
        );
        const second = ensurePersistenceBuffer<FakeBuffer>(
          cell,
          t2[0],
          t2[1],
          t2[2],
          t2[3],
          factory.create,
        );
        const keysEqual =
          t1[0] === t2[0] && t1[1] === t2[1] && t1[2] === t2[2] && t1[3] === t2[3];
        if (keysEqual) {
          expect(second.buffer).toBe(first.buffer);
        } else {
          expect(second.buffer).not.toBe(first.buffer);
        }
      }),
      { numRuns: 200 },
    );
  });
});
