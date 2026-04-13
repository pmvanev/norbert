/// Domain types for the session metrics table.
///
/// Pure type definitions -- no runtime side effects, no IO imports.
/// All interfaces are readonly (immutable data throughout).

// ---------------------------------------------------------------------------
// SessionMetadata -- session metadata from the Tauri backend.
// Defined here (domain) rather than in the view layer to avoid
// dependency inversion (domain must not import from views).
// ---------------------------------------------------------------------------

export interface SessionMetadata {
  readonly session_id: string;
  readonly terminal_type: string | null;
  readonly service_version: string | null;
  readonly os_type: string | null;
  readonly host_arch: string | null;
  readonly cwd: string | null;
  readonly git_branch: string | null;
}

// ---------------------------------------------------------------------------
// SessionSummary -- pre-aggregated cost/token totals from the database
// ---------------------------------------------------------------------------

export interface SessionSummary {
  readonly sessionId: string;
  readonly totalCost: number;
  readonly totalTokens: number;
}

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
  // Optional column fields -- always populated, available when columns toggled on
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly activeAgents: number;
  readonly totalEventCount: number;
  readonly version: string | null;
  readonly platform: string | null;
}

// ---------------------------------------------------------------------------
// OptionalColumnId -- identifiers for toggle-able optional columns
// ---------------------------------------------------------------------------

export type OptionalColumnId =
  | "version"
  | "platform"
  | "inputTokens"
  | "outputTokens"
  | "cacheHitPct"
  | "activeAgents"
  | "events";

// ---------------------------------------------------------------------------
// ColumnDefinition -- describes an optional column for the column menu
// ---------------------------------------------------------------------------

export interface ColumnDefinition {
  readonly id: OptionalColumnId;
  readonly label: string;
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

// ---------------------------------------------------------------------------
// StatusBarData -- aggregated totals for the status bar
// ---------------------------------------------------------------------------

export interface StatusBarData {
  readonly sessionCount: number;
  readonly trackedCount: number;
  readonly totalCost: number;
  readonly totalTokens: number;
}

