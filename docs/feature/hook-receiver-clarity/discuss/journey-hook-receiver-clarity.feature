Feature: Hook Receiver Clarity
  # Platform: Windows desktop (Tauri + Rust sidecar)
  # Persona: Danielle Reyes — developer using Norbert on Windows daily
  # Goal: Danielle can identify, monitor, and gracefully stop the hook receiver
  #       without confusion or guesswork
  # Emotional arc: Anxious/Confused -> Orienting -> Confident/Reassured

  # ─────────────────────────────────────────────────────────────────────────
  # Part 1: Process Identity (VERSIONINFO FileDescription)
  # Job Story JS-01: Distinguish hook receiver from main GUI in Task Manager
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Task Manager shows distinct FileDescription for hook receiver
    Given norbert.exe and norbert-hook-receiver.exe are both running on Danielle's machine
    When Danielle opens Windows Task Manager and views the Processes or Details tab
    Then norbert-hook-receiver.exe shows "Norbert Hook Receiver" in the Description column
    And norbert.exe shows "Norbert" in the Description column
    And Danielle can distinguish the two processes without clicking on either one

  Scenario: FileDescription is embedded in the binary, not dependent on runtime
    Given norbert-hook-receiver.exe is present on disk but not running
    When Danielle right-clicks the file and opens Properties -> Details
    Then the File description field reads "Norbert Hook Receiver"
    And the Product name field reads "Norbert"

  Scenario: Main GUI FileDescription is unchanged by this feature
    Given the norbert.exe main GUI binary has been built
    When Danielle inspects its file properties
    Then the File description field still reads "Norbert"
    And no regression is introduced to the main GUI binary metadata

  # ─────────────────────────────────────────────────────────────────────────
  # Part 2: System Tray Icon
  # Job Story JS-02: Monitor and control hook receiver from system tray
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Hook receiver displays tray icon on startup
    Given Danielle's machine starts up and the Startup shortcut runs norbert-hook-receiver.exe
    When the hook receiver successfully binds to port 3748
    Then a tray icon for "Norbert Hook Receiver" appears in the Windows system tray
    And the icon appears within 2 seconds of the process starting

  Scenario: Tray tooltip shows live port and event count
    Given norbert-hook-receiver.exe is running and has captured 42 telemetry events
    When Danielle hovers over the tray icon
    Then the tooltip displays "Norbert Hook Receiver"
    And the tooltip displays the bound port (e.g. ":3748")
    And the tooltip displays the event count (e.g. "42 events")

  Scenario: Tray context menu shows status and quit option
    Given norbert-hook-receiver.exe is running on port 3748 with 42 events captured
    When Danielle right-clicks the tray icon
    Then a context menu appears with title "Norbert Hook Receiver" as a non-clickable header
    And the menu shows "Port: 3748"
    And the menu shows "Events captured: 42"
    And the menu contains a clickable "Quit" item

  Scenario: Event count in tooltip reflects live counter
    Given norbert-hook-receiver.exe was showing 42 events in the tray tooltip
    When the hook receiver captures 3 more telemetry events
    And Danielle hovers over the tray icon again
    Then the tooltip now shows "45 events"

  # ─────────────────────────────────────────────────────────────────────────
  # Graceful Shutdown
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Graceful shutdown via tray Quit
    Given norbert-hook-receiver.exe is running with no pending SQLite writes in flight
    When Danielle clicks "Quit" in the tray context menu
    Then the tray icon disappears from the system tray
    And port 3748 is released within 1 second
    And the process exits with code 0

  Scenario: Graceful shutdown flushes pending SQLite writes
    Given norbert-hook-receiver.exe has a SQLite write in flight that completes within 2 seconds
    When Danielle clicks "Quit" in the tray context menu
    Then the process waits for the SQLite write to complete before exiting
    And the tray icon disappears after the write completes
    And the process exits with code 0

  Scenario: Forced exit on slow SQLite drain
    Given norbert-hook-receiver.exe has a SQLite write that is taking longer than 2 seconds
    When Danielle clicks "Quit" in the tray context menu
    Then the process waits up to 2 seconds for the write to complete
    And if the write does not complete within 2 seconds the process exits anyway
    And a warning entry is written to the application log indicating an incomplete drain

  # ─────────────────────────────────────────────────────────────────────────
  # Error / Anxiety Paths
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Tray tooltip shows unavailable when port bind fails
    Given norbert-hook-receiver.exe cannot bind to port 3748 due to a port conflict
    When the hook receiver starts
    Then the tray icon still appears in the system tray
    And the tray tooltip shows "Norbert Hook Receiver" and "Port: unavailable"
    And the tray context menu shows "Port: unavailable"

  @property
  Scenario: Tray icon presence matches process health
    Given norbert-hook-receiver.exe is running
    Then the tray icon is visible in the Windows system tray
    And when the process exits for any reason the tray icon is removed
