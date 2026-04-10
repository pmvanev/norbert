# Test Scenarios: Session Metrics Table

## Test Files

| File | Milestone | Scenarios |
|------|-----------|-----------|
| `tests/acceptance/session-metrics-table/steps/walking-skeleton.test.ts` | Walking Skeletons | 3 |
| `tests/acceptance/session-metrics-table/steps/sorting.test.ts` | M1 — Sorting | 9 |
| `tests/acceptance/session-metrics-table/steps/heat-coloring.test.ts` | M2 — Heat Coloring | 8 |
| `tests/acceptance/session-metrics-table/steps/grouping.test.ts` | M3 — Grouping | 7 |
| `tests/acceptance/session-metrics-table/steps/status-bar.test.ts` | M4 — Status Bar | 5 |
| `tests/acceptance/session-metrics-table/steps/optional-columns.test.ts` | M5 — Optional Columns | 9 |
| `tests/acceptance/session-metrics-table/steps/keyboard-navigation.test.ts` | M6 — Keyboard Navigation | 6 |

**Total: 47 scenarios** (3 walking skeletons + 44 focused scenarios)

## Scenario Map

### Walking Skeletons (WS)

| ID | Scenario | Status |
|----|----------|--------|
| WS-1 | Table rows show status indicator and project name | enabled |
| WS-2 | Cost and token columns display formatted values | skip |
| WS-3 | Clicking a row returns session ID for detail panel | skip |

### Milestone 1 — Sorting

| AC | Scenario | Type |
|----|----------|------|
| Sort-1 | Default sort: active first, then most recent | happy |
| Sort-2 | Sort by cost ascending | happy |
| Sort-3 | Sort by cost descending (toggle) | happy |
| Sort-4 | Sort by token count | happy |
| Sort-5 | Sort by burn rate descending | happy |
| Sort-6 | Sort by context utilization | happy |
| Sort-7 | Sort by duration | happy |
| Sort-8 | Sort persists across data updates | edge |
| Sort-9 | Missing metrics sort as zero | error |

### Milestone 2 — Heat Coloring

| AC | Scenario | Type |
|----|----------|------|
| Heat-1 | Cost cell shading (red/amber/neutral) | happy |
| Heat-2 | Context utilization shading | happy |
| Heat-3 | Burn rate shading | happy |
| Heat-4 | Token count shading | happy |
| Heat-5 | API health shading (low success = red) | happy |
| Heat-6 | Heat adjusts on real-time update | edge |
| Heat-7 | Zero/missing values produce neutral | error |
| Heat-8 | Monotonicity: higher value >= higher heat | property |

### Milestone 3 — Grouping

| AC | Scenario | Type |
|----|----------|------|
| Group-1 | Active and Recent groups populated correctly | happy |
| Group-2 | Active group header shows count | happy |
| Group-3 | Collapse/expand toggle | happy |
| Group-4 | Stale session moves to Recent group | edge |
| Group-5 | All completed: empty Active group | error |
| Group-6 | Active-only filter: empty Recent group | error |
| (shared) | Grouping uses isSessionActive with staleness | boundary |

### Milestone 4 — Status Bar

| AC | Scenario | Type |
|----|----------|------|
| Bar-1 | Aggregates: count, cost, tokens | happy |
| Bar-2 | Aggregates recompute on filter change | happy |
| Bar-3 | Aggregates update on cost change | edge |
| Bar-4 | Empty visible rows produce zeros | error |
| Bar-5 | Total cost = sum of session costs | property |

### Milestone 5 — Optional Columns

| AC | Scenario | Type |
|----|----------|------|
| Opt-1 | 7 optional columns available | happy |
| Opt-2 | Enable Claude Code Version column | happy |
| Opt-3 | Enable Platform column | happy |
| Opt-4 | Enable Input/Output token split | happy |
| Opt-5 | Cache Hit % computed correctly | happy |
| Opt-6 | Enable Active Agents column | happy |
| Opt-7 | Disable previously enabled column | happy |
| Opt-8 | Null metadata produces dash placeholder | error |
| Opt-9 | Zero total tokens: cache hit = 0% | error |

### Milestone 6 — Keyboard Navigation

| AC | Scenario | Type |
|----|----------|------|
| Key-1 | Arrow down increments focus | happy |
| Key-2 | Arrow up decrements focus | happy |
| Key-3 | Enter selects focused row | happy |
| Key-4 | Down at last row clamps | error |
| Key-5 | Up at first row clamps | error |
| Key-6 | Zero rows: no-op | error |

## Error Path Ratio

- Happy path: 25 scenarios (53%)
- Error/edge: 19 scenarios (40%)
- Property: 3 scenarios (7%)

Error+edge ratio: **47%** (exceeds 40% target)

## Driving Ports

| Port | Source | Used By |
|------|--------|---------|
| `buildTableRows` | New: session-metrics-table domain | WS, Sorting, Grouping |
| `sortTableRows` | New: session-metrics-table domain | Sorting |
| `computeHeatLevel` | New: session-metrics-table domain | Heat Coloring |
| `groupSessionRows` | New: session-metrics-table domain | Grouping |
| `computeStatusBarData` | New: session-metrics-table domain | Status Bar |
| `toggleColumn` | New: session-metrics-table domain | Optional Columns |
| `moveFocus` | New: session-metrics-table domain | Keyboard Navigation |
| `isSessionActive` | src/domain/status.ts | WS, Grouping |
| `deriveSessionName` | src/domain/sessionPresentation.ts | WS |
| `filterSessions` | src/domain/sessionFilter.ts | Grouping, Status Bar |
| `formatClaudeVersion` | src/domain/sessionPresentation.ts | Optional Columns |
| `formatPlatform` | src/domain/sessionPresentation.ts | Optional Columns |

All tests invoke through driving ports (pure domain functions). No DOM, no React, no mocks at acceptance level.

## Implementation Sequence

1. **WS-1** (enabled) — build table rows with status + name
2. WS-2 — cost and token formatting
3. WS-3 — row selection returns session ID
4. Sorting scenarios (M1)
5. Heat coloring scenarios (M2)
6. Grouping scenarios (M3)
7. Status bar scenarios (M4)
8. Optional columns scenarios (M5)
9. Keyboard navigation scenarios (M6)

Enable one scenario at a time. Each enabled scenario becomes the failing outer-loop test that drives the inner TDD loop.
