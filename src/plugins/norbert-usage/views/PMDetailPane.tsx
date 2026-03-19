/**
 * PMDetailPane: right-side detail pane for the Performance Monitor v2.
 *
 * Renders category-scoped sections top to bottom:
 *   1. Header (category name + subtitle)
 *   2. Aggregate graph (PMChart in aggregate mode) -- omitted for context
 *   3. Per-session graph grid (PMChart in mini mode) -- hidden when 1 session
 *   4. Stats grid placeholder (04-03)
 *   5. Session table placeholder (04-03)
 *
 * Pure data flows through categoryConfig and MultiSessionStore.
 * Canvas drawing (via PMChart) is the only side effect (at the view boundary).
 */

import type { MultiSessionStore } from "../adapters/multiSessionStore";
import type { MetricCategoryId, HoverState } from "../domain/types";
import { getCategoryById, type MetricCategory } from "../domain/categoryConfig";
import { PMChart, type HoverData } from "./PMChart";

// ---------------------------------------------------------------------------
// Pure layout helpers
// ---------------------------------------------------------------------------

/** Determine grid column count based on session count. */
const computeGridColumns = (sessionCount: number): number =>
  sessionCount <= 4 ? 2 : 3;

/** Determine whether to show the per-session grid. */
const shouldShowPerSessionGrid = (sessionCount: number): boolean =>
  sessionCount > 1;

/** Determine whether to show the aggregate graph. */
const shouldShowAggregateGraph = (category: MetricCategory): boolean =>
  category.aggregateApplicable;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMDetailPaneProps {
  readonly multiSessionStore: MultiSessionStore;
  readonly selectedCategory: MetricCategoryId;
  readonly selectedWindow: string;
  readonly hoverState: HoverState;
  readonly onHoverChange: (state: HoverState) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMDetailPane = ({
  multiSessionStore,
  selectedCategory,
  selectedWindow,
  hoverState,
  onHoverChange,
}: PMDetailPaneProps) => {
  const category = getCategoryById(selectedCategory);

  if (!category) {
    return (
      <div className="pm-detail-pane" data-selected-category={selectedCategory}>
        <div className="pm-detail-empty">Unknown category</div>
      </div>
    );
  }

  const sessions = multiSessionStore.getSessions();
  const sessionCount = sessions.length;
  const showAggregate = shouldShowAggregateGraph(category);
  const showPerSessionGrid = shouldShowPerSessionGrid(sessionCount);
  const gridColumns = computeGridColumns(sessionCount);

  // Aggregate buffer for the main graph
  const aggregateBuffer = multiSessionStore.getAggregateBuffer(selectedCategory);

  // Build hover handlers that populate the shared HoverState
  const createHoverHandler = (canvasId: string) => (data: HoverData): void => {
    onHoverChange({
      active: true,
      canvasId,
      mouseX: 0,
      sampleIndex: data.sampleIndex,
      value: data.value,
      formattedValue: category.formatValue(data.value),
      timeOffset: `${Math.round(data.timeOffsetMs / 1000)}s ago`,
      color: category.color,
      tooltipX: 0,
      tooltipY: 0,
    });
  };

  const handleAggregateHover = createHoverHandler(`aggregate-${selectedCategory}`);

  const handleHoverEnd = (): void => {
    onHoverChange({
      ...hoverState,
      active: false,
    });
  };

  // Derive the crosshair index for synchronized hover across charts
  const activeCrosshairIndex = hoverState.active ? hoverState.sampleIndex : undefined;

  return (
    <div
      className="pm-detail-pane"
      data-selected-category={selectedCategory}
      data-selected-window={selectedWindow}
    >
      {/* Header */}
      <div className="pm-detail-header">
        <span
          className="pm-detail-category-name"
          style={{ color: category.color }}
        >
          {category.label}
        </span>
        <span className="pm-detail-subtitle">
          {selectedCategory === "context"
            ? "Per-session context utilization"
            : `Aggregate across ${sessionCount} session${sessionCount !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Aggregate graph -- omitted for non-aggregatable categories */}
      {showAggregate && (
        <div className="pm-detail-aggregate-graph">
          <PMChart
            title={`${category.label} (Aggregate)`}
            samples={aggregateBuffer.samples}
            field="tokenRate"
            color={category.color}
            mode="aggregate"
            yMax={category.yMax}
            yLabels={category.yLabels}
            formatValue={category.formatValue}
            hoverIndex={
              hoverState.active && hoverState.canvasId === `aggregate-${selectedCategory}`
                ? activeCrosshairIndex
                : undefined
            }
            onHover={handleAggregateHover}
            onHoverEnd={handleHoverEnd}
          />
        </div>
      )}

      {/* Per-session graph grid -- hidden when only 1 session active */}
      {showPerSessionGrid && (
        <div
          className="pm-detail-session-grid"
          style={{
            gridTemplateColumns: `repeat(${gridColumns}, 1fr)`,
          }}
        >
          {sessions.map((session) => {
            const sessionBuffer = multiSessionStore.getSessionBuffer(
              session.sessionId,
              selectedCategory,
            );
            const samples = sessionBuffer?.samples ?? [];

            return (
              <div
                key={session.sessionId}
                className={`pm-detail-session-chart${!showAggregate ? " pm-detail-session-chart-primary" : ""}`}
              >
                <PMChart
                  title={`${category.label} - ${session.sessionId}`}
                  samples={samples}
                  field="tokenRate"
                  color={category.color}
                  mode="mini"
                  yMax={category.yMax}
                  yLabels={category.yLabels}
                  label={session.sessionId}
                  formatValue={category.formatValue}
                  hoverIndex={
                    hoverState.active &&
                    hoverState.canvasId === `session-${session.sessionId}-${selectedCategory}`
                      ? activeCrosshairIndex
                      : undefined
                  }
                  onHover={createHoverHandler(`session-${session.sessionId}-${selectedCategory}`)}
                  onHoverEnd={handleHoverEnd}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Stats grid placeholder (04-03) */}
      <div className="pm-detail-stats-grid" data-category={selectedCategory}>
        {category.statsConfig.map((stat) => (
          <div key={stat.key} className="pm-detail-stat-cell">
            <span className="pm-detail-stat-label">{stat.label}</span>
            <span className="pm-detail-stat-value" data-mono="true">
              --
            </span>
          </div>
        ))}
      </div>

      {/* Session table placeholder (04-03) */}
      <div className="pm-detail-session-table" data-category={selectedCategory}>
        <div className="pm-detail-table-header">
          {category.sessionColumns.map((col) => (
            <span key={col} className="pm-detail-table-col">
              {col}
            </span>
          ))}
        </div>
        {sessions.map((session) => (
          <div key={session.sessionId} className="pm-detail-table-row">
            <span className="pm-detail-table-cell" data-mono="true">
              {session.sessionId}
            </span>
            {category.sessionColumns.slice(1).map((col) => (
              <span key={col} className="pm-detail-table-cell" data-mono="true">
                --
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
