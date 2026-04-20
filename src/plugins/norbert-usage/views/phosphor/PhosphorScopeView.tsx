/**
 * PhosphorScopeView — React shell for the Performance Monitor v2 scope.
 *
 * Composes the phosphor view tree: PhosphorControls (metric toggle) +
 * PhosphorCanvasHost (owns the rAF render loop) + PhosphorHoverTooltip
 * (positioned overlay) + PhosphorLegend (per-session color / name /
 * latest value).
 *
 * State owned here:
 *   - `selectedMetric` — initialized from `DEFAULT_METRIC`. Updated by the
 *     controls' `onMetricChange` callback. Changing the metric also clears
 *     the hover selection (the old selection's value lives on the prior
 *     metric's scale and would be misleading).
 *   - `hoverSelection` — the pure hit-test result surfaced by the canvas
 *     host's pointer handler, rendered by the tooltip.
 *   - `tick` — a render-bumping counter the store's `subscribe` callback
 *     increments. Bumps the legend / tooltip unit text when data arrives.
 *     The CANVAS animation is no longer gated by this tick — the canvas
 *     host computes its own frame on every rAF tick so traces scroll
 *     smoothly at 60fps regardless of notification cadence. The tick here
 *     only refreshes the DOM-side legend (which shows per-session latest
 *     values that only change when data arrives).
 *
 * Why split the animation from the legend?
 *   Store notifications are bursty (per-event pulses, per-tool-call
 *   pulses, ~5s rate samples, session lifecycle). If the canvas only
 *   redrew on notifications, traces would freeze between bumps then jump.
 *   By letting the canvas host own its own rAF-driven `buildFrame` call,
 *   the 60-second window's right edge tracks real time continuously.
 *   The legend is a DOM element and only changes when data arrives, so
 *   driving it from subscribe is correct and cheap.
 *
 * Effects confined to the store subscription; all derivation (frame
 * projection, hit-testing) lives in `domain/phosphor/` pure modules.
 */

import { useCallback, useEffect, useState } from "react";
import type { MultiSessionStore } from "../../adapters/multiSessionStore";
import {
  DEFAULT_METRIC,
  type MetricId,
} from "../../domain/phosphor/phosphorMetricConfig";
import { buildFrame } from "../../domain/phosphor/scopeProjection";
import type { HoverSelection } from "../../domain/phosphor/scopeHitTest";
import { PhosphorControls } from "./PhosphorControls";
import { PhosphorCanvasHost } from "./PhosphorCanvasHost";
import { PhosphorHoverTooltip } from "./PhosphorHoverTooltip";
import { PhosphorLegend } from "./PhosphorLegend";

interface PhosphorScopeViewProps {
  readonly store: MultiSessionStore;
}

export const PhosphorScopeView = ({ store }: PhosphorScopeViewProps) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricId>(DEFAULT_METRIC);
  const [hoverSelection, setHoverSelection] = useState<HoverSelection | null>(null);
  const [, setTick] = useState<number>(0);

  // Subscribe to store notifications — each notification bumps the tick so
  // the component re-renders, which refreshes the LEGEND (per-session latest
  // values). The canvas host runs its own rAF loop and picks up fresh store
  // state on every frame; it does not depend on this tick.
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setTick((previous) => previous + 1);
    });
    return unsubscribe;
  }, [store]);

  // Metric change: update selected metric and clear any stale hover (the
  // prior selection sits on a different Y-scale and would mislead).
  const handleMetricChange = useCallback((metric: MetricId): void => {
    setSelectedMetric(metric);
    setHoverSelection(null);
  }, []);

  // Recompute a lightweight frame on every parent render to power the legend
  // and the tooltip's unit. `buildFrame` is pure and cheap, and this path
  // only fires on subscribe-driven re-renders (legend is a DOM element that
  // only changes when data arrives). The canvas host owns its own rAF-driven
  // frame computation for smooth animation.
  const legendFrame = buildFrame(store, selectedMetric, Date.now());

  return (
    <div className="phosphor-scope" data-testid="phosphor-scope">
      <div className="sec-hdr">
        <span className="sec-t">Performance Monitor</span>
        <span className="sec-a">60s · phosphor scope</span>
      </div>
      <PhosphorControls
        selectedMetric={selectedMetric}
        onMetricChange={handleMetricChange}
      />
      <div className="phosphor-scope-canvas-wrap">
        <PhosphorCanvasHost
          store={store}
          selectedMetric={selectedMetric}
          onHoverChange={setHoverSelection}
        />
        <PhosphorHoverTooltip selection={hoverSelection} unit={legendFrame.unit} />
      </div>
      <PhosphorLegend legend={legendFrame.legend} unit={legendFrame.unit} />
    </div>
  );
};
