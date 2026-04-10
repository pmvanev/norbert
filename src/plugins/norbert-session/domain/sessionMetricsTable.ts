/// Session metrics table domain functions.
///
/// Pure functions transforming sessions, metrics, and metadata into
/// table row data for display. No side effects, no IO imports.

import type { SessionInfo } from "../../../domain/status";
import { isSessionActive } from "../../../domain/status";
import { deriveSessionName } from "../../../domain/sessionPresentation";
import type { SessionMetrics } from "../../norbert-usage/domain/types";
import type { SessionMetadata } from "../../../views/SessionListView";
import type { TableRow } from "./sessionMetricsTableTypes";

// ---------------------------------------------------------------------------
// Internal helpers -- small, pure, composable
// ---------------------------------------------------------------------------

/** Find metrics matching a session ID, returning zero defaults when absent. */
function findMetricsForSession(
  sessionId: string,
  metrics: readonly SessionMetrics[],
): { readonly cost: number; readonly totalTokens: number } {
  const found = metrics.find((m) => m.sessionId === sessionId);
  return found
    ? { cost: found.sessionCost, totalTokens: found.totalTokens }
    : { cost: 0, totalTokens: 0 };
}

/** Find the cwd from metadata for a session, returning null when absent. */
function findCwdForSession(
  sessionId: string,
  metadata: readonly SessionMetadata[],
): string | null {
  const found = metadata.find((m) => m.session_id === sessionId);
  return found?.cwd ?? null;
}

/** Transform a single session into a TableRow. */
function sessionToTableRow(
  session: SessionInfo,
  metrics: readonly SessionMetrics[],
  metadata: readonly SessionMetadata[],
  now: number,
): TableRow {
  const cwd = findCwdForSession(session.id, metadata);
  const name = deriveSessionName(cwd, session.id);
  const active = isSessionActive(session, now);
  const { cost, totalTokens } = findMetricsForSession(session.id, metrics);

  return { sessionId: session.id, name, isActive: active, cost, totalTokens };
}

// ---------------------------------------------------------------------------
// buildTableRows -- transform sessions + metrics + metadata into TableRow[]
// ---------------------------------------------------------------------------

/** Build table rows by mapping each session through the transformation pipeline. */
export function buildTableRows(
  sessions: readonly SessionInfo[],
  metrics: readonly SessionMetrics[],
  metadata: readonly SessionMetadata[],
  now: number,
): readonly TableRow[] {
  return sessions.map((session) =>
    sessionToTableRow(session, metrics, metadata, now),
  );
}

// ---------------------------------------------------------------------------
// formatCostColumn -- format a cost number as a dollar string
// ---------------------------------------------------------------------------

/** Format a numeric cost as a dollar string with two decimal places. */
export function formatCostColumn(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// formatTokenColumn -- format a token count with K suffix
// ---------------------------------------------------------------------------

/** Format a token count in thousands with one decimal place and K suffix. */
export function formatTokenColumn(tokens: number): string {
  const inThousands = tokens / 1000;
  return `${inThousands.toFixed(1)}K`;
}

// ---------------------------------------------------------------------------
// moveFocus -- compute next focus index with boundary clamping
// ---------------------------------------------------------------------------

/** Direction for keyboard navigation. */
export type FocusDirection = "up" | "down";

/**
 * Compute the next focus index given current index, direction, and row count.
 * Returns -1 when there are zero rows (no valid index).
 * Clamps at 0 (top) and rowCount - 1 (bottom).
 */
export function moveFocus(
  currentIndex: number,
  direction: FocusDirection,
  rowCount: number,
): number {
  if (rowCount === 0) return -1;

  const delta = direction === "down" ? 1 : -1;
  const nextIndex = currentIndex + delta;

  return Math.max(0, Math.min(nextIndex, rowCount - 1));
}

// ---------------------------------------------------------------------------
// selectFocusedRow -- extract session ID from focused row
// ---------------------------------------------------------------------------

/**
 * Extract the session ID from the row at the given focus index.
 * Returns null when the index is out of bounds or rows are empty.
 */
export function selectFocusedRow(
  focusedIndex: number,
  rows: readonly TableRow[],
): string | null {
  if (focusedIndex < 0 || focusedIndex >= rows.length) return null;
  return rows[focusedIndex].sessionId;
}
