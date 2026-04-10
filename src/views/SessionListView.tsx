import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type SessionInfo,
  isEmptyState,
  EMPTY_STATE_MESSAGE,
  PLUGIN_INSTALL_COMMAND,
  formatDuration,
} from "../domain/status";
import {
  mapTerminalType,
} from "../domain/sessionPresentation";
import {
  filterSessions,
  SESSION_FILTER_PRESETS,
  type SessionFilterId,
} from "../domain/sessionFilter";
import {
  buildTableRows,
  groupSessionRows,
  toggleGroupCollapsed,
  sortTableRows,
  applySortToggle,
  computeHeatLevel,
  deriveHeatClass,
  computeStatusBarData,
  formatCostColumn,
  formatTokenColumn,
  moveFocus,
  selectFocusedRow,
  type FocusDirection,
} from "../plugins/norbert-session/domain/sessionMetricsTable";
import type {
  SortState,
  ColumnId,
  TableRow,
} from "../plugins/norbert-session/domain/sessionMetricsTableTypes";
import { usageMultiSessionStore } from "../plugins/norbert-usage/index";

/// Session metadata returned from the Tauri backend.
/// Fields are nullable because metadata may not be available for all sessions.
export interface SessionMetadata {
  readonly session_id: string;
  readonly terminal_type: string | null;
  readonly service_version: string | null;
  readonly os_type: string | null;
  readonly host_arch: string | null;
  readonly cwd: string | null;
}

/// Props for the SessionListView component.
interface SessionListViewProps {
  readonly sessions: readonly SessionInfo[];
  readonly onSessionSelect?: (sessionId: string) => void;
}

// ---------------------------------------------------------------------------
// Column header definitions for the fixed columns
// ---------------------------------------------------------------------------

interface ColumnHeaderDef {
  readonly id: ColumnId | "status";
  readonly label: string;
  readonly sortable: boolean;
}

const COLUMN_HEADERS: readonly ColumnHeaderDef[] = [
  { id: "status", label: "", sortable: false },
  { id: "name", label: "Name", sortable: true },
  { id: "cost", label: "Cost", sortable: true },
  { id: "totalTokens", label: "Tokens", sortable: true },
  { id: "burnRate", label: "Burn Rate", sortable: true },
  { id: "contextPercent", label: "Context", sortable: true },
  { id: "durationMs", label: "Duration", sortable: true },
];

const DEFAULT_SORT: SortState = { columnId: "cost", direction: "desc" };

// ---------------------------------------------------------------------------
// Pure helper: format duration from milliseconds
// ---------------------------------------------------------------------------

function formatDurationFromMs(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  return formatDuration(totalSeconds);
}

// ---------------------------------------------------------------------------
// Table row component
// ---------------------------------------------------------------------------

function MetricsTableRow({
  row,
  isFocused,
  onSelect,
  metadataMap,
}: {
  readonly row: TableRow;
  readonly isFocused: boolean;
  readonly onSelect?: (sessionId: string) => void;
  readonly metadataMap: ReadonlyMap<string, SessionMetadata>;
}) {
  const dotClass = row.isActive ? "sdot live" : "sdot done";
  const rowClass = row.isActive ? "srow live-s" : "srow";
  const focusClass = isFocused ? " focused" : "";
  const metadata = metadataMap.get(row.sessionId);
  const ideBadge = mapTerminalType(metadata?.terminal_type ?? null);

  const costHeat = deriveHeatClass(computeHeatLevel(row.cost, "cost"));
  const tokenHeat = deriveHeatClass(computeHeatLevel(row.totalTokens, "totalTokens"));
  const burnHeat = deriveHeatClass(computeHeatLevel(row.burnRate, "burnRate"));
  const contextHeat = deriveHeatClass(computeHeatLevel(row.contextPercent, "contextPercent"));

  return (
    <tr
      className={`${rowClass}${focusClass}`}
      onClick={() => onSelect?.(row.sessionId)}
      data-session-id={row.sessionId}
    >
      <td><span className={dotClass} /></td>
      <td className="sname">
        {row.name}
        {ideBadge !== null && <span className="sbadge br">{ideBadge}</span>}
      </td>
      <td className={costHeat}>{formatCostColumn(row.cost)}</td>
      <td className={tokenHeat}>{formatTokenColumn(row.totalTokens)}</td>
      <td className={burnHeat}>{row.burnRate > 0 ? `${row.burnRate.toFixed(0)}/min` : "--"}</td>
      <td className={contextHeat}>{row.contextPercent > 0 ? `${row.contextPercent.toFixed(0)}%` : "--"}</td>
      <td>{formatDurationFromMs(row.durationMs)}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Group header row
// ---------------------------------------------------------------------------

function GroupHeaderRow({
  label,
  count,
  collapsed,
  onToggle,
}: {
  readonly label: string;
  readonly count: number;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <tr className="group-header" onClick={onToggle}>
      <td colSpan={COLUMN_HEADERS.length}>
        <span className="group-toggle">{collapsed ? "\u25B6" : "\u25BC"}</span>
        {` ${label} (${count})`}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/// Displays a sortable metrics table of sessions with grouped sections.
///
/// Replaces the card-based session list with a table layout.
/// Preserves: SessionListViewProps interface, metadata fetching, filter dropdown,
/// sec-hdr title area, empty state handling, pulsing green dot for active sessions.
export function SessionListView({ sessions, onSessionSelect }: SessionListViewProps) {
  const [metadataMap, setMetadataMap] = useState<ReadonlyMap<string, SessionMetadata>>(new Map());
  const [metadataList, setMetadataList] = useState<readonly SessionMetadata[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<SessionFilterId>("active-now");
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT);
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const tableRef = useRef<HTMLTableElement>(null);

  // Subscribe to multi-session store for live metrics
  const [allMetrics, setAllMetrics] = useState(() => usageMultiSessionStore.getSessions());
  useEffect(() => {
    setAllMetrics(usageMultiSessionStore.getSessions());
    return usageMultiSessionStore.subscribe(() => {
      setAllMetrics(usageMultiSessionStore.getSessions());
    });
  }, []);

  /// Fetch session metadata once when sessions change.
  useEffect(() => {
    if (sessions.length === 0) return;
    invoke<SessionMetadata[]>("get_all_session_metadata")
      .then((list) => {
        const map = new Map<string, SessionMetadata>();
        for (const meta of list) {
          map.set(meta.session_id, meta);
        }
        setMetadataMap(map);
        setMetadataList(list);
      })
      .catch(() => {
        // Missing metadata is not an error -- badges simply won't display
      });
  }, [sessions]);

  // Filter sessions
  const filteredSessions = useMemo(
    () => filterSessions(sessions, selectedFilter, Date.now()),
    [sessions, selectedFilter],
  );

  // Build table rows from domain function pipeline
  const tableRows = useMemo(
    () => buildTableRows(filteredSessions, [...allMetrics], [...metadataList], Date.now()),
    [filteredSessions, allMetrics, metadataList],
  );

  // Sort rows
  const sortedRows = useMemo(
    () => sortTableRows(tableRows, sortState.columnId, sortState.direction),
    [tableRows, sortState],
  );

  // Group rows
  const grouped = useMemo(() => groupSessionRows(sortedRows), [sortedRows]);

  // Build visible rows list (respecting collapse state) for keyboard navigation
  const visibleRows = useMemo(() => {
    const rows: TableRow[] = [];
    if (!activeCollapsed) rows.push(...grouped.active);
    if (!recentCollapsed) rows.push(...grouped.recent);
    return rows;
  }, [grouped, activeCollapsed, recentCollapsed]);

  // Status bar data
  const statusBar = useMemo(() => computeStatusBarData(visibleRows), [visibleRows]);

  // Column header click handler
  const handleColumnSort = useCallback((columnId: ColumnId) => {
    setSortState((prev) => applySortToggle(prev, columnId));
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) => moveFocus(prev, "down" as FocusDirection, visibleRows.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => moveFocus(prev, "up" as FocusDirection, visibleRows.length));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selectedId = selectFocusedRow(focusIndex, visibleRows);
        if (selectedId !== null) {
          onSessionSelect?.(selectedId);
        }
      }
    },
    [visibleRows, focusIndex, onSessionSelect],
  );

  // Empty state
  if (isEmptyState(sessions.length)) {
    return (
      <section className="session-list-empty">
        <p>{EMPTY_STATE_MESSAGE}</p>
        <code>{PLUGIN_INSTALL_COMMAND}</code>
      </section>
    );
  }

  return (
    <section className="session-list">
      <div className="sec-hdr">
        <span className="sec-t">Sessions</span>
        <select
          className="glass-dropdown"
          value={selectedFilter}
          onChange={(e) => setSelectedFilter(e.target.value as SessionFilterId)}
        >
          {SESSION_FILTER_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <span className="sec-a">{filteredSessions.length} sessions</span>
      </div>
      {filteredSessions.length === 0 ? (
        <p className="session-filter-empty">No sessions in this time window</p>
      ) : (
        <>
          <table
            className="metrics-tbl"
            ref={tableRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
          >
            <thead>
              <tr>
                {COLUMN_HEADERS.map((col) => (
                  <th
                    key={col.id}
                    scope="col"
                    className={col.sortable ? "sortable" : ""}
                    onClick={col.sortable ? () => handleColumnSort(col.id as ColumnId) : undefined}
                  >
                    {col.label}
                    {col.sortable && sortState.columnId === col.id && (
                      <span className="sort-indicator">
                        {sortState.direction === "asc" ? " \u25B2" : " \u25BC"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Active group */}
              <GroupHeaderRow
                label="Active Sessions"
                count={grouped.activeCount}
                collapsed={activeCollapsed}
                onToggle={() => setActiveCollapsed(toggleGroupCollapsed)}
              />
              {!activeCollapsed &&
                grouped.active.map((row) => (
                  <MetricsTableRow
                    key={row.sessionId}
                    row={row}
                    isFocused={visibleRows[focusIndex]?.sessionId === row.sessionId}
                    onSelect={onSessionSelect}
                    metadataMap={metadataMap}
                  />
                ))}
              {/* Recent group */}
              <GroupHeaderRow
                label="Recent Sessions"
                count={grouped.recentCount}
                collapsed={recentCollapsed}
                onToggle={() => setRecentCollapsed(toggleGroupCollapsed)}
              />
              {!recentCollapsed &&
                grouped.recent.map((row) => (
                  <MetricsTableRow
                    key={row.sessionId}
                    row={row}
                    isFocused={visibleRows[focusIndex]?.sessionId === row.sessionId}
                    onSelect={onSessionSelect}
                    metadataMap={metadataMap}
                  />
                ))}
            </tbody>
          </table>
          <div className="status-bar" data-testid="status-bar">
            <span>{statusBar.sessionCount} sessions</span>
            <span>{formatCostColumn(statusBar.totalCost)} total</span>
            <span>{formatTokenColumn(statusBar.totalTokens)} tokens</span>
          </div>
        </>
      )}
    </section>
  );
}
