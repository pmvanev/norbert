Feature: Walking Skeleton -- Install to First Confirmed Data
  As a Claude Code power user who spends money on AI sessions with no visibility,
  I want to install Norbert and confirm the full data pipeline works end-to-end,
  so I can trust the platform before exploring its features.

  Background:
    Given Priya Chandrasekaran uses Claude Code daily for multi-agent development sessions
    And she spends approximately $15-30 per week on API costs
    And she has no current tool for observing what happens inside her sessions

  # --- Step 1: Install Norbert ---

  Scenario: Successful installation via npm on Windows 11
    Given Priya has Node.js 18+ installed on her Windows 11 machine
    And she has a working internet connection
    When she runs "npm install -g norbert-cc" in her terminal
    Then the norbert-cc package installs without errors
    And the postinstall script downloads the Windows x64 binary from GitHub Releases
    And the binary is extracted to ~/.norbert/bin/
    And "norbert-cc" is available as a command in her PATH

  Scenario: Installation fails gracefully on network error
    Given Priya has Node.js 18+ installed on her Windows 11 machine
    And her internet connection drops during postinstall binary download
    When the binary download fails
    Then Priya sees an error message: "Failed to download Norbert binary. Check your network connection and try again."
    And no partial files are left in ~/.norbert/bin/
    And she can retry by running "norbert-cc" again

  # --- Step 2: First Launch and Settings Merge ---

  Scenario: First launch with existing settings.json
    Given Priya has installed norbert-cc
    And she has an existing ~/.claude/settings.json with the following content:
      """
      {
        "permissions": { "allow": ["Read", "Write"] },
        "mcpServers": { "github": { "type": "stdio", "command": "mcp-github" } }
      }
      """
    When Priya runs "norbert-cc" for the first time
    Then Norbert creates the ~/.norbert/ directory
    Then Norbert backs up the original settings.json to ~/.norbert/settings.json.bak
    And the backup is byte-identical to the original
    And Norbert merges hook configuration into settings.json
    And Priya's existing permissions and mcpServers entries are preserved exactly
    And the merged settings.json contains Norbert's hook entries for PreToolUse, PostToolUse, SubagentStop, Stop, SessionStart, and UserPromptSubmit
    And all hook entries point to "http://localhost:3748/hooks/{event_type}"

  Scenario: First launch creates SQLite database with WAL mode
    Given Priya runs "norbert-cc" for the first time
    When the application initializes
    Then Norbert creates ~/.norbert/norbert.db
    And the database has WAL journal mode enabled
    And the database has NORMAL synchronous mode
    And the core schema includes tables for sessions and events

  Scenario: First launch shows tray icon and listening status
    Given Priya runs "norbert-cc" for the first time
    When the application initializes successfully
    Then the Norbert icon appears in the Windows system tray
    And clicking the tray icon opens the Norbert main window
    And the main window displays "NORBERT v0.1.0"
    And the main window shows "Status: Listening"
    And the main window shows "Port: 3748"
    And the main window shows "Sessions: 0"
    And the main window shows "Events: 0"

  Scenario: First launch notification prompts Claude Code restart
    Given Priya has launched Norbert for the first time
    When the settings merge completes successfully
    Then a Windows notification appears with title "Norbert"
    And the notification body reads "Hooks registered. Restart any running Claude Code sessions for hooks to take effect."
    And the Norbert dashboard shows a persistent banner with the same restart message
    And the banner remains visible until Norbert receives its first hook event

  Scenario: First launch with no existing settings.json
    Given Priya has installed norbert-cc
    And the file ~/.claude/settings.json does not exist
    When Priya runs "norbert-cc" for the first time
    Then Norbert creates ~/.claude/settings.json with hook configuration only
    And no backup file is created (there was nothing to back up)
    And the tray icon and main window appear normally

  Scenario: First launch with malformed settings.json
    Given Priya has installed norbert-cc
    And ~/.claude/settings.json contains invalid JSON
    When Priya runs "norbert-cc" for the first time
    Then Norbert does not modify the malformed settings.json
    And a warning notification appears: "settings.json contains invalid JSON. Norbert cannot register hooks automatically. Please fix the file and relaunch Norbert."
    And the main window shows "Status: Listening (hooks not registered)"
    And Norbert is otherwise functional (database created, tray icon visible)

  Scenario: First launch with port 3748 already in use
    Given Priya has installed norbert-cc
    And another process is already listening on port 3748
    When Priya runs "norbert-cc"
    Then Norbert displays an error: "Port 3748 is in use by another process. Norbert cannot start the hook receiver."
    And the main window shows "Status: Error - port unavailable"
    And the tray icon indicates an error state

  # --- Step 3: Hook Events Flow During Session ---

  Scenario: Hook events received and stored during Claude Code session
    Given Norbert is running with hooks registered in settings.json
    And Priya starts a new Claude Code session
    When Claude Code processes her prompt "Help me refactor the payment module"
    And Claude Code makes 12 tool calls including Read, Write, and Bash
    Then Norbert receives at least 24 hook events (PreToolUse + PostToolUse for each tool call)
    And each event is stored in the SQLite events table with a timestamp
    And each event is attributed to the correct session
    And Claude Code's response time is not measurably affected by hook processing

  Scenario: Hooks configured as async do not block Claude Code
    Given Norbert is running with hooks registered
    When Claude Code sends a hook event to Norbert
    Then the hook is configured with "async: true" in settings.json
    And Claude Code does not wait for Norbert's response before continuing
    And the event is processed and stored by Norbert independently

  # --- Step 4: Live Status During Session ---

  Scenario: Tray icon transitions to active state on first event
    Given Norbert is running and showing "Status: Listening"
    When the first hook event arrives from a Claude Code session
    Then the tray icon transitions to the "active session" visual state
    And the tray tooltip updates to show "Session active - 1 event"
    And the first-launch restart banner dismisses automatically

  Scenario: Event count increments in real time
    Given Norbert is receiving hook events from an active Claude Code session
    And the main window is open
    When a new hook event arrives
    Then the event count displayed in the main window increments within 1 second
    And the tray tooltip updates with the new count

  # --- Step 5: Session Record Visible After Session ---

  Scenario: Session record displayed after session completes
    Given Priya ran a Claude Code session that produced 47 hook events over 12 minutes
    And Claude Code has ended the session (Stop event received by Norbert)
    When Priya opens the Norbert main window
    Then the status shows "Listening" (session ended, ready for next)
    And "Sessions: 1" is displayed
    And "Events: 47" is displayed
    And the last session shows the correct start timestamp
    And the last session shows "Duration: 12m 34s"
    And the last session shows "Events: 47"

  Scenario: Multiple sessions accumulate correctly
    Given Priya has run 3 Claude Code sessions today
    And the sessions produced 47, 23, and 89 events respectively
    When Priya opens the Norbert main window
    Then "Sessions: 3" is displayed
    And "Events: 159" is displayed (total across all sessions)
    And the last session entry shows the most recent session's details

  # --- Error Recovery ---

  Scenario: Norbert recovers after being restarted mid-session
    Given Norbert was receiving events from a Claude Code session
    And Priya accidentally closes Norbert
    When Priya relaunches Norbert
    Then the HTTP server starts again on port 3748
    And new hook events from the ongoing session are captured
    And the pre-restart events are still in the database
    And the session record reflects the combined event count

  # --- Pipeline Integrity ---

  @property
  Scenario: No hook events are silently dropped under normal operation
    Given Norbert is running and receiving hook events
    Then every HTTP POST to localhost:3748/hooks/{event_type} receives a 200 response
    And every received event is persisted to SQLite before the response is sent
    And the event count in the database matches the number of successful HTTP responses
