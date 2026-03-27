# User Stories: Session Time Filter

## US-1: Filter sessions to active now [J1]

**As a** developer monitoring multiple Claude Code sessions in Norbert,
**I want to** filter the session list to show only currently active sessions,
**so I can** immediately see my active workload without scanning past completed sessions.

**Traces to**: Job 1 (Focus on what's happening now)

**Acceptance criteria**: See AC-1 in acceptance-criteria.md

**Size**: S

---

## US-2: Filter sessions by recent time window [J2]

**As a** developer returning to Norbert after a break,
**I want to** filter sessions by a time window (last 15 min, last hour, last 24 hrs),
**so I can** review what happened during a specific recent period.

**Traces to**: Job 2 (Review recent activity)

**Acceptance criteria**: See AC-2 in acceptance-criteria.md

**Size**: S

---

## US-3: See filtered session count in header [J3]

**As a** developer using the session filter,
**I want to** see the session count in the header update to reflect the active filter,
**so I can** quickly gauge activity volume for the selected time window.

**Traces to**: Job 3 (Understand session volume over time)

**Acceptance criteria**: See AC-3 in acceptance-criteria.md

**Size**: XS

---

## US-4: See meaningful empty state when filter matches nothing [J1, J2]

**As a** developer who selected a filter with no matching sessions,
**I want to** see a clear message that no sessions match the current filter,
**so I** understand the result is from filtering, not a system error.

**Traces to**: Job 1, Job 2 (edge case)

**Acceptance criteria**: See AC-4 in acceptance-criteria.md

**Size**: XS
