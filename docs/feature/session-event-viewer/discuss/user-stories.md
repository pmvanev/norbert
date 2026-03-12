<!-- markdownlint-disable MD024 -->

# Session Event Viewer User Stories

Stories are ordered by dependency: US-SEV-001 (session list) enables US-SEV-002 (event detail). US-SEV-003 (design system) is applied across both.

---

## US-SEV-001: Session List View

### Problem

Priya Chandrasekaran is a Claude Code power user who runs 3-5 sessions per day on Windows 11. She has Norbert installed and the walking skeleton shows "Sessions: 3, Events: 189" but she cannot see which sessions those are, when they happened, or how long they lasted. She finds it frustrating to know data exists but have no way to browse it -- it is like seeing "3 unread emails" without an inbox.

### Who

- Claude Code power user | Windows 11 | Has Norbert installed with walking skeleton working | Wants to browse captured session history

### Solution

A session list view that replaces the walking skeleton's minimal status display. When Priya opens Norbert, she sees all captured sessions as rows with start timestamp, duration, event count, and live/completed status. Sessions are ordered most-recent-first. The view uses the glassmorphism design system from norbert-mockup-v5.html.

### Domain Examples

#### 1: Happy path -- Priya sees her three sessions from today

Priya ran three Claude Code sessions today: a 12-minute nWave deliver session with 47 events, a 42-minute refactoring session with 134 events, and a 2-minute quick question with 8 events. She opens Norbert and sees all three sessions listed, most recent first. The nWave session shows a green pulsing dot because it is still active. The other two show dim dots (completed). Each row shows the start time, duration, and event count.

#### 2: Edge case -- Priya has a live session still running

Priya has a Claude Code session running right now. She opens Norbert and sees the session at the top of the list with a green pulsing indicator. The duration shows as elapsed time since the session started. The event count increments as new events arrive. When the session ends (Stop event), the status dot dims and the final duration appears.

#### 3: Empty state -- Priya just installed Norbert

Priya installed Norbert 5 minutes ago and has not run any Claude Code sessions yet. She opens the window and sees an empty state message: "No sessions captured yet. Run a Claude Code session to see data here." The message is calm and informational, not error-like.

### UAT Scenarios (BDD)

#### Scenario: Session list shows all captured sessions

Given Priya has Norbert running with hooks registered
And she has completed 3 Claude Code sessions producing 47, 134, and 8 events
When Priya opens the Norbert window
Then she sees 3 session rows in the session list
And the most recent session appears at the top
And each session row shows start timestamp, duration, and event count

#### Scenario: Active session shows live indicator

Given Priya has an active Claude Code session "sess-abc123" with no ended_at
And the session started at "2026-03-12T14:23:01Z" with 47 events so far
When Priya views the session list
Then session "sess-abc123" shows a green pulsing status dot
And the duration shows elapsed time since session start

#### Scenario: Session list updates via polling

Given Priya has the Norbert window open showing 2 sessions
And a new Claude Code session starts generating events
When the next poll cycle completes (within 1 second)
Then a third session appears at the top of the list

#### Scenario: Empty state when no sessions exist

Given Priya has installed Norbert but has not run any Claude Code sessions
When she opens the Norbert window
Then she sees "No sessions captured yet"
And the message is styled clearly and does not look like an error

#### Scenario: Completed session shows correct duration

Given Priya has a completed session "sess-def456"
And the session started at "2026-03-12T09:15:33Z" and ended at "2026-03-12T09:57:51Z"
When Priya views the session list
Then the session row for "sess-def456" shows duration "42m 18s"
And the session row shows a dim completed status dot

### Acceptance Criteria

- [ ] Session list displays all sessions from the database, ordered most-recent-first
- [ ] Each session row shows: start timestamp (human-readable), duration, event count
- [ ] Active sessions (no ended_at) show a green pulsing status dot; completed sessions show a dim dot
- [ ] Session list polls for updates within 1 second
- [ ] Empty state shows a clear, non-error message when no sessions exist
- [ ] Duration displays as human-readable format (e.g., "42m 18s") using existing formatDuration()

### Technical Notes

- Existing `get_sessions()` IPC command already returns session list from SQLite -- reuse directly
- Existing `get_latest_session()` provides session data; `get_sessions()` provides the full list
- Shared artifact: `session_list` from `EventStore::get_sessions()`
- Uses existing Session type: `{ id, started_at, ended_at, event_count }`
- Duration calculation uses existing `calculateDurationSeconds()` and `formatDuration()` from `src/domain/status.ts`
- For active sessions, duration should calculate from started_at to current time
- Polling interval: reuse existing 1-second polling from walking skeleton

### Dependencies

- Walking skeleton delivered (US-WS-001, US-WS-002, US-WS-003)
- US-SEV-003 (Design System Application) for styling

### Job Story Trace

- Job 1: Browse My Session History

---

## US-SEV-002: Session Event Detail View

### Problem

Priya Chandrasekaran can see her sessions listed in Norbert but she cannot see what happened inside them. She sees "134 events" next to a session but has no idea whether those were file reads, code writes, subagent spawns, or something else. She finds it incomplete to have session-level data without event-level detail -- it is like seeing an email subject without being able to read the body.

### Who

- Claude Code power user | Viewing session list in Norbert | Wants to drill into a specific session to see its events

### Solution

Clicking a session row navigates to a detail view showing the session metadata header and a chronological list of all hook events for that session. Each event shows its timestamp (time only), event type (e.g., PRE_TOOL_USE, POST_TOOL_USE, SESSION_START, STOP), and a payload snippet where meaningful (tool name, file path, prompt excerpt). A "Back to Sessions" link returns to the session list.

### Domain Examples

#### 1: Happy path -- Priya inspects her refactoring session

Priya clicks on the "refactor payment module" session (sess-def456, 134 events, 42m 18s). The view switches to show a session header with the start time, duration, and event count. Below the header, she sees 134 events listed chronologically: SESSION_START at 09:15:33, USER_PROMPT_SUBMIT at 09:15:35 with the prompt text truncated, then pairs of PRE_TOOL_USE and POST_TOOL_USE events showing tool names like "Read" and "Write" with file paths, and finally STOP at 09:57:51. She scrolls through the list to understand the session's tool call pattern.

#### 2: Edge case -- Priya views a very short session

Priya clicks on the "quick question" session (sess-ghi789, 8 events, 2m 05s). The event list is short: SESSION_START, USER_PROMPT_SUBMIT with "quick question about sorting", 2 pairs of PreToolUse/PostToolUse for Read calls, and STOP. The view renders cleanly even with just 8 events -- no empty space issue, no layout collapse.

#### 3: Error boundary -- Priya clicks a session that has no events

Priya sees a session "sess-empty" in her list. It was created by a SessionStart event but the session was aborted before any tool calls. When she clicks it, the session header shows "Events: 1" (just the SessionStart), and the event list shows that single event. If a session somehow has zero events (edge case), the view shows "No events recorded for this session."

### UAT Scenarios (BDD)

#### Scenario: Clicking a session shows its events chronologically

Given Priya sees the session "sess-def456" (refactor payment module) in the session list
And that session started at "2026-03-12T09:15:33Z" and ended at "2026-03-12T09:57:51Z"
And the session has 134 events
When Priya clicks on the "sess-def456" session row
Then she sees a session header showing start time, duration "42m 18s", and 134 events
And below the header she sees a chronological list of events
And the first event is SESSION_START at "09:15:33"
And the last event is STOP at "09:57:51"

#### Scenario: Event rows display type and relevant payload data

Given Priya is viewing events for session "sess-def456"
When she looks at a PRE_TOOL_USE event at "09:15:38"
Then she sees the event type "PRE_TOOL_USE" in uppercase
And she sees the tool name "Read" extracted from the event payload
And she sees a payload snippet "src/payment/processor.ts"

#### Scenario: Back navigation returns to session list

Given Priya is viewing events for session "sess-def456"
When she clicks "Back to Sessions"
Then the event detail view is replaced by the full session list
And the session list shows all sessions including any newly captured ones

#### Scenario: Short session renders cleanly

Given Priya clicks on session "sess-ghi789" which has 8 events
When the event detail view loads
Then she sees all 8 events in a compact list
And the layout does not collapse or show excessive empty space

#### Scenario: Event list is scrollable for sessions with many events

Given Priya clicks on session "sess-def456" which has 134 events
When the event list renders
Then the event list is vertically scrollable
And the session header remains fixed at the top while scrolling
And all 134 events are accessible by scrolling

### Acceptance Criteria

- [ ] Clicking a session row navigates to a detail view with session metadata header and event list
- [ ] Session header shows: start timestamp, duration, event count, completion status
- [ ] Events listed chronologically (oldest first within session)
- [ ] Each event row shows: timestamp (time only), event type (uppercase), payload snippet where meaningful
- [ ] PRE_TOOL_USE and POST_TOOL_USE events show tool name extracted from payload
- [ ] USER_PROMPT_SUBMIT events show truncated prompt text
- [ ] "Back to Sessions" navigation returns to the session list
- [ ] Event list is scrollable; session header stays fixed

### Technical Notes

- Requires new EventStore method: `get_events_for_session(session_id: &str) -> Result<Vec<HookEvent>, String>`
- Requires new IPC command: `get_session_events` that calls the new EventStore method
- SQL: `SELECT id, session_id, event_type, payload, received_at FROM events WHERE session_id = ? ORDER BY received_at ASC`
- Shared artifact: `session_events` (new query, HIGH integration risk)
- Payload snippet extraction: parse JSON payload for `tool` field (PreToolUse/PostToolUse) and prompt text (UserPromptSubmit)
- Frontend state: `selectedSessionId: string | null` controls which view is shown (list vs detail)

### Dependencies

- US-SEV-001 (Session list must exist to navigate from)
- US-SEV-003 (Design System Application) for styling
- Walking skeleton EventStore trait (new method extends existing trait)

### Job Story Trace

- Job 2: Inspect a Session's Events

---

## US-SEV-003: Design System Application

### Problem

Priya Chandrasekaran sees the walking skeleton's minimal status window with unstyled text. It works but it looks like a prototype -- plain text labels, no visual hierarchy, no personality. She finds it hard to trust a tool that does not look finished. Phase 2 is the moment Norbert should look like a real product, styled to match the norbert-mockup-v5 design system with glassmorphism, proper fonts, and a cohesive dark theme.

### Who

- Claude Code power user | Sees Norbert's UI daily | Expects a polished desktop app that feels intentional and trustworthy

### Solution

Apply the norbert-mockup-v5.html design system to the session list and event detail views. This includes: glassmorphism card styling for session and event rows, the Rajdhani font for UI labels and Share Tech Mono for data values, the Norbert dark theme color palette, status dot animations for live sessions, and consistent spacing and layout patterns.

### Domain Examples

#### 1: Happy path -- Session rows look like the mockup

Priya opens Norbert and sees session rows styled with subtle glass-effect borders, the monospace font for data values (timestamps, durations, event counts), and the teal/cyan brand color for active elements. Each row has a status dot that pulses green for live sessions. The overall look matches the Norbert brand identity from the mockup.

#### 2: Theme consistency -- All views share the same visual language

Priya navigates from the session list to an event detail view and back. Both views use the same color palette, fonts, card styling, and status bar. There are no visual jarring transitions -- it all feels like one cohesive application.

#### 3: Edge case -- Empty state is styled, not raw

Priya sees the empty state "No sessions captured yet" message. Even this minimal state uses the design system fonts and colors. The text is styled with the secondary text color (`--text-s`), not a raw browser default.

### UAT Scenarios (BDD)

#### Scenario: Session rows use glassmorphism card styling

Given Priya opens the Norbert window with sessions captured
When the session list renders
Then each session row has a subtle border using the design system card border color
And session rows have the glassmorphism background treatment
And hover state changes the border and background subtly

#### Scenario: Typography matches the design system

Given Priya views any part of the Norbert UI
When she reads text on screen
Then labels use the Rajdhani font family
And data values (timestamps, durations, counts) use the Share Tech Mono font
And section headers use uppercase with letter-spacing matching the design system

#### Scenario: Color scheme follows the Norbert dark theme

Given Priya has the default Norbert theme active
When she views the session list and event detail
Then the background uses the dark app background color
And primary text uses the light teal text color
And secondary text uses the muted text color
And the brand color (teal/cyan) is used for active elements and accents

### Acceptance Criteria

- [ ] CSS variables from norbert-mockup-v5.html imported and used for all UI styling
- [ ] Rajdhani font loaded for UI labels; Share Tech Mono loaded for data values
- [ ] Session rows styled with glassmorphism card pattern (`.srow` equivalent)
- [ ] Status dots animate for live sessions (pulsing green via `@keyframes lpulse`)
- [ ] Color palette matches the Norbert dark theme (teal brand, dark backgrounds, muted text)
- [ ] Empty state text uses design system typography and colors, not browser defaults
- [ ] Visual consistency between session list view and event detail view

### Technical Notes

- Import CSS variables from mockup: `--font-ui`, `--font-mono`, `--brand`, `--bg-app`, `--bg-card`, `--border-card`, `--text-p`, `--text-s`, `--text-m`, etc.
- Google Fonts link for Rajdhani and Share Tech Mono
- The mockup defines 5 theme variants (nb, cd, vd, cl, vl); Phase 2 only needs the default Norbert theme (`.theme-nb`)
- Session row class pattern mirrors `.srow`, `.sdot`, `.sname` from mockup
- Status bar mirrors `.statusbar` pattern from mockup
- Shared artifact: `design_system` from norbert-mockup-v5.html

### Dependencies

- norbert-mockup-v5.html available as design reference
- Walking skeleton app shell (Tauri + React)

### Job Story Trace

- Job 1: Browse My Session History (the list must look good to be useful)
- Job 2: Inspect a Session's Events (the event list must be readable)
