Feature: Session Event Viewer -- Browse Sessions and Inspect Events
  As a Claude Code power user who runs sessions with Norbert active,
  I want to see a list of my sessions and drill into their events,
  so I can understand what happened inside each session.

  Background:
    Given Priya Chandrasekaran uses Claude Code daily for multi-agent development sessions
    And Norbert is installed with hooks registered and the walking skeleton fully operational
    And the UI is styled with the norbert-mockup-v5 glassmorphism design system

  # --- Step 1: Session List ---

  Scenario: Session list displays all captured sessions
    Given Priya has run 3 Claude Code sessions today with Norbert active
    And the sessions are:
      | session_id  | prompt                          | started_at               | ended_at                 | events |
      | sess-abc123 | nw:deliver -- user-auth         | 2026-03-12T14:23:01Z     |                          | 47     |
      | sess-def456 | refactor payment module         | 2026-03-12T09:15:33Z     | 2026-03-12T09:57:51Z     | 134    |
      | sess-ghi789 | quick question about sorting    | 2026-03-11T16:44:12Z     | 2026-03-11T16:46:17Z     | 8      |
    When Priya opens the Norbert window
    Then she sees 3 session rows in the session list
    And the sessions are ordered most-recent-first
    And session "sess-abc123" appears first with a green pulsing status dot
    And session "sess-def456" appears second with a dim completed status dot
    And session "sess-ghi789" appears third

  Scenario: Each session row shows key metadata
    Given Priya has a completed session "sess-def456" that started at "2026-03-12T09:15:33Z"
    And the session ended at "2026-03-12T09:57:51Z" with 134 events
    When Priya views the session list
    Then the session row for "sess-def456" shows the start time "2026-03-12 09:15:33"
    And it shows duration "42m 18s"
    And it shows event count "134 events"

  Scenario: Active session shows live indicator
    Given Priya has an active Claude Code session "sess-abc123"
    And the session started at "2026-03-12T14:23:01Z" with no ended_at
    When Priya views the session list
    Then session "sess-abc123" shows a green pulsing status dot
    And the session row uses the live session styling

  Scenario: Empty state when no sessions exist
    Given Priya has installed Norbert but has not run any Claude Code sessions
    When she opens the Norbert window
    Then she sees a message "No sessions captured yet"
    And the message includes guidance to run a Claude Code session
    And the interface does not look broken or error-like

  Scenario: Session list updates on poll
    Given Priya has the Norbert window open showing 2 sessions
    And she runs a new Claude Code session that generates a SessionStart event
    When the next poll cycle completes (within 1 second)
    Then the session list shows 3 sessions
    And the new session appears at the top of the list

  # --- Step 2: Event Detail View ---

  Scenario: Clicking a session shows its events
    Given Priya sees the session "sess-def456" (refactor payment module) in the session list
    And that session has 134 events
    When Priya clicks on the "sess-def456" session row
    Then the session list is replaced by a session detail view
    And the detail view shows a header with session metadata:
      | field    | value                          |
      | Started  | 2026-03-12 09:15:33            |
      | Duration | 42m 18s                        |
      | Events   | 134                            |
      | Status   | completed                      |
    And below the header she sees a scrollable list of 134 events
    And the events are ordered chronologically (oldest first)

  Scenario: Event rows show type, timestamp, and payload snippet
    Given Priya is viewing events for session "sess-def456"
    When she looks at the event list
    Then each event row shows the event timestamp as time-only (e.g., "09:15:38")
    And each event row shows the event type in uppercase (e.g., "PRE_TOOL_USE")
    And PRE_TOOL_USE and POST_TOOL_USE events show the tool name extracted from the payload
    And USER_PROMPT_SUBMIT events show a truncated preview of the prompt text

  Scenario: First and last events of a completed session
    Given Priya is viewing events for the completed session "sess-def456"
    When she scrolls through the event list
    Then the first event is SESSION_START at "09:15:33"
    And the last event is STOP at "09:57:51"

  Scenario: Event list for a session with many events is scrollable
    Given Priya clicks on session "sess-def456" which has 134 events
    When the event list renders
    Then the event list is scrollable
    And all 134 events are accessible by scrolling
    And the session header remains fixed at the top

  Scenario: Event list for a session with no events
    Given Priya has a session "sess-empty" that was created but received no events
    When she clicks on "sess-empty" in the session list
    Then she sees the session header with its metadata
    And the event list shows "No events recorded for this session"

  # --- Step 3: Navigation ---

  Scenario: Back navigation returns to session list
    Given Priya is viewing events for session "sess-def456"
    When she clicks "Back to Sessions"
    Then the event detail view is replaced by the full session list
    And the session list shows all sessions

  Scenario: Selecting a different session from the list
    Given Priya has returned to the session list from viewing "sess-def456"
    When she clicks on session "sess-ghi789"
    Then the event detail view loads with events for "sess-ghi789"
    And the session header shows the metadata for "sess-ghi789"

  # --- Design System Compliance ---

  Scenario: Session rows use glassmorphism design system
    Given Priya opens the Norbert window
    When the session list renders
    Then session rows use the glassmorphism card styling from the design system
    And text uses the Rajdhani UI font for labels and Share Tech Mono for data values
    And the color scheme follows the active theme (Norbert dark by default)
    And status dots use the brand color for live and muted color for completed

  # --- Pipeline Integrity ---

  @property
  Scenario: Session list data matches database contents
    Given Norbert has sessions and events stored in SQLite
    Then the session count displayed in the session list matches SELECT COUNT(*) FROM sessions
    And each session's event count matches SELECT COUNT(*) FROM events WHERE session_id = ?
    And session ordering matches ORDER BY started_at DESC
