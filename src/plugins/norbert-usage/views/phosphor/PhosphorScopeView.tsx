/**
 * PhosphorScopeView — React shell for the Performance Monitor v2 scope.
 *
 * Composes the phosphor view tree: PhosphorControls (per-metric toggles) +
 * one PhosphorCanvasHost per enabled metric (stacked, each owning its own
 * rAF render loop) + a single PhosphorHoverTooltip overlay + PhosphorLegend
 * (per-session color / name / latest value).
 *
 * State owned here:
 *   - `enabledMetrics` — initialized to every metric in `METRIC_IDS` so the
 *     user sees the full signal set on first launch and can toggle any one
 *     off. When multiple are enabled, the canvases stack and divide the
 *     available vertical space via flex; with only one enabled, it fills
 *     the whole graph area. At least one metric must remain enabled (the
 *     controls enforce this by disabling the last active button, and this
 *     handler rejects the no-op).
 *   - `hoverSelection` — the selection from whichever canvas last reported
 *     hover, paired with the metric that canvas is displaying so the
 *     tooltip shows the correct unit.
 *   - `hiddenSessions` — per-session visibility toggled from the legend.
 *   - `tick` — a render-bumping counter the store's `subscribe` callback
 *     increments. Bumps the legend / tooltip unit text when data arrives.
 *     Each canvas host computes its own rAF frame on every tick so traces
 *     scroll smoothly at 60fps regardless of notification cadence; the
 *     tick only refreshes the DOM-side legend.
 *
 * Effects confined to the store subscription; all derivation (frame
 * projection, hit-testing) lives in `domain/phosphor/` pure modules.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MultiSessionStore } from "../../adapters/multiSessionStore";
import {
  METRIC_IDS,
  METRICS,
  type MetricId,
} from "../../domain/phosphor/phosphorMetricConfig";
import { buildFrame } from "../../domain/phosphor/scopeProjection";
import type { HoverSelection } from "../../domain/phosphor/scopeHitTest";
import { PhosphorControls } from "./PhosphorControls";
import { PhosphorCanvasHost } from "./PhosphorCanvasHost";
import { PhosphorHoverTooltip } from "./PhosphorHoverTooltip";
import { PhosphorLegend } from "./PhosphorLegend";

const PHOSPHOR_SESSION_PALETTE_SIZE = 5;
const PHOSPHOR_SESSION_COLOR_PROP_PREFIX = "--phosphor-session-";

const resolveScopeSessionColors = (
  container: HTMLElement | null,
): ReadonlyArray<string> => {
  if (container === null || typeof window === "undefined") return [];
  const styles = window.getComputedStyle(container);
  const resolved: string[] = [];
  for (let i = 0; i < PHOSPHOR_SESSION_PALETTE_SIZE; i++) {
    const raw = styles
      .getPropertyValue(`${PHOSPHOR_SESSION_COLOR_PROP_PREFIX}${i}`)
      .trim();
    if (raw !== "") resolved.push(raw);
  }
  return resolved;
};

interface HoverState {
  readonly metric: MetricId;
  readonly selection: HoverSelection;
}

interface PhosphorScopeViewProps {
  readonly store: MultiSessionStore;
}

export const PhosphorScopeView = ({ store }: PhosphorScopeViewProps) => {
  const [enabledMetrics, setEnabledMetrics] = useState<ReadonlySet<MetricId>>(
    () => new Set<MetricId>(METRIC_IDS),
  );
  const [hoverSelection, setHoverSelection] = useState<HoverState | null>(null);
  const [hiddenSessions, setHiddenSessions] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const [, setTick] = useState<number>(0);
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((previous) => previous + 1);
    });
    return unsubscribe;
  }, [store]);

  // Toggle a metric on or off. Clears hover because the prior selection is
  // scoped to a specific metric's Y-axis; if that metric is being turned off
  // (or the active hover straddles a now-repositioned canvas), the selection
  // would be stale. The controls disable the last-remaining metric's button,
  // but this guard defends the invariant if called directly.
  const handleMetricToggle = useCallback((metric: MetricId): void => {
    setEnabledMetrics((previous) => {
      const next = new Set(previous);
      if (next.has(metric)) {
        if (next.size === 1) return previous;
        next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
    setHoverSelection(null);
  }, []);

  const handleToggleSession = useCallback((sessionId: string): void => {
    setHiddenSessions((previous) => {
      const next = new Set(previous);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  // Render-ordered list of currently enabled metrics. Using METRIC_IDS as the
  // canonical order keeps the stack stable when the user toggles metrics —
  // enabling tokens never reorders events above toolcalls.
  const orderedEnabledMetrics = METRIC_IDS.filter((metric) =>
    enabledMetrics.has(metric),
  );

  // The legend is a single DOM element for the whole scope; its per-session
  // "latest value" column targets the FIRST enabled metric (canonical order).
  // That keeps the legend legible when multiple metrics stack, without
  // duplicating N value columns per session. The session toggle itself is
  // metric-agnostic — hiding a session hides it on every active canvas.
  // `enabledMetrics` is guaranteed non-empty by `handleMetricToggle`, so the
  // first enabled metric is always defined; the fallback to METRIC_IDS[0]
  // satisfies the type checker for the empty-array edge case only.
  const legendMetric = orderedEnabledMetrics[0] ?? METRIC_IDS[0];
  const legendSessionColors = resolveScopeSessionColors(scopeRef.current);
  const legendFrame = buildFrame(store, legendMetric, Date.now(), {
    hiddenSessions,
    sessionColors: legendSessionColors,
  });

  // Tooltip only surfaces if the hover's metric is still enabled — a race
  // where the user toggles a metric off while hovering should hide the
  // tooltip rather than leaving it pinned to a vanished canvas.
  const tooltipSelection =
    hoverSelection !== null && enabledMetrics.has(hoverSelection.metric)
      ? hoverSelection.selection
      : null;
  const tooltipUnit =
    hoverSelection !== null && enabledMetrics.has(hoverSelection.metric)
      ? METRICS[hoverSelection.metric].unit
      : legendFrame.unit;

  return (
    <div ref={scopeRef} className="phosphor-scope" data-testid="phosphor-scope">
      <div className="sec-hdr">
        <span className="sec-t">Performance Monitor</span>
        <span className="sec-a">60s · phosphor scope</span>
      </div>
      <PhosphorControls
        enabledMetrics={enabledMetrics}
        onMetricToggle={handleMetricToggle}
      />
      <div className="phosphor-scope-canvases" data-testid="phosphor-scope-canvases">
        {orderedEnabledMetrics.map((metric) => (
          <div
            className="phosphor-scope-canvas-wrap"
            key={metric}
            data-metric-wrap={metric}
          >
            <span className="phosphor-scope-metric-label">
              {METRICS[metric].name}
            </span>
            <PhosphorCanvasHost
              store={store}
              selectedMetric={metric}
              onHoverChange={(selection) =>
                setHoverSelection(
                  selection === null ? null : { metric, selection },
                )
              }
              hiddenSessions={hiddenSessions}
            />
          </div>
        ))}
        <PhosphorHoverTooltip selection={tooltipSelection} unit={tooltipUnit} />
      </div>
      <PhosphorLegend
        legend={legendFrame.legend}
        unit={legendFrame.unit}
        onToggle={handleToggleSession}
      />
    </div>
  );
};
