# ADR-028: Performance Monitor View Architecture -- Internal Navigation

## Status

Accepted

## Context

The Performance Monitor has two view modes: an aggregate overview (multi-metric grid with per-session breakdown) and a session detail view (session-scoped metrics with agent breakdown). The user navigates between these via drill-down (click session) and back (return to aggregate).

**Quality attribute drivers**: Maintainability (clean view boundaries), user experience (state preservation across navigation), performance (view transitions must be instant).

**Constraints**: PM is a single registered view within the norbert-usage plugin. Plugin views cannot register sub-routes. Navigation must be internal to the PM component.

## Decision

Single registered view with internal navigation state managed by discriminated union.

**Mechanism**:
1. `PerformanceMonitorView.tsx` is the container component registered via `api.ui.registerView()`
2. View mode is a discriminated union: `{ tag: 'aggregate' } | { tag: 'session-detail', sessionId: string }`
3. Container renders either `PMAggregatGrid` or `PMSessionDetail` based on mode
4. Time window selection (`TimeWindowId`) is managed by the container, shared across both modes
5. On drill-down: container sets mode to `{ tag: 'session-detail', sessionId }`, preserves time window
6. On back: container sets mode to `{ tag: 'aggregate' }`, time window preserved
7. Both sub-views are pure renderers: they receive pre-computed data and emit callbacks (drill-down, back)

**State preservation**: Time window, scroll position, and aggregate data remain in the container's state during drill-down. When returning from detail, aggregate view restores immediately (no re-query, no re-animation).

## Alternatives Considered

### Alternative 1: Separate registered views for aggregate and detail
- What: Register "performance-monitor-aggregate" and "performance-monitor-detail" as two views. Use plugin mode switching for navigation.
- Tradeoff: Clear separation at the plugin host level. But plugin mode switching may re-mount components, losing time window state and scroll position. Two view registrations for what is conceptually one feature clutters the toolbar. No shared state between views without a global store.
- Why rejected: State preservation across navigation is a hard requirement (journey step 3: "Back button restores aggregate view with same state"). Mode switching re-mounts components, destroying local state. Would require lifting all PM state to module-level store, complicating the architecture.

### Alternative 2: URL-based routing within the view
- What: Use a lightweight client-side router (e.g., React Router) within the PM view to manage aggregate/detail paths.
- Tradeoff: Familiar pattern, enables deep linking. But adds a dependency (React Router). Plugin views do not have URL control in Tauri. Router state would need to be synthetic (not actual URL changes).
- Why rejected: Adds unnecessary dependency for two routes. Discriminated union + conditional rendering achieves the same result with zero dependencies. Deep linking is not a requirement for an internal monitoring view.

### Alternative 3: Tab-based layout showing both views simultaneously
- What: Split the PM into two tabs or panels: aggregate always visible on top, detail visible below when a session is selected.
- Tradeoff: No navigation needed. But doubles the vertical space requirement. With 4 aggregate charts + per-session breakdown + session detail charts, the view becomes scroll-heavy and information-overloaded. Contradicts the "progressive disclosure" design principle.
- Why rejected: Information overload. The journey analysis (step 3) explicitly models drill-down as a focused investigation step. Showing both views simultaneously dilutes focus and wastes viewport space for the common case (aggregate monitoring without drill-down).

## Consequences

- Positive: Single view registration. Clean toolbar with one "Performance Monitor" entry.
- Positive: State preservation is trivial (container holds time window, mode, aggregate data in local state).
- Positive: Zero new dependencies. Discriminated union + conditional rendering is idiomatic React + FP.
- Positive: Sub-views are pure renderers. PMAggregatGrid and PMSessionDetail receive data + callbacks, no internal state management.
- Negative: No deep linking to a specific session detail view. Accepted: not a requirement for a local monitoring tool.
- Negative: Container component manages multiple concerns (mode, time window, store subscription). Mitigated: these are all view-level concerns, not domain logic. Container is thin orchestration.
