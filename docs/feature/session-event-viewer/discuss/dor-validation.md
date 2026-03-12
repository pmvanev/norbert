# Definition of Ready Validation: Session Event Viewer

## Story: US-SEV-001 (Session List View)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Priya sees 'Sessions: 3, Events: 189' but cannot see which sessions those are" -- specific pain, domain language |
| User/persona identified | PASS | Priya Chandrasekaran, Claude Code power user, Windows 11, 3-5 sessions/day |
| 3+ domain examples | PASS | 3 examples: happy path (3 sessions listed), live session indicator, empty state |
| UAT scenarios (3-7) | PASS | 5 scenarios: list display, live indicator, polling updates, empty state, duration format |
| AC derived from UAT | PASS | 6 AC items, each traceable to scenarios |
| Right-sized | PASS | 1-2 days effort, 5 scenarios -- list view reusing existing IPC and domain functions |
| Technical notes | PASS | Reuses get_sessions() IPC, calculateDurationSeconds(), formatDuration(); shared artifact documented |
| Dependencies tracked | PASS | Walking skeleton (US-WS-*), US-SEV-003 (design system) -- explicitly tracked |

### DoR Status: PASSED

---

## Story: US-SEV-002 (Session Event Detail View)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Priya sees '134 events' but has no idea whether those were file reads, code writes, subagent spawns" -- specific pain, domain language |
| User/persona identified | PASS | Priya Chandrasekaran, viewing session list, wants to drill into events |
| 3+ domain examples | PASS | 3 examples: inspecting 134-event session, short 8-event session, session with no events |
| UAT scenarios (3-7) | PASS | 5 scenarios: chronological events, payload display, back navigation, short session, scrollable list |
| AC derived from UAT | PASS | 8 AC items, each derived from scenarios |
| Right-sized | PASS | 2-3 days effort, 5 scenarios -- new query + event list UI + navigation |
| Technical notes | PASS | New EventStore method, new IPC command, SQL query, payload parsing, frontend state management |
| Dependencies tracked | PASS | US-SEV-001 (session list), US-SEV-003 (design system), walking skeleton EventStore |

### DoR Status: PASSED

---

## Story: US-SEV-003 (Design System Application)

| DoR Item | Status | Evidence/Issue |
|----------|--------|----------------|
| Problem statement clear | PASS | "Walking skeleton looks like a prototype -- plain text, no visual hierarchy, no personality" -- real pain |
| User/persona identified | PASS | Priya Chandrasekaran, sees Norbert UI daily, expects polished desktop app |
| 3+ domain examples | PASS | 3 examples: glassmorphism session rows, theme consistency across views, styled empty state |
| UAT scenarios (3-7) | PASS | 3 scenarios: glassmorphism styling, typography, color scheme |
| AC derived from UAT | PASS | 7 AC items traceable to scenarios |
| Right-sized | PASS | 1-2 days effort, 3 scenarios -- CSS/styling work with clear reference (mockup) |
| Technical notes | PASS | CSS variables listed, font imports specified, theme variant scope limited to default |
| Dependencies tracked | PASS | norbert-mockup-v5.html, walking skeleton app shell |

### DoR Status: PASSED

---

## Summary

| Story | DoR Status | Effort Estimate | Scenarios |
|-------|-----------|-----------------|-----------|
| US-SEV-001 | PASSED | 1-2 days | 5 |
| US-SEV-002 | PASSED | 2-3 days | 5 |
| US-SEV-003 | PASSED | 1-2 days | 3 |

**Total session-event-viewer effort**: 4-7 days
**Total scenarios**: 13
**All 3 stories pass DoR**

### Dependency Order

```
US-SEV-003 (Design System) ---+
                               |
US-SEV-001 (Session List) -----+--> US-SEV-002 (Event Detail)
```

US-SEV-003 (Design System) can be developed in parallel with US-SEV-001 or applied as the first story since it is a styling foundation. US-SEV-001 (Session List) must be completed before US-SEV-002 (Event Detail) because the event detail view is navigated to from the session list.

### Recommended Implementation Order

1. **US-SEV-003** (Design System) -- establish the visual foundation first
2. **US-SEV-001** (Session List) -- build the primary view with correct styling
3. **US-SEV-002** (Event Detail) -- add drill-down capability

### Exit Criteria Alignment

The product spec's Phase 2 exit criteria is: "Run Claude Code, do something, open Norbert, see the session and its events displayed in the UI without any manual steps."

This is fully covered by:
- US-SEV-001 proves "see the session" (session list with metadata)
- US-SEV-002 proves "see its events" (event detail view)
- US-SEV-003 proves "displayed in the UI" (styled with design system, not raw data)
