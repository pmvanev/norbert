/**
 * PhosphorLegend — read-only legend view.
 *
 * Consumes `frame.legend` as an immutable prop and renders one row per
 * session: a color swatch, the session id, and the session's latest value
 * formatted with the metric's unit. When `latestValue` is null (the session
 * has no arrived samples in the window) an em-dash placeholder is shown so
 * the row still communicates the session's presence.
 *
 * This component is a pure rendering function — no effects, no subscriptions,
 * no state. The caller owns the legend array and the metric's unit string.
 */

import type { LegendEntry } from "../../domain/phosphor/scopeProjection";

interface PhosphorLegendProps {
  readonly legend: ReadonlyArray<LegendEntry>;
  readonly unit: string;
}

/** Format a latest value (or null) for display alongside the unit. */
const formatLatestValue = (value: number | null, unit: string): string => {
  if (value === null) return "—";
  // Two-decimal precision for non-integer values, tidy integers unadorned.
  const rendered = Number.isInteger(value) ? `${value}` : value.toFixed(2);
  return `${rendered} ${unit}`;
};

/** Single legend row — colored swatch + session id + formatted value. */
const PhosphorLegendRow = ({
  entry,
  unit,
}: {
  readonly entry: LegendEntry;
  readonly unit: string;
}) => (
  <div
    className="phosphor-legend-row"
    data-testid={`phosphor-legend-row-${entry.sessionId}`}
  >
    <span
      className="phosphor-legend-swatch"
      data-testid={`phosphor-legend-swatch-${entry.sessionId}`}
      style={{ backgroundColor: entry.color }}
    />
    <span className="phosphor-legend-session">{entry.sessionId}</span>
    <span className="phosphor-legend-value" data-mono="">
      {formatLatestValue(entry.latestValue, unit)}
    </span>
  </div>
);

export const PhosphorLegend = ({ legend, unit }: PhosphorLegendProps) => (
  <div className="phosphor-legend" data-testid="phosphor-legend">
    {legend.map((entry) => (
      <PhosphorLegendRow key={entry.sessionId} entry={entry} unit={unit} />
    ))}
  </div>
);
