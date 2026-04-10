/// Session metrics table domain functions.
///
/// Pure functions transforming sessions, metrics, and metadata into
/// table row data for display. No side effects, no IO imports.

import type { SessionInfo } from "../../../domain/status";
import { isSessionActive } from "../../../domain/status";
import { deriveSessionName } from "../../../domain/sessionPresentation";
import type { SessionMetrics } from "../../norbert-usage/domain/types";
import type { SessionMetadata } from "../../../views/SessionListView";
import type {
  TableRow,
  GroupedRows,
  ColumnId,
  SortDirection,
  SortState,
  HeatLevel,
  HeatColumnId,
} from "./sessionMetricsTableTypes";

// ---------------------------------------------------------------------------
// Internal helpers -- small, pure, composable
// ---------------------------------------------------------------------------

/** Find metrics matching a session ID, returning zero defaults when absent. */
function findMetricsForSession(
  sessionId: string,
  metrics: readonly SessionMetrics[],
): {
  readonly cost: number;
  readonly totalTokens: number;
  readonly burnRate: number;
  readonly contextPercent: number;
} {
  const found = metrics.find((m) => m.sessionId === sessionId);
  return found
    ? {
        cost: found.sessionCost,
        totalTokens: found.totalTokens,
        burnRate: found.burnRate,
        contextPercent: found.contextWindowPct,
      }
    : { cost: 0, totalTokens: 0, burnRate: 0, contextPercent: 0 };
}

/** Find the cwd from metadata for a session, returning null when absent. */
function findCwdForSession(
  sessionId: string,
  metadata: readonly SessionMetadata[],
): string | null {
  const found = metadata.find((m) => m.session_id === sessionId);
  return found?.cwd ?? null;
}

/** Compute session duration in milliseconds from started_at to now (or ended_at). */
function computeDurationMs(session: SessionInfo, now: number): number {
  const startedAt = new Date(session.started_at).getTime();
  const endedAt =
    session.ended_at !== null ? new Date(session.ended_at).getTime() : now;
  return Math.max(0, endedAt - startedAt);
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
  const { cost, totalTokens, burnRate, contextPercent } = findMetricsForSession(
    session.id,
    metrics,
  );
  const durationMs = computeDurationMs(session, now);

  return {
    sessionId: session.id,
    name,
    isActive: active,
    cost,
    totalTokens,
    burnRate,
    contextPercent,
    durationMs,
  };
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
// groupSessionRows -- partition rows into active and recent groups
// ---------------------------------------------------------------------------

/**
 * Partition table rows into active and recent groups based on isActive flag.
 * Active sessions (not ended, event within 5 min) go to the active group.
 * All other sessions go to the recent group.
 * Returns counts for each group alongside the row arrays.
 */
export function groupSessionRows(rows: readonly TableRow[]): GroupedRows {
  const active = rows.filter((row) => row.isActive);
  const recent = rows.filter((row) => !row.isActive);
  return {
    active,
    recent,
    activeCount: active.length,
    recentCount: recent.length,
  };
}

// ---------------------------------------------------------------------------
// toggleGroupCollapsed -- flip collapse/expand state
// ---------------------------------------------------------------------------

/** Toggle a group's collapsed state. Returns the opposite boolean value. */
export function toggleGroupCollapsed(collapsed: boolean): boolean {
  return !collapsed;
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

// ---------------------------------------------------------------------------
// sortTableRows -- sort rows by column with active-first grouping
// ---------------------------------------------------------------------------

/** Extract a comparable value from a row for the given column. */
function columnValue(row: TableRow, columnId: ColumnId): number | string {
  switch (columnId) {
    case "name":
      return row.name;
    case "cost":
      return row.cost;
    case "totalTokens":
      return row.totalTokens;
    case "burnRate":
      return row.burnRate;
    case "contextPercent":
      return row.contextPercent;
    case "durationMs":
      return row.durationMs;
  }
}

/** Compare two values with direction applied. */
function compareValues(
  a: number | string,
  b: number | string,
  direction: SortDirection,
): number {
  const multiplier = direction === "asc" ? 1 : -1;
  if (typeof a === "string" && typeof b === "string") {
    return multiplier * a.localeCompare(b);
  }
  return multiplier * ((a as number) - (b as number));
}

/**
 * Sort table rows by the given column and direction.
 * Active sessions always sort above completed sessions.
 * Within each group, rows are sorted by the specified column.
 * Returns a new array without mutating the input.
 */
export function sortTableRows(
  rows: readonly TableRow[],
  columnId: ColumnId,
  direction: SortDirection,
): readonly TableRow[] {
  return [...rows].sort((a, b) => {
    // Active sessions always sort above completed
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    // Within same active group, sort by column
    return compareValues(columnValue(a, columnId), columnValue(b, columnId), direction);
  });
}

// ---------------------------------------------------------------------------
// applySortToggle -- toggle sort direction or reset on new column
// ---------------------------------------------------------------------------

/**
 * Compute the next sort state when a column header is clicked.
 * Same column: flip direction (asc -> desc, desc -> asc).
 * Different column: reset to ascending.
 */
export function applySortToggle(
  currentSort: SortState,
  clickedColumnId: ColumnId,
): SortState {
  if (currentSort.columnId === clickedColumnId) {
    return {
      columnId: clickedColumnId,
      direction: currentSort.direction === "asc" ? "desc" : "asc",
    };
  }
  return { columnId: clickedColumnId, direction: "asc" };
}

// ---------------------------------------------------------------------------
// Heat coloring -- thresholds per column
// ---------------------------------------------------------------------------

/** Amber and red thresholds for each heat column. */
interface HeatThresholds {
  readonly amber: number;
  readonly red: number;
}

const HEAT_THRESHOLDS: Record<string, HeatThresholds> = {
  cost: { amber: 0.50, red: 2.00 },
  totalTokens: { amber: 50_000, red: 200_000 },
  burnRate: { amber: 100, red: 300 },
  contextPercent: { amber: 60, red: 80 },
};

/** API health thresholds: success rate BELOW these values triggers heat. */
const API_HEALTH_THRESHOLDS: HeatThresholds = { amber: 98, red: 90 };

/** Classify a value against standard (higher = hotter) thresholds. */
function classifyStandard(value: number, thresholds: HeatThresholds): HeatLevel {
  if (value >= thresholds.red) return "red";
  if (value >= thresholds.amber) return "amber";
  return "neutral";
}

/** Classify API health where LOWER success rate = higher heat. */
function classifyApiHealth(successRate: number): HeatLevel {
  if (successRate <= 0) return "neutral";
  if (successRate < API_HEALTH_THRESHOLDS.red) return "red";
  if (successRate < API_HEALTH_THRESHOLDS.amber) return "amber";
  return "neutral";
}

/**
 * Compute the heat level for a metric value in the given column.
 * Zero values always produce neutral (treated as missing/no-data).
 * For standard columns, higher values produce higher heat.
 * For apiHealth, lower success rates produce higher heat.
 */
export function computeHeatLevel(value: number, columnId: HeatColumnId): HeatLevel {
  if (value === 0) return "neutral";

  if (columnId === "apiHealth") {
    return classifyApiHealth(value);
  }

  const thresholds = HEAT_THRESHOLDS[columnId];
  return classifyStandard(value, thresholds);
}

// ---------------------------------------------------------------------------
// deriveHeatClass -- map HeatLevel to CSS class string
// ---------------------------------------------------------------------------

/** Map a HeatLevel to a CSS class string for styling. */
export function deriveHeatClass(heatLevel: HeatLevel): string {
  return `heat-${heatLevel}`;
}
