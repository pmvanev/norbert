/**
 * ensurePersistenceBuffer — view-layer persistence-buffer lifecycle helper.
 *
 * Maintains the invariant stated in v2-phosphor-architecture.md §5 Q3:
 *
 *   The offscreen afterglow buffer is invalidated and recreated when ANY of
 *   `{canvas width, canvas height, selected metric, DPR}` changes. It remains
 *   stable (identical object) across calls where every key component is
 *   unchanged.
 *
 * The helper compares a packed key `"${w}x${h}:${metric}:${dpr}"` against the
 * last key stored on a caller-supplied cell. Equal keys short-circuit to the
 * existing buffer; unequal keys create a new buffer via the injected factory
 * and mutate the cell to observe the new key/buffer.
 *
 * This is a VIEW-LAYER helper (not a driving port). Pure-to-the-output in the
 * sense that the output is deterministic in (cell snapshot, width, height,
 * metric, dpr, create), though the helper does mutate the cell it is handed —
 * that mutation is the caller's intent (the cell lives on a `useRef`).
 *
 * Dependency injection: the `create` function is injected so tests and
 * non-browser environments can substitute a plain stub for
 * `document.createElement('canvas')`. The production caller passes the
 * browser-native factory.
 */

import type { MetricId } from "../../domain/phosphor/phosphorMetricConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Cell owned by the canvas host (typically a `useRef.current` target). The
 * cell starts with both fields `null`; the helper mutates the cell in place
 * on every call.
 */
export interface PersistenceBufferCell<T> {
  /** Packed key of the buffer currently stored, or `null` when no buffer exists. */
  key: string | null;
  /** The buffer object itself (offscreen canvas in production), or `null`. */
  buffer: T | null;
}

/** Factory: given width + height, create a fresh buffer. Injected for testability. */
export type PersistenceBufferFactory<T> = (width: number, height: number) => T;

/** Shape returned by `ensurePersistenceBuffer` for the caller's convenience. */
export interface PersistenceBufferResult<T> {
  readonly key: string;
  readonly buffer: T;
}

// ---------------------------------------------------------------------------
// Pure key derivation
// ---------------------------------------------------------------------------

/**
 * Deterministic string encoding of the four dimensions controlling buffer
 * identity. Any change to w, h, metric, or dpr produces a different key.
 */
const packKey = (
  width: number,
  height: number,
  metric: MetricId,
  dpr: number,
): string => `${width}x${height}:${metric}:${dpr}`;

// ---------------------------------------------------------------------------
// ensurePersistenceBuffer
// ---------------------------------------------------------------------------

/**
 * Return the cell's existing buffer when the packed key matches, otherwise
 * create a new buffer via `create(width, height)` and update the cell.
 *
 * Invariant (enforced by the tests):
 *   - Buffer identity is stable while `(width, height, metric, dpr)` is
 *     unchanged across calls.
 *   - Buffer identity changes on any change to `(width, height, metric, dpr)`.
 */
export const ensurePersistenceBuffer = <T>(
  cell: PersistenceBufferCell<T>,
  width: number,
  height: number,
  metric: MetricId,
  dpr: number,
  create: PersistenceBufferFactory<T>,
): PersistenceBufferResult<T> => {
  const key = packKey(width, height, metric, dpr);
  if (cell.key === key && cell.buffer !== null) {
    return { key, buffer: cell.buffer };
  }
  const buffer = create(width, height);
  cell.key = key;
  cell.buffer = buffer;
  return { key, buffer };
};
