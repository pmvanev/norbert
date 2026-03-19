# ADR-010: Canvas Hover Tooltip Architecture

## Status
Accepted

## Context
The v2 design spec requires hover tooltips on all chart canvases (aggregate and per-session mini-graphs). When hovering, a vertical crosshair line and dot appear on the canvas, and a floating tooltip shows the value and time offset. This requires:
1. Mouse position tracking per canvas
2. Hit-testing (mouseX -> nearest sample index + value)
3. Crosshair rendering on the hovered canvas
4. Tooltip rendering as a floating element positioned near the cursor

The question is where to place the hit-testing logic and how to coordinate hover state across the component tree.

## Decision
Split hover into three layers following the pure-core/effect-shell pattern:

1. **Domain (pure)**: Hit-test function in `chartRenderer.ts`. Input: mouseX, canvas width, buffer length. Output: sample index, interpolated value, time offset. Pure computation, unit-testable.

2. **View coordination**: PMContainerView holds `hoverState` in React state. PMChart components emit hover data via callbacks (`onHover`, `onHoverEnd`). PMContainerView passes hover state down to both the hovered PMChart (for crosshair rendering) and PMTooltip (for floating tooltip).

3. **Canvas rendering**: Crosshair (vertical line + dot) is drawn by the chart renderer as part of the normal render pass, conditional on hover state matching this canvas. No separate overlay canvas.

The tooltip is a React DOM element (not canvas-rendered) because it needs to escape canvas bounds and handle edge flipping.

## Alternatives Considered

### Alternative 1: Tooltip rendered on canvas (fully canvas-based)
- Draw tooltip box and text directly on the canvas
- **Rejected**: Canvas text rendering lacks the typography quality of DOM text. Tooltip needs to potentially overflow canvas bounds (flip near edges). DOM positioning is simpler and more accessible.

### Alternative 2: Hit-testing in the view layer (useCallback in PMChart)
- Compute nearest sample index inside the React component's mouse handler
- **Rejected**: Couples computation to the component lifecycle. Hit-testing is a pure function of (mouseX, canvasWidth, bufferLength) and should be testable without React.

## Consequences
- **Positive**: Hit-test logic is pure and unit-testable
- **Positive**: Tooltip is a DOM element with proper typography and edge handling
- **Positive**: Single hover state in container prevents multiple tooltips
- **Negative**: Hover state changes trigger re-render of the entire PM container (mitigated by React.memo on non-hovered children)
- **Negative**: Crosshair requires a re-render of the hovered canvas on every mousemove (already at 10Hz render rate, so negligible additional cost)
