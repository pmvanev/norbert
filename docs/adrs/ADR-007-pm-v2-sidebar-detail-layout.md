# ADR-007: Performance Monitor v2 Sidebar-Detail Layout

## Status
Accepted

## Context
The v1 Performance Monitor crammed all metrics (tokens/s, cost, agents, context) into a single view with one shared chart and flat stat rows. Users could not focus on a single metric category or compare per-session values for that category. The design spec calls for a Task Manager-style sidebar+detail layout where each category gets its own dedicated graph with appropriate Y-axis units.

The key design constraint is that users need at-a-glance visibility of ALL categories (via sidebar sparklines) while being able to drill into ONE category at a time (via the detail pane).

## Decision
Replace the v1 flat layout with a **master-detail dual-pane layout**:
- **Left sidebar** (fixed 180px): Clickable category rows, each with label + current value + mini sparkline canvas
- **Right detail pane** (flex): Category-scoped content -- aggregate graph, per-session graph grid, stats grid, session table

Category selection is view-local state. Selecting a category swaps the detail pane content; the sidebar remains visible with all sparklines updating.

## Alternatives Considered

### Alternative 1: Tabbed interface (tabs at top, no sidebar)
- Tabs for each category, full-width detail below
- **Rejected**: No simultaneous visibility of all categories. User must remember state of non-selected categories. Task Manager reference specifically chose sidebar for always-visible overview.

### Alternative 2: 2x2 grid (v1 approach improved)
- Keep the grid layout but give each cell its own proper Y-axis
- **Rejected**: Cannot fit per-session graph grid + stats + session table within a grid cell. The detail pane needs vertical scroll space. Also no sparkline overview.

## Consequences
- **Positive**: Users see all 4 categories at a glance via sparklines while focusing on one category's detail
- **Positive**: Each category gets proper Y-axis scaling (no mixed units)
- **Positive**: Per-session graph grid has sufficient space in the detail pane
- **Negative**: Sidebar consumes 180px of horizontal space, reducing detail pane width
- **Negative**: View layer is a complete replacement of v1 (no incremental migration)
