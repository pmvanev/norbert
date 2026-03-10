Feature: Hook Receiver Independent Lifecycle
  As a developer using Norbert to observe Claude Code sessions,
  the hook receiver should run independently of the GUI
  so that hook events are captured even when the GUI is closed.

  Background:
    Given Norbert is installed at "C:\Users\Phil\.norbert\bin\"
    And norbert-hook-receiver.exe exists at "C:\Users\Phil\.norbert\bin\norbert-hook-receiver.exe"
    And the SQLite database is at "C:\Users\Phil\.norbert\data\norbert.db"

  # --- Step 1: Install Registers Startup ---

  Scenario: Postinstall registers startup task on Windows
    Given Phil runs "npm install norbert" on Windows 11
    And the postinstall script completes binary installation
    When the postinstall script registers the startup task
    Then a Windows Task Scheduler task named "NorbertHookReceiver" exists
    And the task target is "C:\Users\Phil\.norbert\bin\norbert-hook-receiver.exe"
    And the task trigger is "At log on of Phil"
    And the postinstall output includes "Startup task registered: NorbertHookReceiver"

  Scenario: Postinstall startup registration is idempotent
    Given Phil has already installed Norbert with the startup task registered
    When Phil runs "npm install norbert" again (update or reinstall)
    Then exactly one Task Scheduler task named "NorbertHookReceiver" exists
    And the task target points to the updated binary path

  Scenario: Postinstall continues if startup registration fails
    Given Phil runs "npm install norbert" on Windows 11
    And Task Scheduler registration fails due to insufficient permissions
    When the postinstall script attempts to register the startup task
    Then the postinstall script logs a warning "Could not register startup task (non-fatal)"
    And the binary installation completes successfully
    And the exit code is 0

  # --- Step 2: System Boot Starts Hook Receiver ---

  Scenario: Hook receiver starts at Windows login
    Given the Task Scheduler task "NorbertHookReceiver" is registered
    And Phil logs into Windows 11
    When the Task Scheduler triggers the hook receiver
    Then norbert-hook-receiver.exe is running
    And port 3748 is bound on 127.0.0.1
    And the process logs "norbert-hook-receiver: listening on 127.0.0.1:3748"

  Scenario: Hook receiver exits cleanly when port already in use
    Given norbert-hook-receiver.exe is already running on port 3748
    When a second instance of norbert-hook-receiver.exe starts
    Then the second instance detects port 3748 is unavailable
    And the second instance exits with code 1
    And the second instance logs "norbert-hook-receiver: Port 3748 unavailable"
    And no error dialog is shown to the user

  # --- Step 3: Always-On Collection ---

  Scenario: Hook events captured while GUI is closed
    Given norbert-hook-receiver.exe is running on port 3748
    And the Norbert GUI (norbert.exe) is not running
    When Claude Code sends a SessionStart hook for session "sess-morning-work"
    And Claude Code sends 15 PreToolUse hooks for session "sess-morning-work"
    Then all 16 events are persisted in norbert.db
    And the events are attributed to session "sess-morning-work"

  # --- Step 4: GUI Opens as Viewer ---

  Scenario: GUI displays events captured before GUI was opened
    Given norbert-hook-receiver.exe has been running since system boot
    And 3 sessions with 47 total events have been captured
    And the Norbert GUI has not been opened yet today
    When Phil opens the Norbert GUI
    Then the GUI displays "Sessions: 3" and "Events: 47"
    And the latest session details are visible
    And the GUI did not spawn a new hook receiver process

  Scenario: GUI does not spawn hook receiver sidecar
    Given norbert-hook-receiver.exe is already running on port 3748
    When Phil opens the Norbert GUI
    Then only one norbert-hook-receiver.exe process is running
    And the GUI connects to norbert.db as a read-only viewer

  # --- Step 5: GUI Closes, Collection Continues ---

  Scenario: Closing GUI does not stop hook receiver
    Given norbert-hook-receiver.exe is running on port 3748
    And Phil has the Norbert GUI open
    When Phil closes the Norbert GUI
    Then norbert-hook-receiver.exe continues running
    And port 3748 remains bound
    And subsequent Claude Code hooks are still captured

  # --- Error Paths ---

  @property
  Scenario: Hook receiver resource footprint when idle
    Given norbert-hook-receiver.exe is running with no active Claude Code sessions
    Then the process memory usage is below 20 MB
    And the process CPU usage is negligible (below 1%)
