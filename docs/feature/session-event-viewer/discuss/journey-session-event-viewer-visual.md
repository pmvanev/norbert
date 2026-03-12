# Journey: Session Event Viewer -- Browse Sessions and Inspect Events

## Journey Flow

```
[TRIGGER]              [STEP 1]               [STEP 2]               [STEP 3]
User opens Norbert --> Session list       --> User clicks a      --> User reads
after running          loads with all         session                 event list
Claude Code            captured sessions                              for that session

Feels: Curious         Feels: Oriented        Feels: Engaged         Feels: Informed
       "what happened?"       "I can see my          "let me look           "now I know
                               sessions"              inside"                what happened"

Sees: App window       Sees: Session rows     Sees: Session row      Sees: Event rows
      opens                  with timestamp,        highlights,            with event type,
                             duration,              event view             timestamp,
                             event count            appears                and payload

Artifacts:             Artifacts:             Artifacts:             Artifacts:
  (sessions in DB)       Session list from      Selected session       Events query
                         get_sessions()         ID                     for session_id


[STEP 4]               [GOAL]
User navigates    --> Session data
back to session       understood
list or closes

Feels: Satisfied       Feels: Trust in
       "this is               Norbert as
       useful"                a useful tool

Sees: Session list     Sees: Norbert has
      reappears              value beyond
      (or app closes)        a status indicator
```

## Emotional Arc

```
Usefulness Perception
  ^
  |                                                    *** TRUST
  |                                                ***
  |                                        INFORMED
  |                                     ***
  |                                ENGAGED
  |                            ****
  |                    ORIENTED
  |                ****
  |        CURIOUS
  |    ****
  +-----------------------------------------------------------> Time
  Open         Session        Click          Read           Navigate
  Norbert      List Loads     Session        Events         Back
```

**Arc Pattern**: Discovery Joy
- Start: Curious (what happened in my sessions?)
- Rise: Oriented (session list gives overview)
- Peak: Informed (event detail reveals what actually happened)
- Settle: Satisfied (this tool is genuinely useful)

This is the first time Norbert transitions from "infrastructure proof" to "useful product." The emotional arc should feel like discovery -- each step reveals more, building toward the realization that Norbert is worth keeping.

## Step Details

### Step 1: Session List Loads

```
+-- Norbert Window (Session Event Viewer) ---------------------------------+
|                                                                           |
|  +-- Titlebar --------------------------------------------------------+  |
|  |  [N]  Sessions  View  Help          NORBERT v0.2.0        _ [] X   |  |
|  +--------------------------------------------------------------------+  |
|                                                                           |
|  +-- Session List ----------------------------------------------------+  |
|  |                                                                    |  |
|  |  SESSIONS                                                         |  |
|  |                                                                    |  |
|  |  +-- Session Row (most recent, active) -------------------------+  |  |
|  |  | * nw:deliver -- user-auth           12m 34s      47 events   |  |  |
|  |  |   2026-03-12 14:23:01                             $0.84      |  |  |
|  |  +--------------------------------------------------------------+  |  |
|  |                                                                    |  |
|  |  +-- Session Row -----------------------------------------------+  |  |
|  |  | . refactor payment module           42m 18s     134 events   |  |  |
|  |  |   2026-03-12 09:15:33                             $3.21      |  |  |
|  |  +--------------------------------------------------------------+  |  |
|  |                                                                    |  |
|  |  +-- Session Row -----------------------------------------------+  |  |
|  |  | . quick question                    2m 05s        8 events   |  |  |
|  |  |   2026-03-11 16:44:12                             $0.12      |  |  |
|  |  +--------------------------------------------------------------+  |  |
|  |                                                                    |  |
|  +--------------------------------------------------------------------+  |
|                                                                           |
|  +-- Status Bar ------------------------------------------------------+  |
|  |  Listening  |  Port: 3748  |  3 sessions  |  189 events           |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

**Design notes**:
- Uses `.srow` (session row) pattern from `norbert-mockup-v5.html`
- Status dot: green pulsing for live sessions (`.sdot.live`), dim for completed (`.sdot.done`)
- Session name derived from first prompt or session ID
- Glassmorphism card styling: `--bg-card`, `--border-card`, `--card-r`
- Font: `--font-mono` for data values, `--font-ui` for labels
- Ordered most-recent-first (matches `get_sessions()` SQL: `ORDER BY started_at DESC`)

**Emotional state**: Curious -> Oriented
**What could go wrong**: No sessions captured yet (empty state), database read error
**Recovery**: Empty state message "No sessions captured yet. Run a Claude Code session to see data here."

### Step 2: User Clicks a Session

```
+-- Norbert Window (Session Selected) ------------------------------------+
|                                                                          |
|  +-- Titlebar --------------------------------------------------------+  |
|  |  [N]  Sessions  View  Help          NORBERT v0.2.0        _ [] X   |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +-- Session List (narrowed or header) --------------------------------+  |
|  |  < Back to Sessions                                                 |  |
|  |                                                                     |  |
|  |  SESSION: refactor payment module                                   |  |
|  |  Started: 2026-03-12 09:15:33  |  Duration: 42m 18s                |  |
|  |  Events: 134                    |  Status: completed                |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +-- Event List -------------------------------------------------------+  |
|  |                                                                     |  |
|  |  EVENTS                                                    134 total|  |
|  |                                                                     |  |
|  |  +-- Event Row --------------------------------------------------+  |  |
|  |  | 09:15:33  SESSION_START                                        |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                     |  |
|  |  +-- Event Row --------------------------------------------------+  |  |
|  |  | 09:15:35  USER_PROMPT_SUBMIT                                   |  |  |
|  |  |   "Help me refactor the payment module to use..."              |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                     |  |
|  |  +-- Event Row --------------------------------------------------+  |  |
|  |  | 09:15:38  PRE_TOOL_USE                          tool: Read     |  |  |
|  |  |   path: src/payment/processor.ts                               |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                     |  |
|  |  +-- Event Row --------------------------------------------------+  |  |
|  |  | 09:15:39  POST_TOOL_USE                         tool: Read     |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                     |  |
|  |  +-- Event Row --------------------------------------------------+  |  |
|  |  | 09:57:51  STOP                                                 |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                     |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  +-- Status Bar ------------------------------------------------------+  |
|  |  Listening  |  Port: 3748  |  3 sessions  |  189 events            |  |
|  +--------------------------------------------------------------------+  |
+--------------------------------------------------------------------------+
```

**Design notes**:
- Session header at top shows selected session metadata
- "Back to Sessions" navigation at top left
- Event rows use compact card styling matching `.srow` pattern
- Event type shown in uppercase, monospace font (`--font-mono`)
- Timestamp shown as time only (hour:minute:second) since the date is in the session header
- Tool name extracted from payload where available (PreToolUse/PostToolUse events include tool name)
- Payload snippet shown as a truncated preview line
- Events ordered chronologically (oldest first within session)

**Emotional state**: Engaged -> Informed
**What could go wrong**: Session has no events (race condition), events are too numerous to scan
**Recovery**: Empty event state shows "No events recorded for this session." Scrollable list handles large event counts.

### Step 3: User Reads Event Details

The event list itself is the detail view for Phase 2. Individual event expansion (clicking an event to see its full payload) is a natural enhancement but not required for Phase 2's exit criteria. The raw list of events with type, timestamp, and payload snippet is sufficient.

**Emotional state**: Informed -> Satisfied
**Key moment**: The user sees real data from their Claude Code session presented in a readable format. This is the moment Norbert transitions from "it captures data" to "it shows me data."

### Step 4: Navigation Back

```
+-- Back navigation ------------+
|  < Back to Sessions           |
+-------------------------------+
```

Clicking "Back to Sessions" returns to the session list view. The session list state is preserved (no re-fetch needed if data has not changed).

**Emotional state**: Satisfied -> Trust established

## Empty States

### No Sessions Yet

```
+-- Norbert Window (Empty State) ---------+
|                                          |
|  SESSIONS                                |
|                                          |
|  No sessions captured yet.               |
|  Run a Claude Code session to            |
|  see data here.                          |
|                                          |
+------------------------------------------+
```

### Session With No Events

```
+-- Event List (Empty) -------------------+
|                                          |
|  EVENTS                         0 total  |
|                                          |
|  No events recorded for this session.    |
|                                          |
+------------------------------------------+
```

## Integration Points

| From | To | Data | Validation |
|------|-----|------|------------|
| SQLite sessions table | Session list UI | Session records (id, started_at, ended_at, event_count) | get_sessions() returns correct data |
| SQLite events table | Event list UI | Event records for selected session_id | New query: get_events_for_session(session_id) |
| Session list row click | Event detail view | Selected session ID | Click handler passes session.id |
| Event detail view back | Session list | Navigation state | List re-renders or restores |
| Design system (mockup) | All UI components | CSS variables, fonts, colors | Glassmorphism theme applied |
| Walking skeleton status | Status bar | Session count, event count, connection status | Existing get_status() IPC |

## New Capability Required

The walking skeleton's `EventStore` trait does not include a method to query events for a specific session. Phase 2 requires:

```
get_events_for_session(session_id: &str) -> Result<Vec<HookEvent>, String>
```

This is the only new backend capability needed. Everything else builds on existing infrastructure.
