# JTBD Analysis: Norbert Walking Skeleton

## Job Classification

**Job Type**: Build Something New (Greenfield)
**Workflow**: research -> discuss -> design -> distill -> baseline -> roadmap -> split -> execute -> review

This is a greenfield desktop application. No code exists. The walking skeleton proves the full data path from Claude Code hook events through to a visible desktop UI.

---

## Primary Job: Observe AI Agent Activity

### Job Statement

"Help me see what my AI agents are doing so I can make informed decisions about how they work."

### Job Story

**When** I am running Claude Code sessions with multiple agents and tools,
**I want to** see what is happening inside those sessions in real time,
**so I can** understand costs, debug unexpected behavior, and optimize my workflow.

### Three Dimensions

**Functional**: Capture hook event data from Claude Code, store it locally, display session activity in a desktop UI.

**Emotional**: Feel confident that nothing is happening "behind my back" -- that I have visibility into what my AI tools are doing with my money and my codebase.

**Social**: Be seen as a developer who understands and controls their AI tooling, not someone who blindly trusts opaque systems.

---

## Walking Skeleton Jobs

The walking skeleton is not a feature. It is the thinnest slice that proves the entire system works end-to-end. Three sub-jobs compose it:

### Job 1: Install and Receive Data

**When** I have decided to try Norbert and want to start observing my Claude Code sessions,
**I want to** install it with a single command and have it start receiving data immediately,
**so I can** confirm that Norbert is working without any manual configuration.

#### Forces Analysis

- **Push**: Claude Code sessions are opaque -- I have no idea what happened after a session unless I manually inspect logs or terminal output. I spent $4.50 on a session yesterday and do not know why.
- **Pull**: One command installs Norbert, it patches my settings automatically, and I see a tray icon confirming it is listening. Zero configuration.
- **Anxiety**: Will Norbert break my existing Claude Code settings? Will it slow down my sessions? Is it safe to let it modify my settings.json?
- **Habit**: I currently just run Claude Code and accept whatever happens. Checking costs requires going to the Anthropic Console website after the fact.

**Switch likelihood**: High -- the push is strong (cost opacity) and the pull is frictionless (single command install).
**Key blocker**: Anxiety about settings.json modification.
**Key enabler**: Push of cost blindness.
**Design implication**: The settings merge must be surgical and reversible (backup first). The first-launch experience must immediately confirm "I am listening" to resolve anxiety.

### Job 2: Know That Data Is Flowing

**When** I have installed Norbert and started a Claude Code session,
**I want to** see clear confirmation that Norbert is receiving and storing hook events,
**so I can** trust that the system is working before investing time exploring its features.

#### Forces Analysis

- **Push**: I installed the tool but I have no way to know if it actually works. Silent tools erode trust.
- **Pull**: A status indicator showing "Listening" and a live event count that increments as I work gives me immediate confidence.
- **Anxiety**: What if the hooks are not registered correctly? What if events are being dropped silently?
- **Habit**: I am used to tools that require me to verify they work by checking logs or running diagnostics.

**Switch likelihood**: High -- immediate feedback is the difference between "this works" and "I should uninstall this."
**Key blocker**: Silent failure with no visible feedback.
**Key enabler**: Ambient status indicator that confirms data flow without requiring action.
**Design implication**: The tray icon and main window must show real-time status. The transition from "No active session" to "Listening" to "Receiving events" must be visible and automatic.

### Job 3: Confirm the Full Path Works

**When** I have run a Claude Code session with Norbert active,
**I want to** open the Norbert window and see evidence that my session was captured,
**so I can** have confidence that the full data pipeline -- from Claude Code hook through HTTP to SQLite -- is working end-to-end.

#### Forces Analysis

- **Push**: I need proof that the entire system works, not just that individual pieces exist. A tray icon that says "Listening" but stores nothing is useless.
- **Pull**: Opening Norbert after a session and seeing "1 session captured, 47 events" proves everything works. That single confirmation unlocks trust in the entire platform.
- **Anxiety**: What if the database is empty? What if the HTTP server received events but failed to write them?
- **Habit**: I currently have no way to verify any of this. I just hope things work.

**Switch likelihood**: High -- this is the moment Norbert becomes real.
**Key blocker**: Empty database despite apparent hook registration.
**Key enabler**: Visible session record with event count.
**Design implication**: The main window must show at minimum: session count, most recent session timestamp, and event count. Even without rich UI, these three numbers prove the full path.

---

## 8-Step Job Map: Walking Skeleton

| Step | Description | Walking Skeleton Scope |
|------|-------------|----------------------|
| 1. Define | User decides to try Norbert | Sees README, understands value proposition |
| 2. Locate | User finds install command | `npm install -g norbert-cc` or `npx github:pmvanev/norbert-cc` |
| 3. Prepare | Norbert patches settings.json, starts hook server | Automatic on first launch -- no user action required |
| 4. Confirm | User sees tray icon with "Listening" status | Tray icon appears, window shows status |
| 5. Execute | User runs a Claude Code session normally | No change to user's workflow -- Norbert receives events silently |
| 6. Monitor | User checks that data is flowing | Status indicator shows event count incrementing |
| 7. Modify | User troubleshoots if events are not arriving | Restart Claude Code prompt, hook health check |
| 8. Conclude | User confirms the system works end-to-end | Opens window, sees session record with events |

### Overlooked Requirements from Job Map

- **Step 3 (Prepare)**: Settings.json backup must happen before merge. User must be told to restart running Claude Code sessions.
- **Step 4 (Confirm)**: What does the window show before any session has run? Empty state must be clear, not broken-looking.
- **Step 7 (Modify)**: What if the hook port (3748) is already in use? What if settings.json is read-only?
- **Step 8 (Conclude)**: How does the user verify data without a rich UI? Minimum: session count and event count visible in the window.

---

## Outcome Statements (Walking Skeleton Scope)

| # | Outcome Statement | Imp. | Sat. | Score | Priority |
|---|-------------------|------|------|-------|----------|
| 1 | Minimize the time from install command to first confirmed data reception | 95% | 5% | 18.0 | Extremely Underserved |
| 2 | Minimize the likelihood of breaking existing Claude Code configuration during install | 90% | 10% | 16.2 | Extremely Underserved |
| 3 | Minimize the time to confirm that the full data pipeline is working end-to-end | 90% | 5% | 16.2 | Extremely Underserved |
| 4 | Minimize the likelihood of hook events being silently dropped or lost | 85% | 5% | 15.3 | Extremely Underserved |
| 5 | Minimize the number of manual steps required to go from install to working system | 80% | 10% | 13.0 | Underserved |
| 6 | Minimize the likelihood of confusion about whether Norbert is working | 85% | 5% | 15.3 | Extremely Underserved |

**Scoring method**: Team estimates (no user survey data yet -- greenfield product). Importance reflects criticality to walking skeleton success. Satisfaction reflects current state (no tool exists, so satisfaction is near zero for all outcomes).

**Data Quality Notes**:
- Source: product spec analysis + team estimates
- Sample size: internal team (N=1)
- Confidence: Low -- these are directional, not validated

---

## Opportunity Map

All outcomes score 13+ because this is greenfield -- nothing exists today. The walking skeleton addresses outcomes 1-6 simultaneously by proving the full data path.

### Top Opportunities (Score >= 15)

1. **Zero-config install to first data** (18.0) -- Stories: US-WS-001, US-WS-002
2. **Safe settings merge** (16.2) -- Story: US-WS-002
3. **End-to-end pipeline confirmation** (16.2) -- Story: US-WS-003
4. **No silent data loss** (15.3) -- Story: US-WS-003
5. **Clear working/not-working status** (15.3) -- Story: US-WS-001

### Walking Skeleton as Feature 0

**Recommendation: YES -- the walking skeleton should be Feature 0.**

Rationale:
- This is greenfield. No infrastructure exists.
- The spec's Phase 0 (CI/CD) and Phase 1 (Vertical Slice MVP) together constitute the walking skeleton.
- Every subsequent feature depends on the data pipeline working. Building features before proving the pipeline is building on assumptions.
- The walking skeleton proves: Tauri app shell works, HTTP hook server receives data, SQLite stores events, UI displays status. All four layers must work for any feature to exist.

The walking skeleton maps to the spec's Phase 0 + Phase 1 combined. Phase 0 (CI/CD pipeline) is infrastructure that enables delivery. Phase 1 (Vertical Slice MVP) is the thinnest product slice. Together they form a single walking skeleton.
