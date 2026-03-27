# Test Scenarios: Session Time Filter

## Test File

`tests/acceptance/session-time-filter/session-filter.test.ts`

## Scenario Map

| AC | Scenario | Description |
|----|----------|-------------|
| AC-6 | Walking skeleton | `filterSessions` is pure, returns filtered array |
| AC-1 | Active Now includes active only | 3 active among 10 sessions → 3 returned |
| AC-1 | Active Now empty | No active sessions → empty array |
| AC-2 | Last 15 min recency | 5m and 10m included, 30m and 2h excluded |
| AC-2 | Last 15 min boundary span | Started 2h ago, last event 10m ago → included |
| AC-2 | Last 15 min with active | Active sessions always included |
| AC-2 | Last hour recency | 5m and 30m included, 2h and 25h excluded |
| AC-2 | Last 24 hrs recency | 1h, 12h, 23h included, 48h excluded |
| AC-3 | Count from length | 20 sessions, 4 in last hour → length 4 |
| AC-3 | All filter count | 15 sessions → length 15 |
| AC-4 | Empty result | No matches → empty array |
| AC-5 | Default all | All sessions returned with 'all' filter |
| Edge | Null last_event_at | Session with no events excluded from time windows |
| Edge | Empty input | Empty array in, empty array out for all filters |
| Config | Preset completeness | 5 presets with unique IDs and non-empty labels |

## Driving Port

`filterSessions(sessions, filterId, now)` from `src/domain/sessionFilter.ts`

All tests are pure domain tests — no DOM, no React, no mocks. The `now` parameter makes every test deterministic.
