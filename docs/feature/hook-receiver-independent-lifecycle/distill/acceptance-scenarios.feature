Feature: Hook Receiver Independent Lifecycle
  As a developer using Norbert to observe Claude Code sessions,
  the hook receiver should run independently of the GUI
  so that hook events are captured even when the GUI is closed.

  # === WALKING SKELETONS ===

  @walking_skeleton
  Scenario: Install registers startup task and confirms to user
    Given Phil installs Norbert on a fresh Windows machine
    And binaries are placed in the Norbert install directory
    When the installer registers the hook receiver for automatic startup
    Then the startup task targets the hook receiver binary in the install directory
    And the startup task is configured to run at user logon
    And the install output confirms "Startup task registered"

  @walking_skeleton
  Scenario: Hook receiver captures events without the GUI running
    Given the hook receiver is running independently since system startup
    And the Norbert GUI is not open
    When Claude Code sends session and tool-use events
    Then all events are captured and persisted
    And no GUI process is required for data collection

  @walking_skeleton
  Scenario: User opens GUI and sees data captured while GUI was closed
    Given the hook receiver has been collecting events since system startup
    And 3 sessions with 47 events have been captured without the GUI
    When Phil opens the Norbert GUI
    Then the GUI displays all 3 sessions and 47 events
    And no additional hook receiver process is started

  # === US-HRIL-01: STARTUP REGISTRATION ===

  Scenario: Registration builds correct task parameters from install directory
    Given the Norbert install directory is "C:\Users\Phil\.norbert\bin"
    When the startup task parameters are built
    Then the task name is "NorbertHookReceiver"
    And the task target path is "C:\Users\Phil\.norbert\bin\norbert-hook-receiver.exe"

  Scenario: Registration is idempotent on reinstall
    Given a startup task named "NorbertHookReceiver" already exists
    When the installer registers the startup task again
    Then exactly one task named "NorbertHookReceiver" exists
    And the task target points to the current binary path

  Scenario: Install output confirms startup task registration
    Given the installer has successfully registered the startup task
    When the install success message is generated
    Then the output includes "Startup task registered"

  Scenario: Install success message guides user to start receiver or reboot
    When the install success message is generated
    Then the output includes guidance to start the hook receiver manually
    And the output mentions automatic startup on reboot

  Scenario: Task registration command specifies user logon trigger
    Given the Norbert install directory is "C:\Users\Phil\.norbert\bin"
    When the startup task registration command is built
    Then the command includes a logon trigger for the current user

  @property
  Scenario: Task target path always matches the install directory binary
    Given any valid Norbert install directory
    When the startup task parameters are built
    Then the task target path matches the hook receiver binary inside that directory

  # === US-HRIL-01: ERROR PATHS ===

  Scenario: Registration failure is non-fatal and install completes
    Given Phil installs Norbert on a machine where startup registration is denied
    When the installer attempts to register the startup task
    Then the install output includes "Could not register startup task (non-fatal)"
    And the install completes successfully with exit code 0

  Scenario: Registration on unsupported platform is skipped
    Given the installer runs on a non-Windows platform
    When the installer checks whether to register a startup task
    Then startup registration is skipped without error

  Scenario: Registration with missing binary path produces clear feedback
    Given the Norbert install directory does not contain the hook receiver binary
    When the installer attempts to register the startup task
    Then the install output warns about the missing binary
    And the install completes without crashing

  Scenario: Registration handles special characters in home directory path
    Given the Norbert install directory contains spaces or special characters
    When the startup task parameters are built
    Then the task target path is properly quoted for the operating system

  # === US-HRIL-02: SINGLETON BEHAVIOR ===

  Scenario: First hook receiver instance starts and reports listening
    Given no hook receiver process is running
    And the receiver port is available
    When the hook receiver starts
    Then the receiver reports "listening on 127.0.0.1:3748"

  Scenario: Receiver exit message identifies port conflict clearly
    Given a hook receiver is already running on port 3748
    When a second hook receiver instance attempts to start
    Then the second instance reports "Port 3748 unavailable"

  Scenario: Port conflict exit uses appropriate non-zero exit code
    Given a hook receiver is already running on port 3748
    When a second hook receiver instance attempts to start
    Then the second instance exits with code 1

  # === US-HRIL-02: ERROR PATHS ===

  Scenario: Second instance exits cleanly without error dialog
    Given a hook receiver is already running on port 3748
    When a second hook receiver instance attempts to start
    Then the second instance exits without displaying any error dialog
    And the first instance continues running unaffected

  Scenario: No crash or panic on port conflict
    Given a hook receiver is already running on port 3748
    When a second hook receiver instance attempts to start
    Then the exit is graceful with an informative log message
    And no unhandled exception or panic occurs

  Scenario: Port occupied by another application produces clear message
    Given port 3748 is occupied by a non-Norbert application
    When the hook receiver attempts to start
    Then the receiver reports the port is unavailable with the system error detail
    And the receiver exits with code 1

  Scenario: Receiver start with database directory not yet created
    Given the Norbert data directory does not exist yet
    When the hook receiver starts for the first time
    Then the data directory is created automatically
    And the receiver begins listening normally

  # === US-HRIL-03: GUI DECOUPLING ===

  Scenario: GUI startup code does not spawn hook receiver
    Given the Norbert GUI application is configured
    When the GUI starts up
    Then no hook receiver sidecar process is launched
    And the shell plugin is not initialized

  Scenario: GUI displays data regardless of receiver running state
    Given the database contains 5 sessions with 120 events
    And the hook receiver is not currently running
    When Phil opens the Norbert GUI
    Then the GUI displays 5 sessions and 120 events
    And no error is shown about the receiver being offline

  Scenario: Multiple GUI instances coexist without conflict
    Given Phil has the Norbert GUI already open
    And the hook receiver is running independently
    When Phil opens a second GUI instance
    Then both instances display the same session data
    And no port conflict or process error occurs

  Scenario: GUI connects to the database as a read-only viewer
    Given the hook receiver is writing events to the database
    When the GUI reads session data
    Then the GUI does not interfere with the receiver's writes
    And concurrent reading and writing coexist safely

  # === US-HRIL-03: ERROR PATHS ===

  Scenario: GUI opens gracefully when no receiver is running
    Given the hook receiver is not running
    And the database contains no sessions or events
    When Phil opens the Norbert GUI
    Then the GUI displays "No plugin connected" status
    And no error message is shown about missing receiver

  Scenario: Closing the GUI does not stop the hook receiver
    Given the hook receiver is running on port 3748
    And Phil has the Norbert GUI open
    When Phil closes the GUI
    Then the hook receiver continues running on port 3748
    And subsequent Claude Code events are still captured
