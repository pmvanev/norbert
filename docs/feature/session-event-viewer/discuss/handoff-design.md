# Handoff: Session Event Viewer -> DESIGN Wave

## Handoff Summary

**Feature**: session-event-viewer (Phase 2 -- Does Something)
**From**: product-owner (DISCUSS wave)
**To**: solution-architect (DESIGN wave)
**Date**: 2026-03-12

---

## Artifacts Produced

| Artifact | Path | Description |
|----------|------|-------------|
| JTBD Analysis | `docs/feature/session-event-viewer/discuss/jtbd-analysis.md` | Job classification, job stories, forces analysis, 8-step job map, outcome statements |
| Journey Visual | `docs/feature/session-event-viewer/discuss/journey-session-event-viewer-visual.md` | ASCII flow diagram, emotional arc, UI mockups per step, integration points |
| Journey Schema | `docs/feature/session-event-viewer/discuss/journey-session-event-viewer.yaml` | Structured YAML journey with steps, shared artifacts, gherkin per step |
| Gherkin Scenarios | `docs/feature/session-event-viewer/discuss/journey-session-event-viewer.feature` | 14 testable scenarios covering session list, event detail, navigation, design system, pipeline integrity |
| Shared Artifacts Registry | `docs/feature/session-event-viewer/discuss/shared-artifacts-registry.md` | 7 tracked artifacts with sources, consumers, risk levels, 5 validation checkpoints |
| User Stories | `docs/feature/session-event-viewer/discuss/user-stories.md` | 3 stories (US-SEV-001, US-SEV-002, US-SEV-003) with full LeanUX template |
| DoR Validation | `docs/feature/session-event-viewer/discuss/dor-validation.md` | All 3 stories pass 8-item DoR gate |

---

## Stories for DESIGN Wave

### US-SEV-001: Session List View
- **Effort**: 1-2 days | **Scenarios**: 5
- **Key decision for DESIGN**: How to evolve the walking skeleton's minimal status view into a proper session list. The existing `get_sessions()` IPC command and domain functions are ready to use.

### US-SEV-002: Session Event Detail View
- **Effort**: 2-3 days | **Scenarios**: 5
- **Key decision for DESIGN**: New `get_events_for_session()` method needed on EventStore trait. Frontend navigation model (replace view vs. master-detail layout). Payload snippet extraction logic for different event types.

### US-SEV-003: Design System Application
- **Effort**: 1-2 days | **Scenarios**: 3
- **Key decision for DESIGN**: How to structure CSS to import design system variables. Whether to create a component library or apply styles directly. Only the default Norbert theme (`.theme-nb`) is needed for Phase 2.

---

## Key Constraints for DESIGN Wave

1. **This is Phase 2** -- keep it minimal. Session list + event detail + styling. No filtering, no search, no sorting controls. Those come in later phases.
2. **Reuse existing infrastructure** -- get_sessions() IPC, domain functions (formatDuration, calculateDurationSeconds), polling pattern, Session type all exist from the walking skeleton.
3. **One new backend capability** -- `get_events_for_session(session_id)` is the only new EventStore method needed.
4. **Design system scope** -- only the default Norbert dark theme. No theme switching in Phase 2.
5. **No plugin architecture yet** -- Phase 3 introduces the plugin system. Phase 2 is a monolithic view in the main window.

---

## New Backend Capability Required

The walking skeleton's `EventStore` trait needs one new method:

```
get_events_for_session(session_id: &str) -> Result<Vec<HookEvent>, String>
```

Query: `SELECT * FROM events WHERE session_id = ? ORDER BY received_at ASC`

This needs a corresponding Tauri IPC command (`get_session_events`) that the frontend can call.

---

## Integration Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Event query returns wrong session's events | HIGH | Filter by session_id in SQL WHERE clause; integration test verifies correct filtering |
| Design system CSS variables not applied correctly | HIGH | Visual regression testing against mockup; import variables from a shared stylesheet |
| Navigation state lost (back button does not work) | MEDIUM | Simple React state (`selectedSessionId: string | null`); null = list view, non-null = detail view |
| Payload snippet extraction fails for unexpected payload shapes | MEDIUM | Defensive parsing with fallback to raw JSON snippet; not all events have tool names |

---

## Peer Review

### Self-Review (Iteration 1)

```yaml
review_id: "req_rev_20260312_001"
reviewer: "product-owner (review mode)"
artifact: "docs/feature/session-event-viewer/discuss/user-stories.md"
iteration: 1

strengths:
  - "Clear problem statements with specific pain points using real persona (Priya Chandrasekaran)"
  - "Domain examples use realistic data: session IDs, timestamps, event counts, tool names"
  - "Job stories trace clearly to user stories (N:1 mapping documented)"
  - "Shared artifacts registry identifies the new high-risk artifact (session_events query)"
  - "Stories are right-sized: 1-2 days and 2-3 days with 3-5 scenarios each"
  - "Reuses existing walking skeleton infrastructure (get_sessions, formatDuration, polling)"

issues_identified:
  confirmation_bias:
    - issue: "No technology bias detected -- stories describe outcomes, not implementations"
      severity: "low"
      location: "All stories"
      recommendation: "No action needed"

  completeness_gaps:
    - issue: "No explicit NFR for session list load time with large numbers of sessions"
      severity: "medium"
      location: "US-SEV-001"
      recommendation: "Add note that Phase 2 targets < 100 sessions; pagination deferred to future phase"

  clarity_issues: []

  testability_concerns: []

  priority_validation:
    q1_largest_bottleneck: "YES"
    q2_simple_alternatives: "ADEQUATE"
    q3_constraint_prioritization: "CORRECT"
    q4_data_justified: "JUSTIFIED"
    verdict: "PASS"

approval_status: "approved"
critical_issues_count: 0
high_issues_count: 0
```

### Resolution

The medium-severity completeness gap (NFR for large session lists) is acknowledged. Phase 2 targets a small number of sessions (< 100). Pagination and performance optimization are deferred to Phase 3+ when the plugin architecture introduces more sophisticated list views. This is appropriate for a lightweight Phase 2 feature.

---

## DoR Summary

All 3 stories pass the 8-item Definition of Ready gate:

| Story | Status |
|-------|--------|
| US-SEV-001 (Session List View) | PASSED |
| US-SEV-002 (Session Event Detail View) | PASSED |
| US-SEV-003 (Design System Application) | PASSED |

---

## Recommended Implementation Order

```
US-SEV-003 (Design System) --> US-SEV-001 (Session List) --> US-SEV-002 (Event Detail)
```

This order establishes the visual foundation first, then the primary view, then the drill-down capability. US-SEV-003 and US-SEV-001 could be parallelized if needed.
