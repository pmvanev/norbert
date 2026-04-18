/**
 * PhosphorControls — metric segmented control.
 *
 * Renders one button per supported MetricId (events | tokens | toolcalls).
 * The active button is marked via `aria-pressed="true"`; clicking a
 * non-active button calls `onMetricChange(metric)`. No internal state —
 * the selected metric is owned by the parent (`PhosphorScopeView`) so the
 * whole view tree re-renders consistently on change.
 *
 * The button set is generated from `METRIC_IDS` so adding a new metric is
 * purely a data-layer change (add to the METRICS config + ordered list).
 */

import {
  METRIC_IDS,
  METRICS,
  type MetricId,
} from "../../domain/phosphor/phosphorMetricConfig";

interface PhosphorControlsProps {
  readonly selectedMetric: MetricId;
  readonly onMetricChange: (metric: MetricId) => void;
}

/** One segmented-control button for a single metric. */
const MetricButton = ({
  metric,
  isActive,
  onSelect,
}: {
  readonly metric: MetricId;
  readonly isActive: boolean;
  readonly onSelect: (metric: MetricId) => void;
}) => {
  const config = METRICS[metric];
  return (
    <button
      type="button"
      className={
        isActive
          ? "phosphor-controls-btn phosphor-controls-btn-active"
          : "phosphor-controls-btn"
      }
      aria-pressed={isActive}
      onClick={() => onSelect(metric)}
    >
      {config.name}
    </button>
  );
};

export const PhosphorControls = ({
  selectedMetric,
  onMetricChange,
}: PhosphorControlsProps) => (
  <div
    className="phosphor-controls"
    role="group"
    aria-label="Scope metric"
    data-testid="phosphor-controls"
  >
    {METRIC_IDS.map((metric) => (
      <MetricButton
        key={metric}
        metric={metric}
        isActive={metric === selectedMetric}
        onSelect={onMetricChange}
      />
    ))}
  </div>
);
