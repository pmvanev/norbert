<!-- markdownlint-disable MD024 -->

# User Stories: Hook Receiver Independent Lifecycle

## US-HRIL-01: Register Hook Receiver for Startup at Install Time

### Problem

Phil is a solo developer using Norbert to observe his Claude Code sessions on Windows 11. He finds it frustrating that after installing Norbert, he must manually ensure the hook receiver is running before any Claude Code events can be captured. If he forgets to launch the GUI (which currently spawns the receiver), events are silently lost.

### Who

- Solo developer | Windows 11 desktop | Wants zero-configuration observability after install

### Solution

The postinstall script registers the hook receiver binary as a Windows Task Scheduler task that runs at user logon, so data collection begins automatically after the next login without manual steps.

### Domain Examples

#### 1: Fresh Install -- Phil installs Norbert for the first time

Phil runs `npm install norbert` on his Windows 11 machine. The postinstall script downloads binaries to `C:\Users\Phil\.norbert\bin\`, creates the Start Menu shortcut, and registers a Task Scheduler task named "NorbertHookReceiver" targeting `C:\Users\Phil\.norbert\bin\norbert-hook-receiver.exe` with trigger "At log on". The console output includes "Startup task registered: NorbertHookReceiver". After his next reboot, the hook receiver starts automatically.

#### 2: Reinstall/Update -- Phil updates Norbert to a new version

Phil runs `npm install norbert` again to update from v0.1.0 to v0.2.0. The postinstall script downloads the new binaries, overwrites the old ones, and updates the existing Task Scheduler task. After completion, exactly one "NorbertHookReceiver" task exists (no duplicates). The task now points to the updated binary.

#### 3: Permission Failure -- Corporate machine restricts Task Scheduler

Phil installs Norbert on a work laptop where his account cannot create Task Scheduler tasks. The postinstall script attempts registration, catches the permission error, logs "Could not register startup task (non-fatal)", and completes installation with exit code 0. Phil can still run the hook receiver manually or launch the GUI (which currently spawns it as a sidecar, preserved as fallback until removed in US-HRIL-03).

### UAT Scenarios (BDD)

#### Scenario: Fresh install registers startup task

```gherkin
Given Phil runs "npm install norbert" on a clean Windows 11 machine
And the binary installation completes to "C:\Users\Phil\.norbert\bin\"
When the postinstall script registers the startup task
Then a Task Scheduler task named "NorbertHookReceiver" exists
And the task target is "C:\Users\Phil\.norbert\bin\norbert-hook-receiver.exe"
And the task trigger is "At log on"
And the console output includes "Startup task registered: NorbertHookReceiver"
```

#### Scenario: Reinstall does not create duplicate tasks

```gherkin
Given Phil has Norbert installed with the "NorbertHookReceiver" task already registered
When Phil runs "npm install norbert" again
Then exactly one Task Scheduler task named "NorbertHookReceiver" exists
And the task target points to the current binary path
```

#### Scenario: Registration failure is non-fatal

```gherkin
Given Phil runs "npm install norbert" on a machine where Task Scheduler registration is denied
When the postinstall script attempts to register the startup task
Then the console output includes "Could not register startup task (non-fatal)"
And the binary installation completes successfully
And the exit code is 0
```

#### Scenario: Startup task uses correct binary path

```gherkin
Given the postinstall script has installed binaries to "C:\Users\Phil\.norbert\bin\"
When the startup task is registered
Then the task target path matches the actual location of norbert-hook-receiver.exe
And no hardcoded path differs from the install directory
```

### Acceptance Criteria

- [ ] Postinstall creates a Task Scheduler task named "NorbertHookReceiver" at user logon trigger
- [ ] Task target matches the installed binary path from `getInstallDirectory()`
- [ ] Re-running postinstall produces exactly one task (idempotent)
- [ ] Registration failure logs a warning and does not fail the install
- [ ] Console output confirms startup task registration on success

### Technical Notes

- Windows Task Scheduler can be managed via PowerShell (`Register-ScheduledTask` / `Set-ScheduledTask`)
- The postinstall script already uses `execSync` with PowerShell for Start Menu shortcut creation -- same pattern
- Task should run with current user privileges (no elevation needed for user-level tasks)
- Task action: start `norbert-hook-receiver.exe` with no arguments
- Idempotency: check if task exists before creating; update if exists

### Dependencies

- Existing postinstall.js pipeline (completed)
- Existing binary installation to ~/.norbert/bin/ (completed)
- Start Menu shortcut creation pattern (completed -- can follow same PowerShell approach)

---

## US-HRIL-02: Hook Receiver Singleton Behavior at Startup

### Problem

Phil is a solo developer who expects exactly one hook receiver process running at any time. Currently, opening a second Norbert GUI instance spawns a duplicate hook receiver that crashes on port 3748 conflict, producing a confusing error. With the hook receiver starting at boot via Task Scheduler, there needs to be a clean singleton guarantee so that any additional launch attempt (from Task Scheduler re-trigger, manual start, or GUI sidecar) exits gracefully.

### Who

- Solo developer | Windows 11 | Expects silent, conflict-free background process

### Solution

The hook receiver's existing port-binding behavior already provides singleton semantics -- if port 3748 is in use, the process cannot bind and exits. This story ensures that exit is clean (no error dialogs, appropriate exit code, informative log message) and that the existing behavior is explicitly validated as the singleton mechanism.

### Domain Examples

#### 1: Normal Boot -- Single instance starts successfully

Phil's Windows 11 machine boots. Task Scheduler launches norbert-hook-receiver.exe. Port 3748 is available. The process binds successfully and logs `norbert-hook-receiver: listening on 127.0.0.1:3748`. One instance is running.

#### 2: Duplicate Launch -- Task Scheduler fires twice

Due to a Task Scheduler quirk, norbert-hook-receiver.exe is launched a second time while the first is still running. The second instance attempts to bind port 3748, finds it occupied, logs `norbert-hook-receiver: Port 3748 unavailable: Address already in use`, and exits with code 1. No Windows error dialog appears. The first instance continues unaffected.

#### 3: Manual Start While Already Running -- Phil launches receiver from terminal

Phil opens a terminal and runs `norbert-hook-receiver.exe` while it's already running from boot. The manual instance detects port 3748 is in use, logs the port unavailable message to stderr, and exits with code 1. Phil sees the message and understands another instance is already running.

### UAT Scenarios (BDD)

#### Scenario: Single instance starts and binds port

```gherkin
Given no norbert-hook-receiver process is running
And port 3748 is available on 127.0.0.1
When norbert-hook-receiver.exe starts
Then the process binds to 127.0.0.1:3748
And the process logs "norbert-hook-receiver: listening on 127.0.0.1:3748"
```

#### Scenario: Second instance exits cleanly on port conflict

```gherkin
Given norbert-hook-receiver.exe is running on port 3748
When a second norbert-hook-receiver.exe instance starts
Then the second instance logs "norbert-hook-receiver: Port 3748 unavailable"
And the second instance exits with code 1
And no error dialog is shown to the user
And the first instance continues running unaffected
```

#### Scenario: Manual start when already running shows informative message

```gherkin
Given norbert-hook-receiver.exe is running on port 3748 (started at boot)
When Phil runs "norbert-hook-receiver" from a terminal
Then stderr shows "norbert-hook-receiver: Port 3748 unavailable: Address already in use"
And the process exits with code 1
```

### Acceptance Criteria

- [ ] Hook receiver binds to port 3748 and logs listening message on successful start
- [ ] When port 3748 is unavailable, process exits with code 1 and logs port unavailable message
- [ ] No Windows error dialog is shown on port conflict exit
- [ ] First running instance is unaffected by second instance's start/exit

### Technical Notes

- The existing `hook_receiver.rs` already handles port conflict with `std::process::exit(1)` and stderr logging (lines 124-133)
- The singleton behavior is already implemented -- this story validates and documents it as the intentional mechanism
- Windows: ensure no "application has stopped working" dialog on exit(1) -- may need to suppress Windows Error Reporting for clean exit
- The `std::process::exit(1)` call is the correct approach; no crash, no panic, no dialog

### Dependencies

- US-HRIL-01 (startup registration) should be complete so that boot-triggered starts are the norm
- Existing hook_receiver.rs port binding logic (completed)

---

## US-HRIL-03: GUI Stops Spawning Hook Receiver Sidecar

### Problem

Phil is a solo developer whose Norbert GUI currently spawns the hook receiver as a Tauri sidecar on every launch. With the hook receiver now starting independently at boot (US-HRIL-01), this sidecar spawning creates duplicate processes and port conflicts. The GUI needs to become a pure database viewer that reads from the shared SQLite database without managing the hook receiver's lifecycle.

### Who

- Solo developer | Windows 11 | Expects GUI to "just show data" without side effects

### Solution

Remove the sidecar spawning from the GUI's startup sequence. The GUI opens a read-only connection to the SQLite database and displays session/event data. It no longer has any responsibility for hook receiver lifecycle.

### Domain Examples

#### 1: Normal Use -- Phil opens GUI with receiver already running

Phil's hook receiver has been running since boot, collecting events from three Claude Code sessions (47 events total). Phil opens the Norbert GUI. The GUI connects to `~/.norbert/data/norbert.db`, reads the session and event data, and displays "Sessions: 3, Events: 47". No hook receiver process is spawned. Only one norbert-hook-receiver.exe process is running (the one from boot).

#### 2: GUI Opens When Receiver Is Not Running -- Phil hasn't rebooted after install

Phil installs Norbert but hasn't rebooted yet, so the Task Scheduler task hasn't fired. He opens the GUI. The GUI shows "Sessions: 0, Events: 0" (or whatever is in the database). No hook receiver is spawned. Phil sees no errors -- the GUI simply has no data to show yet.

#### 3: Multiple GUI Instances -- Phil opens Norbert twice

Phil opens norbert.exe while it's already running (clicks Start Menu shortcut again). Two GUI windows are open. Both read from the same database. Neither spawns a hook receiver. No port conflicts, no crashes.

### UAT Scenarios (BDD)

#### Scenario: GUI opens without spawning hook receiver

```gherkin
Given norbert-hook-receiver.exe is running on port 3748 since boot
And 3 sessions with 47 events exist in norbert.db
When Phil opens the Norbert GUI
Then the GUI displays session count 3 and event count 47
And only one norbert-hook-receiver.exe process is running
And the GUI did not execute any sidecar spawn command
```

#### Scenario: GUI opens when no receiver is running

```gherkin
Given norbert-hook-receiver.exe is not running
And norbert.db contains 0 sessions and 0 events
When Phil opens the Norbert GUI
Then the GUI displays "No plugin connected"
And no norbert-hook-receiver.exe process is started
And no error message is shown
```

#### Scenario: Two GUI instances coexist without conflict

```gherkin
Given Phil has the Norbert GUI already open
When Phil opens a second Norbert GUI instance
Then both GUI instances display the same session and event data
And no hook receiver process is spawned by either instance
And no port conflict error occurs
```

#### Scenario: GUI closing does not affect hook receiver

```gherkin
Given norbert-hook-receiver.exe is running on port 3748
And Phil has the Norbert GUI open
When Phil closes the GUI window
Then norbert-hook-receiver.exe continues running on port 3748
And subsequent Claude Code hook events are still captured
```

### Acceptance Criteria

- [ ] GUI startup code does not call `spawn_hook_receiver_sidecar` or any equivalent
- [ ] GUI reads from SQLite database in read-only mode
- [ ] GUI displays data correctly regardless of whether hook receiver is running
- [ ] Closing the GUI does not stop or affect the hook receiver
- [ ] Multiple GUI instances can coexist without port conflicts

### Technical Notes

- Remove the `spawn_hook_receiver_sidecar(app)` call from `lib.rs` setup closure (line 112)
- The `tauri_plugin_shell` dependency may become removable if no other sidecar usage exists
- Consider whether the Tauri sidecar configuration in `tauri.conf.json` should also be cleaned up
- GUI's SQLite connection could be explicitly opened in read-only mode for clarity, though WAL mode already supports concurrent readers
- The `on_window_event` close handler (hide instead of exit) remains -- this is tray-icon behavior, independent of hook receiver

### Dependencies

- US-HRIL-01 (startup registration) must be complete so the hook receiver starts independently
- US-HRIL-02 (singleton behavior) ensures no conflicts from any source
