/// Domain types for the session metrics table.
///
/// Pure type definitions -- no runtime side effects, no IO imports.
/// All interfaces are readonly (immutable data throughout).

import type { SessionInfo } from "../../../domain/status";
import type { SessionMetrics } from "../../norbert-usage/domain/types";
import type { SessionMetadata } from "../../../views/SessionListView";

// ---------------------------------------------------------------------------
// TableRow -- one row of the session metrics table
// ---------------------------------------------------------------------------

export interface TableRow {
  readonly sessionId: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly cost: number;
  readonly totalTokens: number;
  readonly burnRate: number;
  readonly contextPercent: number;
  readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// GroupedRows -- active vs recent grouping
// ---------------------------------------------------------------------------

export interface GroupedRows {
  readonly active: readonly TableRow[];
  readonly recent: readonly TableRow[];
  readonly activeCount: number;
  readonly recentCount: number;
}

// ---------------------------------------------------------------------------
// Sorting types
// ---------------------------------------------------------------------------

export type SortDirection = "asc" | "desc";

export type ColumnId =
  | "name"
  | "cost"
  | "totalTokens"
  | "burnRate"
  | "contextPercent"
  | "durationMs";

export interface SortState {
  readonly columnId: ColumnId;
  readonly direction: SortDirection;
}

// ---------------------------------------------------------------------------
// BuildTableRowsInput -- grouped inputs for buildTableRows
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Heat coloring types
// ---------------------------------------------------------------------------

/** Heat intensity level for metric cell shading. */
export type HeatLevel = "neutral" | "amber" | "red";

/** Column identifiers that support heat coloring. */
export type HeatColumnId =
  | "cost"
  | "totalTokens"
  | "burnRate"
  | "contextPercent"
  | "apiHealth";

export type {
  SessionInfo,
  SessionMetrics,
  SessionMetadata,
};
