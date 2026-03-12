# JTBD Analysis: Session Event Viewer

## Job Classification

**Job Type**: Build Something New (Greenfield feature on existing skeleton)
**Workflow**: discuss -> design -> distill -> execute -> review
**Research Depth**: Lightweight (product spec provides detailed requirements)

---

## Primary Job: See What Happened in My AI Sessions

### Job Statement

"Help me see what happened inside my Claude Code sessions so I can understand what the AI actually did."

### Job Story

**When** I have finished a Claude Code session and want to understand what happened,
**I want to** open Norbert and see a list of my sessions with their details, then drill into a session to see each individual event,
**so I can** understand what tools were called, how long things took, and confirm the data pipeline is showing me real, useful information.

### Three Dimensions

**Functional**: Display a list of captured sessions with timestamp, duration, and event count. Allow clicking a session to view its raw hook events as a simple list.

**Emotional**: Feel that Norbert is genuinely useful -- not just a status indicator but a tool that shows me what happened. The moment I see real session data presented clearly, Norbert becomes worth keeping.

**Social**: Be a developer who has visibility into their AI tooling. When a colleague asks "what did Claude do?", I can answer with specifics rather than guessing.

---

## Phase 2 Jobs

Phase 2 is the transition from "Norbert exists" (walking skeleton) to "Norbert does something." Two sub-jobs compose it:

### Job 1: Browse My Session History

**When** I open Norbert after running one or more Claude Code sessions,
**I want to** see a list of all my sessions with key metadata (when, how long, how many events),
**so I can** quickly find the session I care about and know that Norbert has been tracking my work.

#### Forces Analysis

- **Push**: The walking skeleton shows session count and event count but no session list. I see "Sessions: 3" but cannot distinguish between them. Which session was the expensive one? Which one just finished? No way to tell.
- **Pull**: A clean session list with timestamps, duration, and event counts lets me scan my recent activity at a glance. It is the obvious next step from a count to a list.
- **Anxiety**: Will the list be overwhelming if I have many sessions? Will old sessions clutter the view? What if session data looks wrong or confusing?
- **Habit**: I currently accept that my Claude Code sessions are opaque. If Norbert already shows me a count, I might not feel urgency to see the list. The list must be obviously better than the count.

**Switch likelihood**: High -- the push is strong (count without list is frustrating) and the pull is natural (list is the expected next view).
**Key blocker**: If the list feels like raw data rather than useful information.
**Key enabler**: Clean presentation with meaningful timestamps and human-readable durations.
**Design implication**: The session list must feel like a coherent, well-styled view -- not a debug dump. Use the glassmorphism design system from the mockup. Timestamps must be human-readable. Durations must be formatted naturally.

### Job 2: Inspect a Session's Events

**When** I see a session in Norbert and want to understand what happened inside it,
**I want to** click on that session and see a chronological list of its raw hook events,
**so I can** understand what tools were called, what prompts were submitted, and when the session started and stopped.

#### Forces Analysis

- **Push**: The session list shows event counts but not what those events are. "47 events" tells me something happened but not what. I need to see the individual events to understand my session.
- **Pull**: Clicking a session and seeing a clear list of events -- PreToolUse (Read), PostToolUse (Write), SessionStart, Stop -- gives me the forensic detail I need. Even without rich formatting, raw event data is useful when presented chronologically.
- **Anxiety**: Raw event data might be incomprehensible. Will I understand what "PreToolUse" means? What if the payload is too large or too technical?
- **Habit**: I have no current way to inspect session events at all. There is no competing workflow -- just blindness.

**Switch likelihood**: High -- there is no alternative. Any visibility into events is infinitely better than none.
**Key blocker**: If the event list is unreadable or overwhelming.
**Key enabler**: Simple chronological list with event type labels, timestamps, and collapsible/scrollable payloads.
**Design implication**: Event list should be dense but readable. Event type names should be prominent. Timestamps should be relative to session start. The raw payload can be shown but should not dominate.

---

## 8-Step Job Map: Session Event Viewer

| Step | Description | Phase 2 Scope |
|------|-------------|---------------|
| 1. Define | User wants to review a session | Opens Norbert to check on recent activity |
| 2. Locate | User finds the session they care about | Session list with timestamps helps identification |
| 3. Prepare | No preparation needed | List is immediately available on app open |
| 4. Confirm | User confirms it is the right session | Timestamp, duration, event count visible per session |
| 5. Execute | User clicks a session to see events | Event list renders for the selected session |
| 6. Monitor | User scans the event list | Events shown chronologically with type and timestamp |
| 7. Modify | User looks for specific events or goes back | Back navigation to session list |
| 8. Conclude | User has the information they needed | Closes Norbert or selects a different session |

### Overlooked Requirements from Job Map

- **Step 2 (Locate)**: Sessions must be ordered most-recent-first so users find what they just did easily.
- **Step 4 (Confirm)**: Duration must show even for sessions without a Stop event (show "in progress" or calculate from now).
- **Step 5 (Execute)**: What does "click a session" mean in the UI? Master-detail? Navigation? The Phase 2 spec says "clicking a session shows its raw hook events" -- this implies a detail view.
- **Step 7 (Modify)**: Users need to go back to the session list from the event detail view.
- **Step 8 (Conclude)**: The empty state (no sessions yet) must be handled gracefully, consistent with walking skeleton empty state.

---

## Outcome Statements (Phase 2 Scope)

| # | Outcome Statement | Imp. | Sat. | Score | Priority |
|---|-------------------|------|------|-------|----------|
| 1 | Minimize the time to find a specific session in the list | 90% | 5% | 16.2 | Extremely Underserved |
| 2 | Minimize the likelihood of misidentifying which session is which | 85% | 5% | 15.3 | Extremely Underserved |
| 3 | Minimize the time to understand what events occurred in a session | 90% | 5% | 16.2 | Extremely Underserved |
| 4 | Minimize the likelihood of the event list being unreadable or overwhelming | 80% | 5% | 14.4 | Extremely Underserved |
| 5 | Maximize the likelihood that the UI feels polished and trustworthy | 75% | 5% | 13.5 | Underserved |

**Scoring method**: Team estimates (no user survey data -- early product). Satisfaction is near-zero because no UI exists for viewing sessions or events yet.

**Data Quality Notes**:
- Source: product spec analysis + team estimates
- Sample size: internal team (N=1)
- Confidence: Low -- directional estimates

---

## Opportunity Map

All outcomes score 13+ because there is currently no session browsing or event viewing capability.

### Top Opportunities (Score >= 15)

1. **Quick session identification** (16.2) -- Stories: US-SEV-001
2. **Understanding session events** (16.2) -- Story: US-SEV-002
3. **Distinguishing sessions** (15.3) -- Story: US-SEV-001

### Phase 2 as the "Becoming Real" Moment

**Recommendation**: Phase 2 is the feature that makes Norbert genuinely useful. The walking skeleton proved data flows. Phase 2 proves that data is accessible and readable. It is the minimum viable product moment.

The two stories (session list + event detail) are tightly coupled by the user journey: list enables navigation, detail enables understanding. Both must ship together to deliver the Phase 2 promise.
