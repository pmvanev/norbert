# Walking Skeleton: Test Scenario Inventory

**Feature ID**: walking-skeleton
**Date**: 2026-03-08
**Total Scenarios**: 37
**Error/Edge Scenarios**: 15 (41%)
**Walking Skeletons**: 3
**Property-tagged**: 3

---

## Scenario Summary by Feature File

### walking-skeleton.feature (3 scenarios)

| # | Tag | Scenario | Story | Type |
|---|-----|----------|-------|------|
| 1 | @walking_skeleton | First launch shows Norbert is alive and listening | US-WS-001 | Happy |
| 2 | @walking_skeleton | First session captured and visible in the window | US-WS-003 | Happy |
| 3 | @walking_skeleton | Settings merge preserves existing Claude Code configuration | US-WS-002 | Happy |

### milestone-1-cicd-pipeline.feature (5 scenarios)

| # | Tag | Scenario | Story | Type |
|---|-----|----------|-------|------|
| 4 | @skip | Tagged commit produces a downloadable release | US-WS-000 | Happy |
| 5 | @skip | User installs Norbert with a single command | US-WS-000 | Happy |
| 6 | @skip | Build failure prevents release publication | US-WS-000 | Error |
| 7 | @skip | Install fails gracefully on network error | US-WS-000 | Error |
| 8 | @skip | Pipeline produces binary under size target | US-WS-000 | Boundary |

### milestone-2-app-shell.feature (6 scenarios)

| # | Tag | Scenario | Story | Type |
|---|-----|----------|-------|------|
| 9 | @skip | Tray icon appears on launch | US-WS-001 | Happy |
| 10 | @skip | Clicking tray icon opens the status window | US-WS-001 | Happy |
| 11 | @skip | Closing window keeps Norbert running | US-WS-001 | Edge |
| 12 | @skip | Clicking tray icon toggles window open and closed | US-WS-001 | Happy |
| 13 | @skip | Empty state is clear and inviting | US-WS-001 | Edge |
| 14 | @skip | Tray icon persists after window close and reopen | US-WS-001 | Edge |

### milestone-3-data-pipeline.feature (10 scenarios)

| # | Tag | Scenario | Story | Type |
|---|-----|----------|-------|------|
| 15 | @skip | Settings merge preserves existing configuration | US-WS-002 | Happy |
| 16 | @skip | First launch with no existing configuration | US-WS-002 | Edge |
| 17 | @skip | Settings merge fails safely on malformed configuration | US-WS-002 | Error |
| 18 | @skip @property | Settings merge is idempotent | US-WS-002 | Property |
| 19 | @skip | Restart notification appears after successful merge | US-WS-002 | Happy |
| 20 | @skip | Database initializes with correct storage mode | US-WS-002 | Happy |
| 21 | @skip | Hook receiver accepts and stores events | US-WS-002 | Happy |
| 22 | @skip | Hook receiver rejects unknown event types | US-WS-002 | Error |
| 23 | @skip | Port unavailable prevents hook receiver startup | US-WS-002 | Error |
| 24 | @skip @property | Every acknowledged event is persisted before acknowledgment | US-WS-002 | Property |

### milestone-4-end-to-end.feature (8 scenarios)

| # | Tag | Scenario | Story | Type |
|---|-----|----------|-------|------|
| 25 | @skip | First session captured and displayed | US-WS-003 | Happy |
| 26 | @skip | Event count updates during an active session | US-WS-003 | Happy |
| 27 | @skip | Status transitions between listening and active | US-WS-003 | Happy |
| 28 | @skip | Multiple sessions accumulate correctly | US-WS-003 | Happy |
| 29 | @skip | Restart banner dismisses on first event | US-WS-003 | Edge |
| 30 | @skip | Tray icon reflects active session state | US-WS-003 | Happy |
| 31 | @skip | Pre-restart events survive Norbert restart | US-WS-003 | Error/Recovery |
| 32 | @skip | Session with no tool calls shows zero events | US-WS-003 | Edge |

### integration-checkpoints.feature (5 scenarios)

| # | Tag | Scenario | Story | Type |
|---|-----|----------|-------|------|
| 33 | @skip | Settings merge hook URLs match receiver port | Cross | Integration |
| 34 | @skip | Database is shared between hook receiver and main window | Cross | Integration |
| 35 | @skip | Version displayed matches the built version | Cross | Integration |
| 36 | @skip | Hook receiver continues after main window closes | Cross | Integration |
| 37 | @skip @property | Event types are consistent across settings and receiver | Cross | Property |

---

## Story Coverage Matrix

| Story | AC Count | Scenarios | Coverage |
|-------|----------|-----------|----------|
| US-WS-000 | 5 | 5 | 100% |
| US-WS-001 | 5 | 9 (6 milestone + 3 walking skeleton) | 100% |
| US-WS-002 | 8 | 13 (10 milestone + 3 walking skeleton) | 100% |
| US-WS-003 | 7 | 11 (8 milestone + 3 walking skeleton) | 100% |
| Cross-component | N/A | 5 integration checkpoints | N/A |

---

## Error Path Analysis

| Category | Count | Percentage |
|----------|-------|-----------|
| Happy path | 17 | 46% |
| Error/recovery | 4 | 11% |
| Edge/boundary | 8 | 22% |
| Property | 3 | 8% |
| Integration | 5 | 13% |

Error + Edge + Property = 15 scenarios = **41%** (exceeds 40% target).

---

## Implementation Sequence (One at a Time)

Walking skeleton scenarios are enabled first. Milestone scenarios are enabled in story dependency order.

1. **walking-skeleton.feature** -- First launch shows Norbert is alive and listening
2. **walking-skeleton.feature** -- Settings merge preserves existing configuration
3. **walking-skeleton.feature** -- First session captured and visible in the window
4. **milestone-1-cicd-pipeline.feature** -- Tagged commit produces a downloadable release
5. **milestone-1-cicd-pipeline.feature** -- (remaining 4 scenarios)
6. **milestone-2-app-shell.feature** -- (6 scenarios in order)
7. **milestone-3-data-pipeline.feature** -- (10 scenarios in order)
8. **milestone-4-end-to-end.feature** -- (8 scenarios in order)
9. **integration-checkpoints.feature** -- (5 scenarios)
