/**
 * PhosphorCanvasHost — STUB (placeholder for Step 09-02).
 *
 * Step 09-01 builds the outer view shell, controls, legend, and hover
 * tooltip components. The real canvas host (rAF loop, persistence buffer,
 * ResizeObserver, DPR handling, pointer events) lands in Step 09-02.
 *
 * This stub renders a simple div whose data attributes surface the subset
 * of the Frame the ScopeView wiring needs to be observable during 09-01
 * unit tests. Step 09-02 replaces the body of this component with the
 * canvas + offscreen persistence buffer + pointer handling described in
 * v2-phosphor-architecture.md §5 Q3; the prop contract (Frame + hover
 * setter) is kept stable so Step 09-01's composition remains intact.
 */

import type { Frame } from "../../domain/phosphor/scopeProjection";
import type { HoverSelection } from "../../domain/phosphor/scopeHitTest";

interface PhosphorCanvasHostProps {
  readonly frame: Frame;
  readonly onHoverChange: (selection: HoverSelection | null) => void;
}

export const PhosphorCanvasHost = ({
  frame,
  onHoverChange: _onHoverChange,
}: PhosphorCanvasHostProps) => (
  <div
    className="phosphor-canvas-host"
    data-testid="phosphor-canvas-host"
    data-metric={frame.metric}
    data-y-max={frame.yMax}
    data-unit={frame.unit}
    data-trace-count={frame.traces.length}
    data-pulse-count={frame.pulses.length}
  />
);
