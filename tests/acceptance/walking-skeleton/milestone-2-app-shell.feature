Feature: App Shell -- Tauri window, system tray icon, and status display
  As a Claude Code power user,
  I want an always-on desktop presence that shows me Norbert's status at a glance,
  so I can confirm the app is alive without interrupting my workflow.

  @skip
  Scenario: Tray icon appears on launch
    Given Priya launches Norbert on Windows 11
    When the application starts
    Then the Norbert icon appears in the system tray
    And the icon tooltip shows "Norbert v0.1.0"

  @skip
  Scenario: Clicking tray icon opens the status window
    Given Norbert is running with the tray icon visible
    When Priya clicks the Norbert tray icon
    Then the main window opens
    And it displays "NORBERT v0.1.0"
    And it shows "Status: Listening"
    And it shows "Port: 3748"
    And it shows "Sessions: 0"
    And it shows "Events: 0"

  @skip
  Scenario: Closing window keeps Norbert running
    Given the Norbert main window is open
    When Priya closes the window
    Then the window closes
    And the tray icon remains visible
    And the hook receiver continues accepting events

  @skip
  Scenario: Clicking tray icon toggles window open and closed
    Given the Norbert main window is open
    When Priya clicks the tray icon
    Then the window closes
    When Priya clicks the tray icon again
    Then the window reopens

  @skip
  Scenario: Empty state is clear and inviting
    Given Priya has just launched Norbert for the first time
    And no Claude Code sessions have occurred yet
    When she opens the main window
    Then she sees "Waiting for first Claude Code session..." as the empty state message
    And the interface does not appear broken or error-like

  @skip
  Scenario: Tray icon persists after window close and reopen
    Given Priya has opened and closed the Norbert window multiple times
    When she checks the system tray
    Then the Norbert icon is still present
    And clicking it opens the window with current status
