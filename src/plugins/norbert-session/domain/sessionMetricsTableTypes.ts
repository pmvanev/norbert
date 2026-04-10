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
}

// ---------------------------------------------------------------------------
// BuildTableRowsInput -- grouped inputs for buildTableRows
// ---------------------------------------------------------------------------

export type {
  SessionInfo,
  SessionMetrics,
  SessionMetadata,
};
