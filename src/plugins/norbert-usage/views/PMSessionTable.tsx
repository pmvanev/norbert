/**
 * PMSessionTable: per-session breakdown table for the selected category.
 *
 * Column headers are driven by category.sessionColumns configuration.
 * Rows represent active sessions, sorted by primary metric descending
 * (the first non-ID column is the sort key).
 *
 * Pure presentational component -- receives pre-formatted session data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single row of session data with pre-formatted cell values. */
export interface SessionRowData {
  readonly sessionId: string;
  readonly displayLabel: string;
  readonly cells: ReadonlyArray<string>;
  readonly sortValue: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Sort session rows by primary metric (sortValue) descending.
 * Returns a new array -- does not mutate input.
 */
const sortByPrimaryMetricDescending = (
  rows: ReadonlyArray<SessionRowData>,
): ReadonlyArray<SessionRowData> =>
  [...rows].sort((a, b) => b.sortValue - a.sortValue);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMSessionTableProps {
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<SessionRowData>;
  readonly categoryId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMSessionTable = ({
  columns,
  rows,
  categoryId,
}: PMSessionTableProps) => {
  const sortedRows = sortByPrimaryMetricDescending(rows);

  return (
    <div className="pm-detail-session-table" data-category={categoryId}>
      <div className="pm-detail-table-header">
        {columns.map((col) => (
          <span key={col} className="pm-detail-table-col">
            {col}
          </span>
        ))}
      </div>
      {sortedRows.map((row) => (
        <div key={row.sessionId} className="pm-detail-table-row">
          <span className="pm-detail-table-cell" data-mono="true">
            {row.displayLabel}
          </span>
          {row.cells.map((cellValue, index) => (
            <span
              key={columns[index + 1] ?? index}
              className="pm-detail-table-cell"
              data-mono="true"
            >
              {cellValue}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
