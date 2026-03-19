/**
 * PMStatsGrid: 2-column, 3-row grid of category-specific statistics.
 *
 * Content is driven by the category's statsConfig array (6 cells).
 * Each cell shows a label and a formatted value looked up from the
 * provided metrics data record.
 *
 * Pure presentational component -- receives pre-computed data.
 */

import type { StatCellConfig } from "../domain/categoryConfig";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMStatsGridProps {
  readonly statsConfig: ReadonlyArray<StatCellConfig>;
  readonly metricsData: Readonly<Record<string, number | string>>;
  readonly categoryId: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Look up a metric value by key from the data record,
 * returning "--" when no data is available.
 */
const resolveStatValue = (
  key: string,
  metricsData: Readonly<Record<string, number | string>>,
  format: (value: number | string) => string,
): string => {
  const raw = metricsData[key];
  if (raw === undefined || raw === null) {
    return "--";
  }
  return format(raw);
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMStatsGrid = ({
  statsConfig,
  metricsData,
  categoryId,
}: PMStatsGridProps) => (
  <div className="pm-detail-stats-grid" data-category={categoryId}>
    {statsConfig.map((stat) => (
      <div key={stat.key} className="pm-detail-stat-cell">
        <span className="pm-detail-stat-label">{stat.label}</span>
        <span className="pm-detail-stat-value" data-mono="true">
          {resolveStatValue(stat.key, metricsData, stat.format)}
        </span>
      </div>
    ))}
  </div>
);
