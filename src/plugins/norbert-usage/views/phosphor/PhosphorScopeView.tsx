/**
 * PhosphorScopeView — React shell for the Performance Monitor v2 scope.
 *
 * Composes the phosphor view tree: PhosphorControls (metric toggle) +
 * PhosphorCanvasHost (stubbed in Step 09-01, real canvas in 09-02) +
 * PhosphorHoverTooltip (positioned overlay) + PhosphorLegend (per-session
 * color / name / latest value).
 *
 * State owned here:
 *   - `selectedMetric` — initialized from `DEFAULT_METRIC`. Updated by the
 *     controls' `onMetricChange` callback. Changing the metric also clears
 *     the hover selection (the old selection's value lives on the prior
 *     metric's scale and would be misleading).
 *   - `hoverSelection` — the pure hit-test result surfaced by the canvas
 *     host's pointer handler, rendered by the tooltip.
 *   - `tick` — a render-bumping counter the store's `subscribe` callback
 *     increments; each bump causes `buildFrame` to re-run with fresh
 *     store state. The frame itself is recomputed on every render (pure,
 *     cheap) so this component stays effect-free apart from the
 *     subscription effect.
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
  // the component re-renders and `buildFrame` runs against fresh state.
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

  // Recompute the frame on every render. `buildFrame` is pure and O(sessions
  // × samples-per-trace), so this is cheap; deterministic in store snapshot
  // + metric + now.
  const frame = buildFrame(store, selectedMetric, Date.now());

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
        <PhosphorCanvasHost frame={frame} onHoverChange={setHoverSelection} />
        <PhosphorHoverTooltip selection={hoverSelection} unit={frame.unit} />
      </div>
      <PhosphorLegend legend={frame.legend} unit={frame.unit} />
    </div>
  );
};
