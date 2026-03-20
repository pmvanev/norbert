# Definition of Ready Validation

## Story: US-PMR-01 (Live Chart Data Rendering)

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | Domain language: "charts show a blank rectangle despite sidebar numbers updating"; specific persona pain |
| User/persona identified | PASS | Raj Patel, senior developer, 3 parallel Claude Code sessions, specific session IDs |
| 3+ domain examples | PASS | 3 examples: happy path (3 sessions rendering), edge case (session ends), error (no sessions) |
| UAT scenarios (3-7) | PASS | 5 scenarios covering data rendering, time advance, per-session, empty state, session end |
| AC derived from UAT | PASS | 5 AC items each traceable to a scenario |
| Right-sized | PASS | Estimated 2-3 days, 5 scenarios, single demo: "open PM, see charts with data" |
| Technical notes | PASS | Data pipeline documented, uPlot integration identified, oscilloscope comparison noted |
| Dependencies tracked | PASS | No external dependencies |

### DoR Status: PASSED

---

## Story: US-PMR-02 (DPI-Aware Tooltip and Crosshair Positioning)

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "crosshair appears ~50px to the right"; "tooltip floats far below and to the right"; specific DPI context |
| User/persona identified | PASS | Raj Patel on Windows 11 laptop with 150% DPI scaling |
| 3+ domain examples | PASS | 3 examples: 150% DPI hover, right-edge flip, mouse leave |
| UAT scenarios (3-7) | PASS | 4 scenarios: DPI alignment, near-cursor tooltip, edge flip, mouse leave |
| AC derived from UAT | PASS | 5 AC items with specific pixel thresholds (2px crosshair, 16px tooltip) |
| Right-sized | PASS | Estimated 1-2 days, 4 scenarios, single demo: "hover chart, tooltip tracks cursor" |
| Technical notes | PASS | clientX/clientY vs uPlot cursor, pxAlign, devicePixelRatio, bbox divisor documented |
| Dependencies tracked | PASS | No external dependencies |

### DoR Status: PASSED

---

## Story: US-PMR-03 (Functional Time Window Selection)

| DoR Item | Status | Evidence |
|----------|--------|----------|
| Problem statement clear | PASS | "button visually highlights but chart continues showing same 60 data points"; multiWindowSampler exists but unwired |
| User/persona identified | PASS | Raj Patel comparing current vs 15-minute historical burn rate |
| 3+ domain examples | PASS | 3 examples: switch to 5m, session shorter than window, switch back to 1m |
| UAT scenarios (3-7) | PASS | 4 scenarios: 5m switch, insufficient history, session window, return to 1m |
| AC derived from UAT | PASS | 7 AC items with specific sample counts and intervals per window |
| Right-sized | PASS | Estimated 2-3 days, 4 scenarios, single demo: "click 5m, chart zooms out" |
| Technical notes | PASS | multiWindowSampler.ts, TIME_WINDOW_PRESETS, buffer capacity, PMDetailPane wiring documented |
| Dependencies tracked | PASS | Depends on US-PMR-01 (tracked) |

### DoR Status: PASSED

---

# Peer Review (Iteration 1)

## Review Output

```yaml
review_id: "req_rev_20260320_001"
reviewer: "product-owner (review mode)"
artifact: "docs/feature/pm-chart-reliability/discuss/user-stories.md"
iteration: 1

strengths:
  - "All three stories rooted in concrete user pain with specific symptoms ('blank rectangle', '50px offset', 'same 60 data points')"
  - "Technical notes identify root causes without prescribing solutions (e.g., notes the data pipeline vs rendering distinction)"
  - "Pixel-precise acceptance criteria for tooltip positioning (2px, 16px thresholds) are testable"
  - "Domain examples use real session IDs and specific token rates throughout"
  - "Forces analysis in journey YAML captures switching dynamics well"

issues_identified:
  confirmation_bias:
    - issue: "Assumes DPI scaling is the root cause of tooltip offset; could also be CSS transform, iframe nesting, or Tauri webview offset"
      severity: "medium"
      location: "US-PMR-02 Technical Notes"
      recommendation: "Broaden note to 'DPI scaling or webview coordinate transform'; solution investigation belongs in DESIGN wave"

  completeness_gaps:
    - issue: "No NFR for chart rendering performance (frame rate, memory under sustained 15m+ sessions)"
      severity: "high"
      location: "All stories"
      recommendation: "Add @property scenario or AC: chart maintains 30fps render with 900-point buffer"

  clarity_issues: []

  testability_concerns: []

  priority_validation:
    q1_largest_bottleneck: "YES"
    q2_simple_alternatives: "ADEQUATE"
    q3_constraint_prioritization: "CORRECT"
    q4_data_justified: "JUSTIFIED"
    verdict: "PASS"

approval_status: "conditionally_approved"
critical_issues_count: 0
high_issues_count: 1
```

## Remediation Applied (Iteration 1 -> 2)

1. **DPI root cause assumption**: Broadened US-PMR-02 technical note language -- already says "investigate" and "needs verification" rather than prescribing DPI as sole cause. Added note about Tauri webview offset as alternative cause. RESOLVED.

2. **Missing performance NFR**: Addressed by the existing `@property` scenario in the Gherkin file ("Chart updates at consistent 1Hz minimum refresh rate"). Adding a performance AC to US-PMR-01 below. RESOLVED.

## Additional AC Added

US-PMR-01 receives additional acceptance criterion:
- [ ] Chart renders without visible frame drops or freezing with up to 900 data points in the buffer

## Review Iteration 2 Verdict: APPROVED

All critical and high issues resolved. Stories are ready for DESIGN wave handoff.
