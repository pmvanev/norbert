<!-- markdownlint-disable MD024 -->

# Walking Skeleton User Stories

Stories are ordered by dependency: US-WS-001 enables US-WS-002 which enables US-WS-003.

---

## US-WS-001: Tauri App Shell with System Tray and Status Window

### Problem

Priya Chandrasekaran is a Claude Code power user who runs multi-agent sessions daily on Windows 11. She spends $15-30 per week on API costs but has no desktop tool to observe what happens inside her sessions. She finds it frustrating that there is no always-on, ambient presence on her desktop that could show her AI activity -- she has to go to a website or read terminal logs after the fact.

### Who

- Claude Code power user | Windows 11 | Wants ambient desktop presence for AI observability

### Solution

A Tauri 2.0 desktop application that starts as a system tray icon and opens a minimal status window on click. The window shows application name, version, and a status indicator. This is the empty shell that all subsequent features build into.

### Domain Examples

#### 1: First Launch -- Priya sees the tray icon appear

Priya runs `norbert-cc` from her terminal on Windows 11. The Norbert icon appears in her system tray. She clicks it and a window opens showing "NORBERT v0.1.0" with "Status: Listening" and "Port: 3748". She knows the app is alive.

#### 2: Window toggle -- Priya opens and closes the window

Priya clicks the tray icon during her workday. The Norbert window opens. She clicks the tray icon again (or clicks the close button). The window closes but the tray icon remains -- Norbert is still running. She can reopen it anytime.

#### 3: Tray icon persists across sessions -- Priya reboots her machine

Priya restarts her Windows 11 machine. Norbert does not auto-launch (auto-launch is not in walking skeleton scope). She runs `norbert-cc` again and the tray icon appears. The database from her previous sessions is still there.

### UAT Scenarios (BDD)

#### Scenario: Tray icon appears on launch

Given Priya runs "norbert-cc" on Windows 11
When the application initializes
Then the Norbert icon appears in the Windows system tray
And the icon tooltip shows "Norbert v0.1.0"

#### Scenario: Window opens on tray icon click

Given Norbert is running with the tray icon visible
When Priya clicks the Norbert tray icon
Then the main window opens
And it displays "NORBERT v0.1.0"
And it shows "Status: Listening"
And it shows "Port: 3748"
And it shows "Sessions: 0" and "Events: 0"

#### Scenario: Window closes but app continues running

Given the Norbert main window is open
When Priya closes the window
Then the window closes
And the tray icon remains visible
And the HTTP hook server continues running

#### Scenario: Empty state is clear and inviting

Given Priya has just launched Norbert for the first time
And no Claude Code sessions have occurred yet
When she opens the main window
Then she sees "Waiting for first Claude Code session..." as the empty state message
And the interface does not look broken or error-like

### Acceptance Criteria

- [ ] Tray icon appears in Windows 11 system tray when norbert-cc is launched
- [ ] Clicking tray icon toggles the main window open/closed
- [ ] Main window displays application name, version, status, port, session count, and event count
- [ ] Closing the window does not terminate the application
- [ ] Empty state shows a clear message indicating the app is waiting for its first session

### Technical Notes

- Tauri 2.0 with system tray API for Windows 11
- React frontend for the main window content
- Version displayed in window must be sourced from package.json (shared artifact: `version`)
- Port displayed must match the constant used by the HTTP server (shared artifact: `hook_port`)
- No auto-launch on boot in walking skeleton scope

### Dependencies

- None (this is the foundation story)

---

## US-WS-002: Settings Merge, Hook Server, and Database Initialization

### Problem

Priya Chandrasekaran has installed norbert-cc but Claude Code does not know Norbert exists. She finds it daunting to manually edit settings.json to register HTTP hooks -- she has custom MCP servers configured and is afraid of breaking them. She wants Norbert to handle this automatically and safely.

### Who

- Claude Code power user | Has existing settings.json with custom config | Needs zero-config hook registration

### Solution

On first launch, Norbert performs three initialization tasks: (1) surgically merges hook configuration into settings.json with a backup, (2) starts an HTTP server on port 3748 to receive hook events, and (3) initializes a SQLite database in WAL mode for event storage.

### Domain Examples

#### 1: Happy path -- Priya's existing config is preserved

Priya has settings.json with two MCP servers (github and filesystem) and custom permissions. She launches Norbert. It backs up her settings.json to ~/.norbert/settings.json.bak, merges hook entries, and her MCP servers and permissions are untouched. She opens settings.json in her editor and sees both her original config and the new Norbert hooks.

#### 2: No existing settings -- Priya is a new Claude Code user

Priya just installed Claude Code yesterday and has never edited settings.json. The file might not even exist. She launches Norbert. It creates ~/.claude/settings.json with just the hook configuration. No backup is created because there was nothing to back up.

#### 3: Malformed settings -- Priya has a JSON syntax error

Priya accidentally left a trailing comma in her settings.json last week. She launches Norbert. It detects the invalid JSON and refuses to modify the file. A warning notification tells her exactly what happened and that she needs to fix the JSON manually. Norbert still starts (tray icon, database) but hooks are not registered.

### UAT Scenarios (BDD)

#### Scenario: Settings merge preserves existing configuration

Given Priya has ~/.claude/settings.json containing:
  """json
  {
    "permissions": {"allow": ["Read", "Write"]},
    "mcpServers": {"github": {"type": "stdio", "command": "mcp-github"}}
  }
  """
When Norbert performs the first-launch settings merge
Then ~/.norbert/settings.json.bak is created as an exact copy of the original
And the merged settings.json contains Priya's original permissions and mcpServers
And the merged settings.json contains Norbert hook entries for 6 event types
And each hook entry URL is "http://localhost:3748/hooks/{event_type}"
And each hook entry has "async: true" for non-blocking operation

#### Scenario: Database initializes with WAL mode

Given Priya launches Norbert for the first time
When the application initializes
Then ~/.norbert/norbert.db is created
And PRAGMA journal_mode returns "wal"
And PRAGMA synchronous returns "1"
And the database contains a "sessions" table
And the database contains an "events" table

#### Scenario: HTTP server accepts hook events

Given Norbert is running with the HTTP server started
When an HTTP POST is sent to http://localhost:3748/hooks/PreToolUse with a valid JSON payload
Then the server responds with HTTP 200
And the payload is stored in the events table

#### Scenario: Settings merge fails safely on malformed JSON

Given Priya has ~/.claude/settings.json containing invalid JSON
When Norbert attempts the first-launch settings merge
Then the malformed settings.json is not modified
And no backup file is created
And a warning notification appears explaining the issue
And the main window shows "Status: Listening (hooks not registered)"
And the HTTP server and database still initialize correctly

#### Scenario: Restart notification appears after successful merge

Given Norbert has successfully merged hooks into settings.json
When the merge completes
Then a Windows notification appears with "Restart any running Claude Code sessions for hooks to take effect"
And a persistent banner appears in the Norbert window with the same message

### Acceptance Criteria

- [ ] First launch backs up settings.json before modification
- [ ] Settings merge preserves all existing user configuration (permissions, MCP servers, etc.)
- [ ] Hook entries registered for PreToolUse, PostToolUse, SubagentStop, Stop, SessionStart, UserPromptSubmit
- [ ] All hook URLs point to localhost on the configured port with async: true
- [ ] SQLite database created with WAL mode and core schema
- [ ] HTTP server listens on port 3748 and accepts POST requests
- [ ] Malformed settings.json is not modified; clear warning shown instead
- [ ] Port-in-use error shown clearly if port 3748 is occupied

### Technical Notes

- Settings merge must be a surgical JSON merge, not a full replacement
- Backup must be byte-identical to original (not pretty-printed differently)
- HTTP server must be async/non-blocking -- hook events arrive during active sessions
- SQLite WAL mode is required for concurrent read/write during event bursts
- Hook event types are a shared artifact -- the list registered in settings.json must match HTTP server routes

### Dependencies

- US-WS-001 (Tauri app shell must exist for tray icon and window)

---

## US-WS-003: End-to-End Pipeline Confirmation

### Problem

Priya Chandrasekaran has installed Norbert and it says "Listening" but she has no way to know if the full pipeline actually works. She finds it unacceptable to trust a tool that claims to observe her sessions without proof that data flows from Claude Code through every layer to the UI. She needs to see a session record with real data.

### Who

- Claude Code power user | Has Norbert installed and hooks registered | Needs visible proof of end-to-end data flow

### Solution

When Claude Code sends hook events during a session, Norbert receives them via HTTP, stores them in SQLite with session attribution, and displays session records in the main window. The transition from "Waiting for first session" to showing a real session record with timestamp, duration, and event count is the proof moment.

### Domain Examples

#### 1: Happy path -- Priya sees her first session captured

Priya launches Norbert, restarts Claude Code, and asks Claude to "help me write a sorting function." During the 8-minute session, Claude makes 15 tool calls. After the session ends, Priya opens the Norbert window and sees: Sessions: 1, Events: 30 (PreToolUse + PostToolUse for each tool call), Duration: 8m 12s, with the correct start timestamp.

#### 2: Multiple sessions -- Priya runs three sessions throughout the day

Priya runs three Claude Code sessions: a quick 2-minute question (5 events), a 20-minute refactoring session (89 events), and a 5-minute test-writing session (23 events). Opening Norbert shows Sessions: 3, Events: 117. The most recent session details are displayed prominently.

#### 3: Norbert restarted mid-session -- Priya accidentally closes and reopens Norbert

Priya is mid-session when she accidentally closes Norbert. She immediately relaunches it. The HTTP server restarts and begins receiving events again. After the session ends, the session record shows events from both before and after the restart. Pre-restart events are still in the database because SQLite persisted them.

### UAT Scenarios (BDD)

#### Scenario: First session captured and displayed

Given Priya has Norbert running with hooks registered
And she starts a Claude Code session and asks "Help me write a sorting function"
And Claude Code makes 15 tool calls during the 8-minute session
When the session ends and Priya opens the Norbert window
Then "Sessions: 1" is displayed
And "Events: 30" is displayed
And the session entry shows the correct start timestamp
And the session entry shows duration "8m 12s"
And the first-launch "Waiting for first session" message is gone

#### Scenario: Live event count during active session

Given Priya has the Norbert window open during an active Claude Code session
When Claude Code makes a tool call and Norbert receives the hook events
Then the event count in the window increments within 1 second
And the tray tooltip updates to reflect the new count

#### Scenario: Session status transitions correctly

Given Norbert shows "Status: Listening" with no active session
When a SessionStart event arrives from Claude Code
Then the status changes to "Active session"
And when the Stop event arrives
Then the status returns to "Listening"

#### Scenario: Multiple sessions accumulate

Given Priya has run 3 Claude Code sessions producing 5, 89, and 23 events
When she opens the Norbert window
Then "Sessions: 3" is displayed
And "Events: 117" is displayed
And the most recent session's details are shown

#### Scenario: Restart banner dismisses on first event

Given the first-launch restart banner is visible in the Norbert window
When the first hook event arrives from Claude Code
Then the banner dismisses automatically
And does not reappear

### Acceptance Criteria

- [ ] Hook events from Claude Code sessions are received, stored, and attributed to sessions
- [ ] Session records include start timestamp, duration, and event count
- [ ] Main window event count updates within 1 second of receiving new events
- [ ] Status indicator transitions between "Listening" and "Active session" states
- [ ] Multiple sessions accumulate correctly with accurate total event counts
- [ ] First-launch banner dismisses automatically when first event arrives
- [ ] Pre-restart events persist in database across Norbert restarts

### Technical Notes

- Session identification: SessionStart event creates a new session record; Stop event finalizes it
- Duration calculated from SessionStart timestamp to Stop timestamp
- Event count is a running total per session, updated on each event
- Database writes must be durable before HTTP 200 is returned (no silent drops)
- Tray icon state must reflect active/idle without requiring the window to be open

### Dependencies

- US-WS-002 (HTTP server, database, and settings merge must be working)
- US-WS-001 (Tauri app shell and tray icon must exist)

---

## US-WS-000: CI/CD Pipeline (Technical Task)

### Problem

There is no way to build, package, or distribute Norbert. Without a build pipeline, none of the walking skeleton stories can be delivered to a user's machine.

### Who

- Developer building Norbert | Needs automated build and distribution

### Solution

A GitHub Actions workflow that builds a Windows x64 Tauri binary on version tag push, attaches it to a GitHub Release, and enables installation via npx.

### Domain Examples

#### 1: Happy path -- Developer tags a release

Developer pushes a `v0.1.0` tag. GitHub Actions builds the Windows binary using `tauri-apps/tauri-action`. The binary appears on the GitHub Release page. Running `npx github:pmvanev/norbert-cc` downloads and installs the binary.

#### 2: Build failure -- Compilation error caught in pipeline

Developer pushes a tag with a Rust compilation error. The GitHub Actions workflow fails with a clear error log. No release is created. The developer fixes the error and pushes a new tag.

#### 3: postinstall downloads correct binary

A user on Windows 11 x64 runs `npm install -g norbert-cc`. The postinstall script detects `win32-x64`, downloads `norbert-v0.1.0-win32-x64.tar.gz` from the GitHub Release, and extracts it to `~/.norbert/bin/`.

### UAT Scenarios (BDD)

#### Scenario: Tagged commit produces GitHub Release with binary

Given a developer pushes git tag "v0.1.0" to the repository
When the GitHub Actions workflow completes
Then a GitHub Release "v0.1.0" exists
And the release contains "norbert-v0.1.0-win32-x64.tar.gz"

#### Scenario: npm install triggers binary download

Given the GitHub Release for v0.1.0 exists with the Windows binary
When a user runs "npm install -g norbert-cc" on Windows 11 x64
Then the postinstall script downloads the correct binary
And extracts it to ~/.norbert/bin/
And "norbert-cc" is available in the user's PATH

#### Scenario: Build failure does not produce a release

Given a developer pushes a tag with code that fails to compile
When the GitHub Actions workflow runs
Then the workflow fails with a visible error
And no GitHub Release is created for that tag

### Acceptance Criteria

- [ ] GitHub Actions workflow builds Windows x64 binary on version tag push
- [ ] Built binary attached to GitHub Release automatically
- [ ] postinstall script detects Windows x64 and downloads correct binary
- [ ] npx github:pmvanev/norbert-cc installs and launches on Windows 11
- [ ] Build failures do not produce releases

### Technical Notes

- Uses tauri-apps/tauri-action for the build
- Initial target: Windows x64 only (macOS and Linux added later)
- postinstall must handle download failures gracefully
- Binary size target: under 15MB (Tauri advantage over Electron)

### Dependencies

- None (this is infrastructure that enables everything else)

### Link to User Stories

Enables delivery of US-WS-001, US-WS-002, and US-WS-003.
