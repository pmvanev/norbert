/**
 * PhosphorControls — per-metric toggle control.
 *
 * Renders one button per supported MetricId (events | tokens | toolcalls).
 * Each button reflects whether its metric is currently enabled via
 * `aria-pressed`; clicking a button calls `onMetricToggle(metric)`. The
 * parent owns `enabledMetrics` so the whole view tree stays consistent.
 *
 * At least one metric must remain enabled: when only one metric is active,
 * that button is disabled so the user cannot turn every graph off.
 */

import {
  METRIC_IDS,
  METRICS,
  type MetricId,
} from "../../domain/phosphor/phosphorMetricConfig";

interface PhosphorControlsProps {
  readonly enabledMetrics: ReadonlySet<MetricId>;
  readonly onMetricToggle: (metric: MetricId) => void;
}

const MetricButton = ({
  metric,
  isEnabled,
  isDisabled,
  onSelect,
}: {
  readonly metric: MetricId;
  readonly isEnabled: boolean;
  readonly isDisabled: boolean;
  readonly onSelect: (metric: MetricId) => void;
}) => {
  const config = METRICS[metric];
  return (
    <button
      type="button"
      className={
        isEnabled
          ? "phosphor-controls-btn phosphor-controls-btn-active"
          : "phosphor-controls-btn"
      }
      aria-pressed={isEnabled}
      disabled={isDisabled}
      onClick={() => onSelect(metric)}
    >
      {config.name}
    </button>
  );
};

export const PhosphorControls = ({
  enabledMetrics,
  onMetricToggle,
}: PhosphorControlsProps) => (
  <div
    className="phosphor-controls"
    role="group"
    aria-label="Scope metrics"
    data-testid="phosphor-controls"
  >
    {METRIC_IDS.map((metric) => {
      const isEnabled = enabledMetrics.has(metric);
      // The sole remaining enabled metric can't be toggled off — at least
      // one graph must stay on screen.
      const isDisabled = isEnabled && enabledMetrics.size === 1;
      return (
        <MetricButton
          key={metric}
          metric={metric}
          isEnabled={isEnabled}
          isDisabled={isDisabled}
          onSelect={onMetricToggle}
        />
      );
    })}
  </div>
);
