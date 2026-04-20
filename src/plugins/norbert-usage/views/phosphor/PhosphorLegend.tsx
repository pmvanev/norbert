/**
 * PhosphorLegend — interactive legend view.
 *
 * Consumes `frame.legend` as an immutable prop and renders one row per
 * session: a color swatch, the session display label, and the session's
 * latest value formatted with the metric's unit. When `latestValue` is null
 * (the session has no arrived samples in the window) an em-dash placeholder
 * is shown so the row still communicates the session's presence.
 *
 * Rows are `<button>` elements so clicking (and keyboard Enter/Space via
 * native semantics) toggles the session's trace visibility. `aria-pressed`
 * mirrors visibility — pressed=true means the trace is visible, pressed=false
 * means the user has hidden it. Hidden rows stay in the DOM so the user can
 * un-hide them; they carry the `phosphor-legend-row-hidden` class so CSS can
 * deemphasize them (reduced opacity, hollow swatch).
 *
 * This component remains side-effect free: no subscriptions, no internal
 * state. The caller owns the legend array, the metric's unit string, and
 * the `onToggle` callback (the composition root in `PhosphorScopeView`
 * holds the `hiddenSessions` set).
 */

import type { LegendEntry } from "../../domain/phosphor/scopeProjection";

interface PhosphorLegendProps {
  readonly legend: ReadonlyArray<LegendEntry>;
  readonly unit: string;
  readonly onToggle: (sessionId: string) => void;
}

/** Format a latest value (or null) for display alongside the unit. */
const formatLatestValue = (value: number | null, unit: string): string => {
  if (value === null) return "—";
  // Two-decimal precision for non-integer values, tidy integers unadorned.
  const rendered = Number.isInteger(value) ? `${value}` : value.toFixed(2);
  return `${rendered} ${unit}`;
};

/**
 * CSS class names for a legend row. Always includes the base class; adds the
 * `-hidden` variant when the entry's session is hidden from the canvas so
 * styles can deemphasize it (opacity, hollow swatch).
 */
const legendRowClassName = (hidden: boolean): string =>
  hidden ? "phosphor-legend-row phosphor-legend-row-hidden" : "phosphor-legend-row";

/**
 * CSS class names for a legend swatch. Hidden entries get the `-hidden`
 * variant so the swatch can render as a hollow outline (the inline
 * `backgroundColor` is overridden to `transparent` and `border` uses the
 * session color — see `design-system.css`).
 */
const legendSwatchClassName = (hidden: boolean): string =>
  hidden ? "phosphor-legend-swatch phosphor-legend-swatch-hidden" : "phosphor-legend-swatch";

/** Single legend row — clickable button containing swatch, label, value. */
const PhosphorLegendRow = ({
  entry,
  unit,
  onToggle,
}: {
  readonly entry: LegendEntry;
  readonly unit: string;
  readonly onToggle: (sessionId: string) => void;
}) => (
  <button
    type="button"
    className={legendRowClassName(entry.hidden)}
    data-testid={`phosphor-legend-row-${entry.sessionId}`}
    aria-pressed={!entry.hidden}
    onClick={() => onToggle(entry.sessionId)}
  >
    <span
      className={legendSwatchClassName(entry.hidden)}
      data-testid={`phosphor-legend-swatch-${entry.sessionId}`}
      style={
        entry.hidden
          ? { borderColor: entry.color }
          : { backgroundColor: entry.color }
      }
    />
    <span
      className="phosphor-legend-session"
      title={entry.sessionId}
    >
      {entry.displayLabel}
    </span>
    <span className="phosphor-legend-value" data-mono="">
      {formatLatestValue(entry.latestValue, unit)}
    </span>
  </button>
);

export const PhosphorLegend = ({ legend, unit, onToggle }: PhosphorLegendProps) => (
  <div className="phosphor-legend" data-testid="phosphor-legend">
    {legend.map((entry) => (
      <PhosphorLegendRow
        key={entry.sessionId}
        entry={entry}
        unit={unit}
        onToggle={onToggle}
      />
    ))}
  </div>
);
