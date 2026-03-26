Feature: Hook Receiver Clarity
  # Platform: Windows desktop (Rust sidecar binary)
  # Persona: Danielle Reyes — developer using Norbert on Windows daily
  # Driving port: norbert-hook-receiver.exe binary (process spawn) +
  #               HTTP server at POST /hooks/:event_type (event count validation)
  # Goal: Danielle can identify, monitor, and gracefully stop the hook receiver
  #       without confusion or guesswork
  # Emotional arc: Confused -> Orienting -> Confident

  # ───────────────────────────────────────────────────────────────────────────
  # WALKING SKELETONS
  # Each answers: "Can Danielle accomplish this goal and see the result?"
  # ───────────────────────────────────────────────────────────────────────────

  @walking_skeleton
  Scenario: ws_01 Danielle identifies the sidecar at a glance in Task Manager
    Given norbert-hook-receiver.exe is present on Danielle's machine
    When Danielle opens Windows Task Manager and looks at the Description column
    Then the hook receiver shows "Norbert Hook Receiver" in the Description column
    And norbert.exe shows "Norbert" in the Description column
    And Danielle can tell the two processes apart without expanding any extra columns

  @walking_skeleton
  Scenario: ws_02 Danielle monitors the running sidecar and quits it gracefully
    Given Danielle starts norbert-hook-receiver.exe on her machine
    And the sidecar successfully binds to its port
    When Danielle sees the tray icon, hovers over it for status, then clicks Quit
    Then the tray icon disappears from the system tray
    And the process exits cleanly
    And the bound port is released within 1 second

  # ───────────────────────────────────────────────────────────────────────────
  # PROCESS IDENTITY / VERSIONINFO (US-HRC-01)
  # ───────────────────────────────────────────────────────────────────────────

  Scenario: versioninfo_01 FileDescription is embedded in the hook receiver binary at rest
    Given norbert-hook-receiver.exe is present on disk but not running
    When the binary file properties are inspected
    Then the File description field reads "Norbert Hook Receiver"

  Scenario: versioninfo_02 ProductName is embedded in the hook receiver binary at rest
    Given norbert-hook-receiver.exe is present on disk but not running
    When the binary file properties are inspected
    Then the Product name field reads "Norbert"

  Scenario: versioninfo_03 Main GUI binary metadata is unchanged after this feature ships
    Given a fresh build of norbert.exe has been produced
    When the file properties of norbert.exe are inspected
    Then the File description field still reads "Norbert"
    And no regression has been introduced to the main GUI binary metadata

  # ───────────────────────────────────────────────────────────────────────────
  # TRAY PRESENCE AND STATUS (US-HRC-02)
  # ───────────────────────────────────────────────────────────────────────────

  Scenario: tray_01 Tray icon appears within 2 seconds of process startup
    Given norbert-hook-receiver.exe is started on Danielle's machine
    When the hook receiver successfully binds to its port
    Then the "Norbert Hook Receiver" tray icon is visible in the system tray
    And the icon appears within 2 seconds of the process starting

  Scenario: tray_02 Tray tooltip shows live port and event count
    Given norbert-hook-receiver.exe is running and has captured 42 telemetry events
    When Danielle hovers over the tray icon
    Then the tooltip displays "Norbert Hook Receiver"
    And the tooltip displays the bound port (":3748")
    And the tooltip displays the event count ("42 events")

  Scenario: tray_03 Tray context menu shows status header, port, event count, and Quit
    Given norbert-hook-receiver.exe is running on port 3748 with 42 events captured
    When Danielle right-clicks the tray icon
    Then the context menu shows "Norbert Hook Receiver" as a non-clickable header
    And the menu shows "Port: 3748"
    And the menu shows "Events captured: 42"
    And the menu contains a clickable "Quit" item

  Scenario: tray_04 Event count in tooltip reflects the live counter
    Given norbert-hook-receiver.exe was showing 42 events in the tray tooltip
    When 3 more telemetry events are captured by the hook receiver
    And Danielle hovers over the tray icon again
    Then the tooltip now shows "45 events"

  # ───────────────────────────────────────────────────────────────────────────
  # GRACEFUL SHUTDOWN (US-HRC-02)
  # ───────────────────────────────────────────────────────────────────────────

  Scenario: shutdown_01 Graceful shutdown via tray Quit with no pending writes
    Given norbert-hook-receiver.exe is running with no pending writes in flight
    When Danielle clicks "Quit" in the tray context menu
    Then the tray icon disappears from the system tray
    And port 3748 is released within 1 second
    And the process exits with code 0

  Scenario: shutdown_02 Graceful shutdown waits for a pending write that completes within the drain window
    Given norbert-hook-receiver.exe has a write in flight that completes within 2 seconds
    When Danielle clicks "Quit" in the tray context menu
    Then the process waits for the write to complete before exiting
    And the tray icon disappears after the write completes
    And the process exits with code 0

  Scenario: shutdown_03 Forced exit when drain exceeds timeout, with warning logged
    Given norbert-hook-receiver.exe has a write in flight that will not complete within the drain window
    When Danielle clicks "Quit" in the tray context menu
    Then the process waits the full drain window
    And the process exits anyway with code 0
    And a warning is recorded in the application log indicating the drain did not complete

  # ───────────────────────────────────────────────────────────────────────────
  # ERROR / EDGE PATHS (US-HRC-01, US-HRC-02)
  # 5 of 17 total = 29%
  # (Domain has narrow error surface: binary metadata is static; tray state
  #  is atomic; the only runtime error paths are port conflict and drain timeout)
  # ───────────────────────────────────────────────────────────────────────────

  Scenario: error_01 Tray icon appears with "Port: unavailable" when port bind fails
    Given port 3748 is already occupied by another process on Danielle's machine
    When norbert-hook-receiver.exe starts up
    Then the tray icon still appears in the system tray
    And the tray tooltip shows "Norbert Hook Receiver" and "Port: unavailable"

  Scenario: error_02 Context menu shows "Port: unavailable" when port bind fails
    Given port 3748 is already occupied by another process on Danielle's machine
    And norbert-hook-receiver.exe has started
    When Danielle right-clicks the tray icon
    Then the context menu shows "Port: unavailable" in the port field

  Scenario: error_03 Event count is not incremented when a hook write fails
    Given norbert-hook-receiver.exe is running with 0 events captured
    And the storage layer will reject the next write
    When a hook event is submitted to the hook receiver
    Then the event count remains 0
    And the tray tooltip still shows "0 events"

  Scenario: error_04 Process exits with code 0 even after a forced drain timeout
    Given norbert-hook-receiver.exe has a write in flight that will outlast the drain window
    When Danielle clicks "Quit" and the drain window elapses without completion
    Then the process exits with code 0
    And the tray icon is removed from the system tray

  Scenario: error_05 Event count resets to 0 on fresh process start
    Given norbert-hook-receiver.exe previously captured 50 events and then exited
    When norbert-hook-receiver.exe is started fresh
    Then the tray tooltip shows "0 events"
