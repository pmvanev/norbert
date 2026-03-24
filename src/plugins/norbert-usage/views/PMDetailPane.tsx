/**
 * PMDetailPane: right-side detail pane for the Performance Monitor v2.
 *
 * Renders category-scoped sections top to bottom:
 *   1. Header (category name + subtitle)
 *   2. Aggregate graph (PMChart in aggregate mode) -- omitted for context
 *   3. Per-session graph grid (PMChart in mini mode) -- hidden when 1 session
 *   4. Stats grid (PMStatsGrid with derived aggregate metrics)
 *   5. Session table (PMSessionTable with per-session breakdown)
 *
 * Pure data flows through categoryConfig and MultiSessionStore.
 * Canvas drawing (via PMChart) is the only side effect (at the view boundary).
 */

import type { MultiSessionStore } from "../adapters/multiSessionStore";
import type { MetricCategoryId, HoverState, TimeWindowId } from "../domain/types";
import { getCategoryById, type MetricCategory } from "../domain/categoryConfig";
import {
  computeGridColumns,
  shouldShowPerSessionGrid,
  shouldShowAggregateGraph,
  formatSessionLabel,
  formatDurationLabel,
} from "../domain/chartViewHelpers";
import { PMChart, type HoverData, resolveThemeColor } from "./PMChart";
import { PMStatsGrid } from "./PMStatsGrid";
import { PMSessionTable, type SessionRowData } from "./PMSessionTable";

/**
 * Derive stats grid metrics from the aggregate buffer for a category.
 * Returns a key-value record suitable for PMStatsGrid.
 */
const deriveStatsFromBuffer = (
  multiSessionStore: MultiSessionStore,
  categoryId: MetricCategoryId,
  windowId: TimeWindowId,
): Readonly<Record<string, number | string>> => {
  const buffer = multiSessionStore.getAggregateWindowBuffer(categoryId, windowId);
  const samples = buffer.samples;
  const sessions = multiSessionStore.getSessions();

  if (samples.length === 0) {
    return { sessions: sessions.length };
  }

  const values = samples.map((s) => s.tokenRate);
  const peak = values.reduce((a, b) => Math.max(a, b), 0);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const current = values[values.length - 1];

  // Aggregate metrics from session data
  const totalToolCalls = sessions.reduce((sum, s) => sum + s.toolCallCount, 0);
  const totalTokensAgg = sessions.reduce((sum, s) => sum + s.totalTokens, 0);
  const totalCostAgg = sessions.reduce((sum, s) => sum + s.sessionCost, 0);
  const activeAgents = sessions.reduce((sum, s) => sum + s.activeAgentCount, 0);
  const latestModel = sessions.length > 0 ? sessions[sessions.length - 1].contextWindowModel : "--";

  return {
    peak,
    avg: Math.round(avg * 100) / 100,
    current,
    sessions: sessions.length,
    totalTokens: totalTokensAgg,
    costRate: current,
    toolCalls: totalToolCalls,
    sessionTotal: totalCostAgg > 0 ? `$${totalCostAgg.toFixed(4)}` : "--",
    totalCost: totalCostAgg > 0 ? `$${totalCostAgg.toFixed(4)}` : "--",
    avgCostPerToken: totalTokensAgg > 0
      ? `$${(totalCostAgg / totalTokensAgg * 1_000_000).toFixed(2)}/M`
      : "--",
    model: latestModel || "--",
    active: activeAgents,
    totalSpawned: totalToolCalls,
    avgPerSession: sessions.length > 0 ? Math.round(peak / sessions.length) : 0,
    remaining: `${Math.max(0, 100 - Math.round(current))}%`,
    maxTokens: sessions.length > 0
      ? sessions[sessions.length - 1].contextWindowMaxTokens.toLocaleString()
      : "--",
    urgency: "--",
    compressions: "--",
  };
};

/**
 * Build SessionRowData[] from multiSessionStore sessions for the given category.
 * Each row contains pre-formatted cell values matching the category's sessionColumns.
 */
const buildSessionRows = (
  multiSessionStore: MultiSessionStore,
  categoryId: MetricCategoryId,
  category: MetricCategory,
  windowId: TimeWindowId,
): ReadonlyArray<SessionRowData> => {
  const sessions = multiSessionStore.getSessions();

  return sessions.map((session) => {
    const sessionBuffer = multiSessionStore.getSessionWindowBuffer(session.sessionId, categoryId, windowId);
    const latestValue = sessionBuffer && sessionBuffer.samples.length > 0
      ? sessionBuffer.samples[sessionBuffer.samples.length - 1].tokenRate
      : 0;

    // Build cell values for columns after the Session ID column
    const cells = category.sessionColumns.slice(1).map((col) => {
      // First data column is the primary metric for this category
      if (col === category.sessionColumns[1]) {
        return category.formatValue(latestValue);
      }
      return "--";
    });

    return {
      sessionId: session.sessionId,
      displayLabel: formatSessionLabel(session),
      cells,
      sortValue: latestValue,
    };
  });
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMDetailPaneProps {
  readonly multiSessionStore: MultiSessionStore;
  readonly selectedCategory: MetricCategoryId;
  readonly selectedWindow: TimeWindowId;
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

  // Resolve theme-aware color from CSS var at render time
  const themeColor = resolveThemeColor(category.cssVar, category.color);

  const sessions = multiSessionStore.getSessions();
  const sessionCount = sessions.length;
  const showAggregate = shouldShowAggregateGraph(category);
  const showPerSessionGrid = shouldShowPerSessionGrid(sessionCount);
  const gridColumns = computeGridColumns(sessionCount);

  // Aggregate buffer for the main graph (window-aware)
  const aggregateBuffer = multiSessionStore.getAggregateWindowBuffer(selectedCategory, selectedWindow);

  // Empty state: no active sessions and no historical aggregate data
  const hasNoData = sessionCount === 0 && aggregateBuffer.samples.length === 0;

  if (hasNoData) {
    return (
      <div
        className="pm-detail-pane"
        data-selected-category={selectedCategory}
        data-selected-window={selectedWindow}
        role="region"
        aria-label="Metric detail"
      >
        {/* Header */}
        <div className="pm-detail-header">
          <span
            className="pm-detail-category-name"
            style={{ color: themeColor }}
          >
            {category.label}
          </span>
          <span className="pm-detail-subtitle">
            No active sessions
          </span>
        </div>
        <div className="pm-detail-empty">No active sessions</div>
      </div>
    );
  }

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
      color: themeColor,
      tooltipX: data.tooltipX,
      tooltipY: data.tooltipY,
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

  // Derive stats and session rows for the real components
  const metricsData = deriveStatsFromBuffer(multiSessionStore, selectedCategory, selectedWindow);
  const sessionRows = buildSessionRows(multiSessionStore, selectedCategory, category, selectedWindow);

  return (
    <div
      className="pm-detail-pane"
      data-selected-category={selectedCategory}
      data-selected-window={selectedWindow}
      role="region"
      aria-label="Metric detail"
    >
      {/* Header */}
      <div className="pm-detail-header">
        <span
          className="pm-detail-category-name"
          style={{ color: themeColor }}
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
            color={themeColor}
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
          <span className="pm-detail-duration-label">
            {formatDurationLabel(selectedWindow)}
          </span>
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
            const sessionBuffer = multiSessionStore.getSessionWindowBuffer(
              session.sessionId,
              selectedCategory,
              selectedWindow,
            );
            const samples = sessionBuffer?.samples ?? [];

            return (
              <div
                key={session.sessionId}
                className={`pm-detail-session-chart${!showAggregate ? " pm-detail-session-chart-primary" : ""}`}
              >
                <PMChart
                  title={`${category.label} - ${formatSessionLabel(session)}`}
                  samples={samples}
                  field="tokenRate"
                  color={themeColor}
                  mode="mini"
                  yMax={category.yMax}
                  yLabels={category.yLabels}
                  label={formatSessionLabel(session)}
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

      {/* Stats grid */}
      <PMStatsGrid
        statsConfig={category.statsConfig}
        metricsData={metricsData}
        categoryId={selectedCategory}
      />

      {/* Session table */}
      <PMSessionTable
        columns={category.sessionColumns}
        rows={sessionRows}
        categoryId={selectedCategory}
      />
    </div>
  );
};
