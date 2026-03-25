<!-- markdownlint-disable MD024 -->
# User Stories: hook-receiver-clarity

Traces to JTBD analysis: `docs/feature/hook-receiver-clarity/discuss/jtbd-analysis.md`
Journey artifacts: `docs/feature/hook-receiver-clarity/discuss/journey-hook-receiver-clarity.yaml`

---

## US-HRC-01: Hook Receiver Process Identity

### Problem

Danielle Reyes is a developer who uses Norbert on Windows daily. She finds it disorienting to see two processes both labeled "Norbert" in Task Manager when investigating high CPU or memory usage. She cannot tell which is the GUI and which is the background hook receiver without checking the Command Line column — a non-obvious extra step that breaks her diagnostic flow.

### Who

- Developer running Norbert on Windows | Investigating system resource usage via Task Manager | Motivated by quick, accurate process identification

### Solution

Embed a distinct Windows VERSIONINFO FileDescription ("Norbert Hook Receiver") in `norbert-hook-receiver.exe` so that the Description column in Task Manager immediately distinguishes it from `norbert.exe`.

### Domain Examples

#### 1: Happy Path — Danielle identifies the sidecar instantly

Danielle opens Task Manager while CPU spikes. She sees two rows: "Norbert" (128 MB, `norbert.exe`) and "Norbert Hook Receiver" (24 MB, `norbert-hook-receiver.exe`). She immediately knows the sidecar is the smaller background process and does not need to expand any columns.

#### 2: File Properties confirmation

Danielle right-clicks `norbert-hook-receiver.exe` in File Explorer and opens Properties → Details. The "File description" field reads "Norbert Hook Receiver" and "Product name" reads "Norbert". The binary is self-documenting on disk.

#### 3: Main GUI unchanged (regression guard)

After a new build of Norbert, Danielle opens Task Manager and confirms `norbert.exe` still shows "Norbert" in the Description column. The change to the hook receiver's metadata did not accidentally alter the main GUI binary.

### UAT Scenarios (BDD)

#### Scenario: Task Manager shows distinct label for hook receiver

```gherkin
Given norbert.exe and norbert-hook-receiver.exe are both running on Danielle's machine
When Danielle opens Windows Task Manager and views the Processes or Details tab
Then norbert-hook-receiver.exe shows "Norbert Hook Receiver" in the Description column
And norbert.exe shows "Norbert" in the Description column
And Danielle can distinguish the two processes without clicking on either
```

#### Scenario: FileDescription is embedded in the binary at rest

```gherkin
Given norbert-hook-receiver.exe is present on disk but not currently running
When Danielle right-clicks the file and opens Properties then Details
Then the File description field reads "Norbert Hook Receiver"
And the Product name field reads "Norbert"
```

#### Scenario: Main GUI metadata is unchanged

```gherkin
Given a fresh build of norbert.exe has been produced
When Danielle inspects its file Properties then Details
Then the File description field still reads "Norbert"
And no regression has been introduced to the main GUI binary metadata
```

### Acceptance Criteria

- [ ] Task Manager Description column shows "Norbert Hook Receiver" for `norbert-hook-receiver.exe`
- [ ] Task Manager Description column shows "Norbert" for `norbert.exe` (unchanged)
- [ ] File Properties → Details "File description" field shows "Norbert Hook Receiver" for the hook receiver binary
- [ ] The distinction is visible without expanding additional columns or hovering
- [ ] Main GUI binary metadata passes a regression check after this change

### Technical Notes

- VERSIONINFO block is embedded via `build.rs` (Windows Resource File) or Cargo metadata tooling
- The `tray-icon` crate is already available transitively; no new cargo dependency needed for this story
- This story has zero runtime changes — compile-time metadata only
- Verified at build time; CI can validate with `sigcheck.exe -a` or PowerShell `Get-ItemProperty`
- Dependency: none (standalone build configuration change)

---

## US-HRC-02: Hook Receiver System Tray Presence

### Problem

Danielle Reyes runs `norbert-hook-receiver.exe` as a background sidecar that auto-starts at login. She has no visual confirmation the sidecar is alive. When it crashes silently she loses hours of Claude Code telemetry without knowing. She must open Task Manager just to confirm it is running — an unnecessary interruption to her workflow.

### Who

- Developer running Norbert on Windows | Wanting passive confirmation that background telemetry capture is active | Motivated by peace of mind without interrupting current work

### Solution

Add a system tray icon to `norbert-hook-receiver.exe` that appears on startup, shows a tooltip with port and event count, and provides a right-click context menu with status details and a graceful Quit option.

### Domain Examples

#### 1: Happy Path — Danielle confirms the sidecar is alive

Danielle glances at the system tray during a coding session and sees the Norbert Hook Receiver icon [N]. She hovers: tooltip shows "Norbert Hook Receiver | :3748 | 87 events". She returns to coding, reassured.

#### 2: Right-click status check before a meeting

Before a retrospective where she plans to demo Norbert telemetry, Danielle right-clicks the tray icon and sees "Port: 3748 | Events captured: 213". She knows the data is ready and closes the menu.

#### 3: Graceful shutdown before system update

Before running Windows Update (which requires a restart), Danielle right-clicks the tray icon and clicks "Quit". The icon disappears within 2 seconds. She confirms in Task Manager that the process is gone and proceeds with the update confidently.

### UAT Scenarios (BDD)

#### Scenario: Tray icon appears on startup

```gherkin
Given Danielle's machine starts up and the Startup shortcut runs norbert-hook-receiver.exe
When the hook receiver successfully binds to port 3748
Then a tray icon for "Norbert Hook Receiver" appears in the Windows system tray
And the icon appears within 2 seconds of the process starting
```

#### Scenario: Tray tooltip shows live status

```gherkin
Given norbert-hook-receiver.exe is running and has captured 42 telemetry events
When Danielle hovers over the tray icon
Then the tooltip displays "Norbert Hook Receiver"
And the tooltip displays the bound port (":3748")
And the tooltip displays the event count ("42 events")
```

#### Scenario: Tray context menu shows status and quit option

```gherkin
Given norbert-hook-receiver.exe is running on port 3748 with 42 events captured
When Danielle right-clicks the tray icon
Then a context menu appears with "Norbert Hook Receiver" as a non-clickable header
And the menu shows "Port: 3748"
And the menu shows "Events captured: 42"
And the menu contains a clickable "Quit" item
```

#### Scenario: Event count updates live

```gherkin
Given norbert-hook-receiver.exe was showing 42 events in the tray tooltip
When the hook receiver captures 3 more telemetry events
And Danielle hovers over the tray icon again
Then the tooltip now shows "45 events"
```

#### Scenario: Graceful shutdown via tray Quit

```gherkin
Given norbert-hook-receiver.exe is running with no SQLite write in flight
When Danielle clicks "Quit" in the tray context menu
Then the tray icon disappears from the system tray
And port 3748 is released within 1 second
And the process exits with code 0
```

#### Scenario: Graceful shutdown waits for pending SQLite write

```gherkin
Given norbert-hook-receiver.exe has a SQLite write in flight that completes within 2 seconds
When Danielle clicks "Quit" in the tray context menu
Then the process waits for the SQLite write to complete before exiting
And the tray icon disappears after the write completes
And the process exits with code 0
```

#### Scenario: Forced exit on slow SQLite drain

```gherkin
Given norbert-hook-receiver.exe has a SQLite write taking longer than 2 seconds
When Danielle clicks "Quit" in the tray context menu
Then the process waits up to 2 seconds for the write to complete
And if not complete within 2 seconds the process exits anyway
And a warning is written to the application log indicating incomplete drain
```

#### Scenario: Tray shows unavailable status when port bind fails

```gherkin
Given port 3748 is already in use by another process on Danielle's machine
When norbert-hook-receiver.exe starts up
Then the tray icon still appears in the Windows system tray
And the tray tooltip shows "Norbert Hook Receiver" and "Port: unavailable"
And the tray context menu shows "Port: unavailable"
```

### Acceptance Criteria

- [ ] Tray icon appears within 2 seconds of process startup
- [ ] Tray tooltip shows process name, bound port, and event count (read on-demand when tooltip opens; no background polling)
- [ ] Right-click context menu shows title (non-clickable), port, event count, and Quit
- [ ] Event count reflects the in-memory counter value at the time the tooltip or menu opens
- [ ] "Quit" triggers graceful shutdown: flush SQLite writes → remove tray icon → exit 0
- [ ] Graceful drain timeout is a named constant (default 2 seconds); forced exit on timeout with log warning
- [ ] Port 3748 is released within 1 second of clean exit
- [ ] If port bind fails, tray icon still appears and tooltip/menu show "Port: unavailable"

### Technical Notes

- The `tray-icon` crate is available transitively via the existing Tauri dependency; confirm it can be used in a non-Tauri binary (the hook receiver is a pure Axum/tokio process). If not usable standalone, evaluate `systray` or `tray-item` crates — crate selection is a DESIGN wave decision
- Event count must be an in-memory counter readable from both tray tooltip and context menu without staleness; the specific synchronization primitive is a DESIGN wave decision
- Windows-only scope for this story; cross-platform tray support is explicitly out of scope
- Minimum supported Windows version: Windows 10 version 1803 or later (tray icon behavior differs on earlier versions) — DESIGN wave to validate
- SQLite drain timeout (default 2 seconds) is a named constant, not a magic number — DESIGN wave to confirm value
- Startup shortcut installation and management is out of scope for this story; the hook receiver is assumed to be installed correctly
- Dependency on US-HRC-01: none (independent); can be built in parallel or sequentially

---

## Definition of Ready Validation

### US-HRC-01

| DoR Item | Status | Evidence |
|----------|--------|---------|
| Problem statement clear, domain language | PASS | "Danielle cannot distinguish two 'Norbert' processes in Task Manager" |
| User/persona with specific characteristics | PASS | Danielle Reyes — developer on Windows, uses Task Manager to debug |
| 3+ domain examples with real data | PASS | Task Manager view, File Properties, regression guard — all with concrete detail |
| UAT in Given/When/Then (3-7 scenarios) | PASS | 3 scenarios |
| AC derived from UAT | PASS | 5 AC items, each traceable to a scenario |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 1 day effort (build.rs change only), 3 scenarios |
| Technical notes: constraints/dependencies | PASS | Build-time only, sigcheck validation, no new runtime code |
| Dependencies resolved or tracked | PASS | No external dependencies |

### DoR Status: PASSED

---

### US-HRC-02

| DoR Item | Status | Evidence |
|----------|--------|---------|
| Problem statement clear, domain language | PASS | "Danielle loses hours of telemetry with no visible indicator the sidecar is alive" |
| User/persona with specific characteristics | PASS | Danielle Reyes — developer on Windows, background process user |
| 3+ domain examples with real data | PASS | Status check, pre-meeting check, pre-update shutdown — all concrete |
| UAT in Given/When/Then (3-7 scenarios) | PASS | 7 scenarios (port-fail error path added in review pass; total at upper bound) |
| AC derived from UAT | PASS | 8 AC items traceable to scenarios |
| Right-sized (1-3 days, 3-7 scenarios) | PASS | 2-3 days (new tray code in Rust), 7 scenarios — at upper bound, acceptable |
| Technical notes: constraints/dependencies | PASS | tray-icon crate concern noted, drain timeout named, Windows-only scope, min OS version noted |
| Dependencies resolved or tracked | PASS | tray-icon availability flagged as spike candidate for DESIGN wave |

### DoR Status: PASSED
