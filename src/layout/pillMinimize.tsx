/**
 * Pill Minimize — pure functions and React component for minimized panel pills.
 *
 * A pill shows the view label and optionally a live floatMetric value.
 * Pure function: formatPillLabel computes the display text.
 * React component: PillMinimize renders the pill UI.
 */

import React from "react";

// ---------------------------------------------------------------------------
// Pure function: compute pill display label
// ---------------------------------------------------------------------------

/**
 * Formats the pill label from view name and optional metric value.
 * Returns "ViewName  MetricValue" when metric is present,
 * or just "ViewName" when no metric is declared.
 */
export const formatPillLabel = (
  viewName: string,
  metricValue: string | null
): string =>
  metricValue !== null ? `${viewName}  ${metricValue}` : viewName;

// ---------------------------------------------------------------------------
// React component: PillMinimize
// ---------------------------------------------------------------------------

export type PillMinimizeProps = {
  readonly viewName: string;
  readonly metricValue: string | null;
  readonly onRestore: () => void;
};

/**
 * Renders a minimized floating panel as a clickable pill.
 * Shows the view name and optionally a live metric value.
 * Clicking the pill triggers the onRestore callback.
 */
export const PillMinimize: React.FC<PillMinimizeProps> = ({
  viewName,
  metricValue,
  onRestore,
}) => (
  <button
    className="pill-minimize"
    onClick={onRestore}
    title={`Restore ${viewName}`}
  >
    <span className="pill-minimize__label">
      {formatPillLabel(viewName, metricValue)}
    </span>
  </button>
);
