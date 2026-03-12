Feature: Session Event Viewer -- Browse Sessions and Inspect Events
  As a Claude Code power user who runs sessions with Norbert active,
  I want to see a list of my sessions and drill into their events,
  so I can understand what happened inside each session.

  Background:
    Given Priya has Norbert installed with hooks registered
    And the design system is active with the default Norbert theme

  # ===========================================================================
  # WALKING SKELETONS (2 scenarios)
  # ===========================================================================

  @walking_skeleton
  Scenario: Priya browses her session history and inspects a session's events
    Given Priya has completed a Claude Code session that lasted 42 minutes with 134 events
    When Priya opens the Norbert window
    Then she sees the session in the session list with its start time, duration "42m 18s", and "134" events
    When Priya clicks on that session
    Then she sees a chronological list of events starting with SESSION_START and ending with SESSION_END
    And she sees the tool name for each tool call event
    When Priya clicks "Back to Sessions"
    Then she sees the full session list again

  @walking_skeleton
  Scenario: Priya sees sessions from multiple tools displayed with tool-agnostic labels
    Given Priya has completed a Claude Code session with tool call and prompt events
    When Priya views the session's events
    Then event types are displayed as canonical labels like "TOOL_CALL_START" and "PROMPT_SUBMIT"
    And no provider-specific labels like "PreToolUse" or "UserPromptSubmit" appear anywhere in the display

  # ===========================================================================
  # US-SEV-001: SESSION LIST VIEW (7 scenarios)
  # ===========================================================================

  # --- Happy Path ---

  @US-SEV-001
  Scenario: Session list shows all captured sessions ordered most-recent-first
    Given Priya has completed 3 Claude Code sessions:
      | started_at               | ended_at                 | events |
      | 2026-03-12T14:23:01Z     |                          | 47     |
      | 2026-03-12T09:15:33Z     | 2026-03-12T09:57:51Z     | 134    |
      | 2026-03-11T16:44:12Z     | 2026-03-11T16:46:17Z     | 8      |
    When Priya opens the Norbert window
    Then she sees 3 session rows in the session list
    And the most recent session appears at the top
    And each session row shows start timestamp, duration, and event count

  @US-SEV-001
  Scenario: Completed session shows formatted duration and dim status indicator
    Given Priya has a completed session that started at "2026-03-12T09:15:33Z" and ended at "2026-03-12T09:57:51Z"
    When Priya views the session list
    Then the session row shows duration "42m 18s"
    And the session row shows a dim completed status indicator

  @US-SEV-001
  Scenario: Active session shows live indicator and elapsed duration
    Given Priya has an active Claude Code session that started at "2026-03-12T14:23:01Z" with 47 events so far
    When Priya views the session list
    Then the session shows a pulsing live status indicator
    And the duration shows elapsed time since session start

  @US-SEV-001
  Scenario: Session list updates when new sessions arrive
    Given Priya has the Norbert window open showing 2 sessions
    And a new Claude Code session starts generating events
    When the next data refresh completes
    Then a third session appears at the top of the list

  # --- Error / Edge Paths ---

  @US-SEV-001
  Scenario: Empty state when no sessions have been captured
    Given Priya has installed Norbert but has not run any Claude Code sessions
    When she opens the Norbert window
    Then she sees a message "No sessions captured yet"
    And the message includes guidance to run a Claude Code session
    And the interface does not look broken or error-like

  @US-SEV-001
  Scenario: Session with zero-length duration displays correctly
    Given Priya has a completed session that started and ended at "2026-03-12T10:00:00Z"
    When Priya views the session list
    Then the session row shows duration "0s"
    And no display error or blank value appears

  @US-SEV-001
  Scenario: Session list remains responsive after many sessions accumulate
    Given Priya has 50 completed sessions in her history
    When she opens the Norbert window
    Then all 50 sessions appear in the session list
    And the list is scrollable

  # ===========================================================================
  # US-SEV-002: EVENT DETAIL VIEW (8 scenarios)
  # ===========================================================================

  # --- Happy Path ---

  @US-SEV-002
  Scenario: Clicking a session shows its events chronologically
    Given Priya sees a completed session with 134 events in the session list
    And the session started at "2026-03-12T09:15:33Z" and ended at "2026-03-12T09:57:51Z"
    When Priya clicks on that session row
    Then she sees a session header showing start time, duration "42m 18s", and "134" events
    And below the header she sees a chronological list of events
    And the first event is SESSION_START at "09:15:33"
    And the last event is SESSION_END at "09:57:51"

  @US-SEV-002
  Scenario: Tool call events display the tool name from the payload
    Given Priya is viewing events for a session
    When she looks at a TOOL_CALL_START event at "09:15:38"
    Then she sees the tool name "Read" extracted from the event
    And she sees a payload snippet showing the relevant file path

  @US-SEV-002
  Scenario: Prompt events display truncated prompt text
    Given Priya is viewing events for a session
    When she looks at a PROMPT_SUBMIT event
    Then she sees a truncated preview of the prompt text

  @US-SEV-002
  Scenario: Event list is scrollable with fixed session header
    Given Priya clicks on a session which has 134 events
    When the event list renders
    Then the event list is vertically scrollable
    And the session header remains fixed at the top while scrolling
    And all 134 events are accessible by scrolling

  # --- Navigation ---

  @US-SEV-002
  Scenario: Back navigation returns to session list
    Given Priya is viewing events for a session
    When she clicks "Back to Sessions"
    Then the event detail view is replaced by the full session list
    And the session list reflects any sessions captured since she last viewed it

  @US-SEV-002
  Scenario: Navigating to a different session shows its events
    Given Priya has returned to the session list from viewing one session
    When she clicks on a different session with 8 events
    Then the event detail view loads with events for the newly selected session
    And the session header shows the metadata for the newly selected session

  # --- Error / Edge Paths ---

  @US-SEV-002
  Scenario: Session with only a start event shows minimal event list
    Given Priya has a session that was started but immediately aborted
    And the session has only 1 event (SESSION_START)
    When she clicks on that session
    Then the session header shows "1" event
    And the event list shows the single SESSION_START event

  @US-SEV-002
  Scenario: Session with no events shows empty event message
    Given Priya has a session that somehow has zero events recorded
    When she clicks on that session
    Then she sees the session header with its metadata
    And the event list shows "No events recorded for this session"

  # ===========================================================================
  # US-SEV-003: DESIGN SYSTEM (4 scenarios)
  # ===========================================================================

  # --- Happy Path ---

  @US-SEV-003
  Scenario: Session rows use glassmorphism card styling
    Given Priya opens the Norbert window with sessions captured
    When the session list renders
    Then each session row has the glassmorphism card styling from the design system
    And hover state changes the border and background subtly

  @US-SEV-003
  Scenario: Typography follows the design system font families
    Given Priya views any part of the Norbert interface
    When she reads text on screen
    Then labels use the Rajdhani font family
    And data values like timestamps, durations, and counts use the Share Tech Mono font

  @US-SEV-003
  Scenario: Visual consistency between session list and event detail views
    Given Priya navigates from the session list to an event detail view and back
    Then both views use the same color palette, fonts, and card styling
    And there are no jarring visual transitions between views

  # --- Error / Edge Path ---

  @US-SEV-003
  Scenario: Empty state text uses design system styling
    Given Priya sees the "No sessions captured yet" empty state
    Then the text uses the design system typography and colors
    And the message does not appear as raw unstyled browser text

  # ===========================================================================
  # PROVIDER ABSTRACTION BOUNDARY (3 scenarios)
  # ===========================================================================

  @property @provider-boundary
  Scenario: Canonical event types are tool-agnostic throughout the display
    Given any session with events from any provider
    When the events are displayed in the event detail view
    Then all event types use canonical labels (SESSION_START, SESSION_END, TOOL_CALL_START, TOOL_CALL_END, AGENT_COMPLETE, PROMPT_SUBMIT)
    And no provider-specific event names appear in the user interface

  @provider-boundary
  Scenario: Provider normalizes unknown event types gracefully
    Given a Claude Code session emits an unrecognized hook event type
    When the event is received by Norbert
    Then the unrecognized event is rejected
    And previously captured events for that session remain intact

  @provider-boundary
  Scenario: Events from different sessions are correctly isolated
    Given Priya has 2 completed sessions with different events
    When she views the events for the first session
    Then she sees only events belonging to that session
    And no events from the second session appear
