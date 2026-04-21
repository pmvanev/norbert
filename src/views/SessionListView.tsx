import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type SessionInfo,
  isEmptyState,
  isSessionActive,
  EMPTY_STATE_MESSAGE,
  PLUGIN_INSTALL_COMMAND,
  formatDuration,
} from "../domain/status";
import {
  filterSessions,
  SESSION_FILTER_PRESETS,
  type SessionFilterId,
} from "../domain/sessionFilter";
import {
  buildTableRows,
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
  SessionMetadata,
  SessionSummary,
} from "../plugins/norbert-session/domain/sessionMetricsTableTypes";
import { usageMultiSessionStore } from "../plugins/norbert-usage/index";
import {
  colorForSpectrumIndex,
  type PhosphorSpectrum,
} from "../plugins/norbert-usage/domain/phosphor/phosphorSpectrum";

/**
 * Resolve the active theme's phosphor spectrum from the `--phosphor-spectrum-*`
 * CSS custom properties declared on the given container. Returns null when any
 * component is missing or unparseable so the caller can fall back to the
 * default dot color.
 *
 * Mirrored (small, intentional duplication) from the phosphor-view resolvers
 * at `views/phosphor/PhosphorScopeView.tsx` and `PhosphorCanvasHost.tsx`. All
 * three read the same vars; a future pass can consolidate into a shared
 * module once the in-flight phosphor-spectrum WIP settles.
 */
const resolvePhosphorSpectrum = (
  container: HTMLElement | null,
): PhosphorSpectrum | null => {
  if (container === null || typeof window === "undefined") return null;
  const styles = window.getComputedStyle(container);
  const read = (prop: string): number | null => {
    const raw = styles.getPropertyValue(prop).trim();
    if (raw === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const hueStart = read("--phosphor-spectrum-hue-start");
  const hueEnd = read("--phosphor-spectrum-hue-end");
  const satStart = read("--phosphor-spectrum-sat-start");
  const satEnd = read("--phosphor-spectrum-sat-end");
  const lightStart = read("--phosphor-spectrum-light-start");
  const lightEnd = read("--phosphor-spectrum-light-end");
  if (
    hueStart === null ||
    hueEnd === null ||
    satStart === null ||
    satEnd === null ||
    lightStart === null ||
    lightEnd === null
  ) {
    return null;
  }
  return { hueStart, hueEnd, satStart, satEnd, lightStart, lightEnd };
};

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
  sessionColor,
}: {
  readonly row: TableRow;
  readonly isFocused: boolean;
  readonly onSelect?: (sessionId: string) => void;
  /**
   * Phosphor-palette color assigned to this session in the Performance
   * Monitor. Applied as a `--session-color` CSS custom property on the live
   * dot so `.sdot.live` can render both the background fill and the pulsing
   * box-shadow glow in the session's identity color. Only supplied for
   * active rows whose session is registered in `usageMultiSessionStore`;
   * inactive rows and not-yet-registered sessions fall back to `--brand`
   * via the CSS `var()` fallback.
   */
  readonly sessionColor?: string;
}) {
  const dotClass = row.isActive ? "sdot live" : "sdot done";
  const rowClass = row.isActive ? "srow live-s" : "srow";
  const focusClass = isFocused ? " focused" : "";
  const costHeat = deriveHeatClass(computeHeatLevel(row.cost, "cost"));
  const tokenHeat = deriveHeatClass(computeHeatLevel(row.totalTokens, "totalTokens"));
  const contextHeat = deriveHeatClass(computeHeatLevel(row.contextPercent, "contextPercent"));
  const dotStyle =
    row.isActive && sessionColor !== undefined
      ? ({ ["--session-color" as string]: sessionColor } as React.CSSProperties)
      : undefined;

  return (
    <tr
      className={`${rowClass}${focusClass}`}
      onClick={() => onSelect?.(row.sessionId)}
      data-session-id={row.sessionId}
    >
      <td><span className={dotClass} style={dotStyle} /></td>
      <td className="sname">{row.name}</td>
      <td className={costHeat}>{formatCostColumn(row.cost)}</td>
      <td className={tokenHeat}>{formatTokenColumn(row.totalTokens)}</td>
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
// Group total row
// ---------------------------------------------------------------------------

function GroupTotalRow({ rows }: { readonly rows: readonly TableRow[] }) {
  const totals = computeStatusBarData(rows);
  return (
    <tr className="group-total">
      <td />
      <td className="sname">Total</td>
      <td>{formatCostColumn(totals.totalCost)}</td>
      <td>{formatTokenColumn(totals.totalTokens)}</td>
      <td>--</td>
      <td>--</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Past group header with time-range pills
// ---------------------------------------------------------------------------

function PastGroupHeaderRow({
  count,
  collapsed,
  onToggle,
  selectedFilter,
  onFilterChange,
}: {
  readonly count: number;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly selectedFilter: SessionFilterId;
  readonly onFilterChange: (id: SessionFilterId) => void;
}) {
  return (
    <tr className="group-header">
      <td colSpan={COLUMN_HEADERS.length}>
        <span className="group-header-inner">
          <span className="group-label" onClick={onToggle}>
            <span className="group-toggle">{collapsed ? "\u25B6" : "\u25BC"}</span>
            {` Past Sessions (${count})`}
          </span>
          <span className="time-pills" onClick={(e) => e.stopPropagation()}>
            {SESSION_FILTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`time-pill${selectedFilter === preset.id ? " active" : ""}`}
                onClick={() => onFilterChange(preset.id)}
              >
                {preset.shortLabel}
              </button>
            ))}
          </span>
        </span>
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
  const [metadataList, setMetadataList] = useState<readonly SessionMetadata[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<SessionFilterId>("last-24h");
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT);
  const [activeCollapsed, setActiveCollapsed] = useState(false);
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const tableRef = useRef<HTMLTableElement>(null);
  // Ref on the outer <section> so we can read the theme's
  // `--phosphor-spectrum-*` CSS vars via `getComputedStyle`. Resolving from a
  // DOM node inside the tree (rather than `documentElement`) means future
  // scoped-theme overrides still pick up the right spectrum.
  const sectionRef = useRef<HTMLElement>(null);

  // Subscribe to multi-session store for live metrics
  const [allMetrics, setAllMetrics] = useState(() => usageMultiSessionStore.getSessions());
  useEffect(() => {
    setAllMetrics(usageMultiSessionStore.getSessions());
    return usageMultiSessionStore.subscribe(() => {
      setAllMetrics(usageMultiSessionStore.getSessions());
    });
  }, []);

  // Fetch session metadata and DB summaries once when sessions change.
  const [summaries, setSummaries] = useState<readonly SessionSummary[]>([]);
  useEffect(() => {
    if (sessions.length === 0) return;
    invoke<SessionMetadata[]>("get_all_session_metadata")
      .then(setMetadataList)
      .catch(() => {
        // Missing metadata is not an error -- badges simply won't display
      });
    invoke<SessionSummary[]>("get_all_session_summaries")
      .then(setSummaries)
      .catch(() => {
        // Missing summaries degrade gracefully -- live metrics still work
      });
  }, [sessions]);

  // Split sessions into active (always shown) and inactive (filtered)
  const activeSessions = useMemo(
    () => sessions.filter((s) => isSessionActive(s, Date.now())),
    [sessions],
  );
  const pastSessions = useMemo(() => {
    const inactive = sessions.filter((s) => !isSessionActive(s, Date.now()));
    return filterSessions(inactive, selectedFilter, Date.now());
  }, [sessions, selectedFilter]);

  // Build and sort rows for each group independently
  const activeRows = useMemo(
    () => sortTableRows(
      buildTableRows(activeSessions, [...allMetrics], [...metadataList], [...summaries], Date.now()),
      sortState.columnId, sortState.direction,
    ),
    [activeSessions, allMetrics, metadataList, summaries, sortState],
  );
  const pastRows = useMemo(
    () => sortTableRows(
      buildTableRows(pastSessions, [...allMetrics], [...metadataList], [...summaries], Date.now()),
      sortState.columnId, sortState.direction,
    ),
    [pastSessions, allMetrics, metadataList, summaries, sortState],
  );

  // Per-session color map keyed on registration order in the phosphor store
  // (same order that drives the Performance Monitor palette). Ids not present
  // in the store — or sessions seen before `sectionRef.current` has mounted
  // and the theme vars can be read — simply fall out of the map; the row
  // falls back to the default `--brand` via the CSS `var()` fallback.
  //
  // `getComputedStyle` inside the memo runs only when the metrics snapshot
  // changes, not on every focus/sort/collapse render. The spectrum is
  // re-resolved from the live DOM each time, so a theme switch flows through
  // on the next store notification (~250 ms cadence).
  const sessionColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const spectrum = resolvePhosphorSpectrum(sectionRef.current);
    if (spectrum === null) return map;
    allMetrics.forEach((metrics, index) => {
      map.set(metrics.sessionId, colorForSpectrumIndex(index, spectrum));
    });
    return map;
  }, [allMetrics]);

  // Build visible rows list (respecting collapse state) for keyboard navigation
  const visibleRows = useMemo(() => {
    const rows: TableRow[] = [];
    if (!activeCollapsed) rows.push(...activeRows);
    if (!recentCollapsed) rows.push(...pastRows);
    return rows;
  }, [activeRows, pastRows, activeCollapsed, recentCollapsed]);


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
    <section className="session-list" ref={sectionRef}>
      <div className="sec-hdr">
        <span className="sec-t">Sessions</span>
      </div>
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
            count={activeRows.length}
            collapsed={activeCollapsed}
            onToggle={() => setActiveCollapsed((prev) => toggleGroupCollapsed(prev))}
          />
          {!activeCollapsed &&
            activeRows.map((row) => (
              <MetricsTableRow
                key={row.sessionId}
                row={row}
                isFocused={visibleRows[focusIndex]?.sessionId === row.sessionId}
                onSelect={onSessionSelect}
                sessionColor={sessionColorMap.get(row.sessionId)}
              />
            ))}
          {!activeCollapsed && activeRows.length > 0 && (
            <GroupTotalRow rows={activeRows} />
          )}
          {/* Past group with time-range pills */}
          <PastGroupHeaderRow
            count={pastRows.length}
            collapsed={recentCollapsed}
            onToggle={() => setRecentCollapsed((prev) => toggleGroupCollapsed(prev))}
            selectedFilter={selectedFilter}
            onFilterChange={setSelectedFilter}
          />
          {!recentCollapsed &&
            pastRows.map((row) => (
              <MetricsTableRow
                key={row.sessionId}
                row={row}
                isFocused={visibleRows[focusIndex]?.sessionId === row.sessionId}
                onSelect={onSessionSelect}
                sessionColor={sessionColorMap.get(row.sessionId)}
              />
            ))}
          {!recentCollapsed && pastRows.length > 0 && (
            <GroupTotalRow rows={pastRows} />
          )}
        </tbody>
      </table>
    </section>
  );
}
