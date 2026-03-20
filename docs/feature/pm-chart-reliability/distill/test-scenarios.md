# pm-chart-reliability: Test Scenarios

## Scenario Inventory

### Walking Skeletons (3)

| ID | Title | File | User Story |
|---|---|---|---|
| WS-01 | Raj sees a visible chart line when sessions are generating data | chart-data-rendering.test.ts | US-PMR-01 |
| WS-02 | Raj hovers over a data point and sees the correct token rate and time offset | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| WS-03 | Raj switches time window and sees data from a different resolution buffer | time-window-switching.test.ts | US-PMR-03 |

### Focused Scenarios (18)

| ID | Title | File | User Story |
|---|---|---|---|
| FS-01 | Aggregate chart reflects combined token rate across sessions | chart-data-rendering.test.ts | US-PMR-01 |
| FS-02 | Per-session mini charts show individual session data (2 tests) | chart-data-rendering.test.ts | US-PMR-01 |
| FS-03 | Chart line extends rightward as new samples arrive | chart-data-rendering.test.ts | US-PMR-01 |
| FS-04 | Chart continues after a session ends (2 tests) | chart-data-rendering.test.ts | US-PMR-01 |
| FS-05 | Crosshair aligns with cursor position (2 tests) | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| FS-06 | Crosshair computed in CSS pixels is DPI-independent | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| FS-07 | Tooltip shows category-appropriate formatted values (3 tests) | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| FS-08 | Tooltip time offset shows seconds since sample (3 tests) | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| FS-09 | 1-minute window provides high-resolution data | time-window-switching.test.ts | US-PMR-03 |
| FS-10 | 5-minute window downsamples to 500ms intervals | time-window-switching.test.ts | US-PMR-03 |
| FS-11 | 15-minute window downsamples to 1000ms intervals | time-window-switching.test.ts | US-PMR-03 |
| FS-12 | Returning to 1m preserves high-resolution data | time-window-switching.test.ts | US-PMR-03 |
| FS-13 | Each window buffer produces valid chart points | time-window-switching.test.ts | US-PMR-03 |
| FS-14 | Session window dynamically adjusts sample interval (2 tests) | time-window-switching.test.ts | US-PMR-03 |
| FS-15 | All four windows accumulate data independently | time-window-switching.test.ts | US-PMR-03 |

### Error/Boundary Scenarios (13 -- 42% of total)

| ID | Title | File | User Story |
|---|---|---|---|
| ER-01 | Empty state when no sessions are active (2 tests) | chart-data-rendering.test.ts | US-PMR-01 |
| ER-02 | Buffer at capacity evicts oldest while maintaining renderable points | chart-data-rendering.test.ts | US-PMR-01 |
| ER-03 | Chart renders correctly with single data point | chart-data-rendering.test.ts | US-PMR-01 |
| ER-04 | All zero token rates produce flat baseline, not blank chart | chart-data-rendering.test.ts | US-PMR-01 |
| ER-05 | Appending data to nonexistent session is safe | chart-data-rendering.test.ts | US-PMR-01 |
| ER-06 | Hit-test near chart edges returns valid boundary samples (4 tests) | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| ER-07 | No tooltip data when chart has no samples | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| ER-08 | Crosshair handles extreme sample values (2 tests) | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| ER-09 | Session shorter than selected window shows available data only | time-window-switching.test.ts | US-PMR-03 |
| ER-10 | Window with no accumulated data returns empty | time-window-switching.test.ts | US-PMR-03 |
| ER-11 | Unknown window ID returns empty samples gracefully | time-window-switching.test.ts | US-PMR-03 |

### Property-Shaped Scenarios (5)

| ID | Title | File | User Story |
|---|---|---|---|
| PR-01 | @property: aggregate buffer is non-empty whenever active sessions have events | chart-data-rendering.test.ts | US-PMR-01 |
| PR-02 | @property: crosshair X is always within the drawable chart area | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| PR-03 | @property: hit-test is deterministic for fixed inputs | tooltip-crosshair-accuracy.test.ts | US-PMR-02 |
| PR-04 | @property: 1m window always has at least as many samples as 5m | time-window-switching.test.ts | US-PMR-03 |
| PR-05 | @property: window buffer capacity is never exceeded | time-window-switching.test.ts | US-PMR-03 |

### Skipped Scenarios (pending implementation -- 2)

| ID | Title | File | Blocked By |
|---|---|---|---|
| SK-01 | Store getAggregateWindowBuffer returns different data for 1m vs 5m | time-window-switching.test.ts | multiSessionStore wiring (Step 01-01) |
| SK-02 | Store getSessionWindowBuffer returns per-session data | time-window-switching.test.ts | multiSessionStore wiring (Step 01-01) |

## Summary Statistics

| Metric | Value |
|---|---|
| Total scenarios | 31 (excluding skipped) |
| Walking skeletons | 3 |
| Focused scenarios | 18 |
| Error/boundary scenarios | 13 (42%) |
| Property-shaped scenarios | 5 |
| Skipped (pending impl) | 2 |
| User stories covered | 3/3 (US-PMR-01, US-PMR-02, US-PMR-03) |

## Story-to-Scenario Traceability

### US-PMR-01: Live Chart Data Rendering

| Acceptance Criterion | Scenarios |
|---|---|
| Aggregate chart displays non-empty line | WS-01, FS-01, PR-01 |
| Chart line advances at ~1Hz | FS-03 |
| Per-session mini charts show individual data | FS-02 |
| Empty-state when no sessions active | ER-01 |
| Ending session removes mini chart | FS-04 |
| Chart renders without frame drops (900 points) | ER-02 |

### US-PMR-02: DPI-Aware Tooltip and Crosshair

| Acceptance Criterion | Scenarios |
|---|---|
| Crosshair within 2px at all DPI | FS-05, FS-06, PR-02 |
| Tooltip within 16px of cursor | WS-02 (domain pipeline only) |
| Tooltip value matches nearest data point | WS-02, FS-07 |
| Tooltip flips near right edge | ER-06 (hit-test boundary) |
| Tooltip disappears on mouse exit | ER-07 |

### US-PMR-03: Functional Time Window Selection

| Acceptance Criterion | Scenarios |
|---|---|
| Clicking window button changes data buffer | WS-03, SK-01 |
| 1m: ~600 points at 100ms | FS-09 |
| 5m: ~600 points at 500ms | FS-10 |
| 15m: ~900 points at 1000ms | FS-11 |
| Session window adjusts dynamically | FS-14 |
| All windows accumulate independently | FS-15, PR-04, PR-05 |

## Implementation Sequence (one at a time)

1. WS-01 -- chart-data-rendering: "Raj sees a visible chart line" (enable first)
2. FS-01 -- chart-data-rendering: "Aggregate reflects combined rate"
3. FS-02 -- chart-data-rendering: "Per-session mini charts"
4. FS-03 -- chart-data-rendering: "Chart line advances"
5. FS-04 -- chart-data-rendering: "Session lifecycle"
6. ER-01 -- chart-data-rendering: "Empty state"
7. ER-02..ER-05 -- chart-data-rendering: remaining error scenarios
8. PR-01 -- chart-data-rendering: property scenario
9. WS-02 -- tooltip-crosshair: "Hover shows correct value"
10. FS-05..FS-08 -- tooltip-crosshair: focused scenarios
11. ER-06..ER-08 -- tooltip-crosshair: error scenarios
12. PR-02..PR-03 -- tooltip-crosshair: property scenarios
13. WS-03 -- time-window-switching: "Window switch changes data"
14. FS-09..FS-15 -- time-window-switching: focused scenarios
15. ER-09..ER-11 -- time-window-switching: error scenarios
16. PR-04..PR-05 -- time-window-switching: property scenarios
17. SK-01..SK-02 -- time-window-switching: store integration (unskip after wiring)
