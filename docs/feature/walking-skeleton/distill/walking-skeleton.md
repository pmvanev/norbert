# Walking Skeleton Identification

**Feature ID**: walking-skeleton
**Date**: 2026-03-08

---

## Walking Skeleton Scenarios (3)

These three scenarios form the outer loop of Outside-In TDD. They define "done" for the walking skeleton feature and are demo-able to stakeholders.

### WS-1: First Launch Shows Norbert Is Alive and Listening

**User goal**: Confirm Norbert installed correctly and is ready to receive data.

**Litmus test**:
- Title describes user goal: YES ("Norbert is alive and listening")
- Given/When describe user actions: YES ("launches for the first time")
- Then describe user observations: YES (tray icon, version, status, counts)
- Non-technical stakeholder confirms: YES ("I can see it is alive and ready")

**Story coverage**: US-WS-001 (App Shell)

### WS-2: First Session Captured and Visible in the Window

**User goal**: See proof that the full data pipeline works -- session data flows from Claude Code through to the UI.

**Litmus test**:
- Title describes user goal: YES ("session captured and visible")
- Given/When describe user actions: YES ("starts a session", "opens the window")
- Then describe user observations: YES (session count, event count, timestamp, duration)
- Non-technical stakeholder confirms: YES ("I can see my session was captured")

**Story coverage**: US-WS-003 (End-to-End), touches US-WS-002 (Data Pipeline)

### WS-3: Settings Merge Preserves Existing Configuration

**User goal**: Trust that Norbert will not break existing Claude Code setup.

**Litmus test**:
- Title describes user goal: YES ("preserves existing configuration")
- Given/When describe user context: YES ("has existing configuration", "performs merge")
- Then describe user observations: YES (backup created, originals preserved, hooks added)
- Non-technical stakeholder confirms: YES ("my settings are safe")

**Story coverage**: US-WS-002 (Data Pipeline -- settings merge)

---

## Why These Three

1. **WS-1** proves the app shell is alive -- the foundation everything builds on.
2. **WS-3** proves the highest-anxiety operation (settings merge) is safe -- the trust gate.
3. **WS-2** proves the full data pipeline works end-to-end -- the value proof.

Together they answer: "Can a user install Norbert, trust it with their config, and see real session data?"

---

## Focused Scenario Count

| Category | Count |
|----------|-------|
| Walking skeletons | 3 |
| Focused milestone scenarios | 29 |
| Integration checkpoints | 5 |
| **Total** | **37** |

Ratio: 3 walking skeletons + 35 focused scenarios. Within recommended 2-3 skeletons + 15-20 focused range per story (4 stories x ~8 scenarios average = 32 focused, plus 5 cross-component checkpoints).
