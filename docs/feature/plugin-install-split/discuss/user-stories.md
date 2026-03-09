<!-- markdownlint-disable MD024 -->

# Plugin Install Split User Stories

Stories are ordered by dependency: US-PIS-001 and US-PIS-002 can be done in parallel. US-PIS-003 depends on US-PIS-001. US-PIS-004 depends on US-PIS-002. US-PIS-005 depends on US-PIS-001. US-PIS-006 depends on US-PIS-001.

---

## US-PIS-001: App Install Without Claude Integration

### Problem

Priya Chandrasekaran is a Claude Code power user on Windows 11 who runs multi-agent sessions daily. She wants to try Norbert but finds it unsettling that the current install silently modifies her `~/.claude/settings.json` on first launch. She has custom MCP servers and permissions configured and does not want any tool modifying that file without her explicit action.

### Who

- Claude Code power user | Windows 11 | Has custom Claude configuration she does not want modified automatically

### Solution

The `npx github:pmvanev/norbert-cc` install command installs the Norbert desktop app binary to `~/.norbert/bin/` and launches it as a system tray application. It does not read, modify, or back up `~/.claude/settings.json`. The app runs standalone, showing a helpful empty state that guides the user to install the plugin.

### Domain Examples

#### 1: Clean install -- Priya installs Norbert with existing Claude config

Priya has `~/.claude/settings.json` with 3 custom MCP servers (github, filesystem, memory) and custom permissions. She runs `npx github:pmvanev/norbert-cc`. The binary downloads to `~/.norbert/bin/norbert.exe`. The tray icon appears. She checks her settings.json -- it is byte-identical to before. No `~/.norbert/settings.json.bak` exists.

#### 2: Terminal output guides next step -- Priya sees plugin hint

After the install completes, Priya's terminal shows: "Norbert is running in the system tray. To connect to Claude Code: /plugin install norbert@pmvanev-marketplace". She knows exactly what to do next.

#### 3: App empty state -- Priya opens the window before connecting plugin

Priya clicks the tray icon. The window shows "Status: No plugin connected" and "Port: 3748 (listening)". A prominent card displays the plugin install command. Session count: 0. Event count: 0. The window looks intentional, not broken.

### UAT Scenarios (BDD)

#### Scenario: App installs without modifying Claude settings

Given Priya Chandrasekaran has ~/.claude/settings.json with 3 custom MCP servers
When she runs "npx github:pmvanev/norbert-cc"
Then the Norbert binary is installed to ~/.norbert/bin/
And the Norbert tray icon appears
And her ~/.claude/settings.json is byte-identical to before the install
And no ~/.norbert/settings.json.bak file is created

#### Scenario: Terminal output shows plugin install hint

Given Priya runs "npx github:pmvanev/norbert-cc"
When the install completes and Norbert launches
Then the terminal output includes "To connect to Claude Code:"
And the terminal output includes "/plugin install norbert@pmvanev-marketplace"

#### Scenario: App shows helpful empty state without plugin

Given Norbert is installed and running in the system tray
And no Norbert plugin is installed in Claude Code
When Priya clicks the tray icon to open the window
Then the status shows "No plugin connected"
And the hook receiver sidecar is listening on port 3748
And the window displays "/plugin install norbert@pmvanev-marketplace"
And session count shows 0 and event count shows 0

#### Scenario: First launch does not trigger settings merge

Given Priya runs "npx github:pmvanev/norbert-cc" for the first time
When the Norbert app initializes
Then no settings merge operation is attempted
And no "Restart Claude Code" notification is shown
And no first-launch banner about hooks registration appears

### Acceptance Criteria

- [ ] Install does not read, modify, or back up ~/.claude/settings.json
- [ ] Terminal output includes plugin install command after successful install
- [ ] App window shows "No plugin connected" status when plugin is not installed
- [ ] App window displays the plugin install command prominently in empty state
- [ ] No settings merge notification or restart banner on first launch

### Technical Notes

- Remove `run_settings_merge()` call from `lib.rs` `.setup()` closure
- Remove `SettingsMergeAdapter`, `SettingsManager` port, and related domain functions
- Remove first-launch notification logic
- ADR-006 becomes superseded (note in ADR, do not delete)
- Sidecar still launches and listens on port 3748 -- only the settings merge is removed

### Dependencies

- None (can start immediately)

---

## US-PIS-002: Plugin Directory Structure for Claude Marketplace

### Problem

Marcus Rivera is a Claude Code user who wants to connect Norbert to Claude Code through the official plugin framework. Currently there is no plugin package for Claude's `/plugin install` command to consume. Marcus needs a properly structured plugin directory that Claude's framework can discover, validate, and install.

### Who

- Claude Code user | Wants to connect Norbert via official plugin marketplace | Expects standard plugin structure

### Solution

A `plugin/` directory in the Norbert repository containing the plugin manifest (`.claude-plugin/plugin.json`), hook definitions (`hooks/hooks.json` with 6 async HTTP hooks), and MCP server registration (`.mcp.json`). This directory is referenced from the `pmvanev/claude-marketplace` catalog via `git-subdir`.

### Domain Examples

#### 1: Plugin manifest -- Marcus inspects plugin.json

Marcus browses the Norbert repo and finds `plugin/.claude-plugin/plugin.json`. It contains the plugin name "norbert", a description "Local-first observability for Claude Code", the version matching the app version, and a reference to the hooks and MCP configuration files.

#### 2: Hook definitions -- Marcus inspects hooks.json

Marcus opens `plugin/hooks/hooks.json` and finds 6 entries: PreToolUse, PostToolUse, SubagentStop, Stop, SessionStart, UserPromptSubmit. Each is an async HTTP POST to `http://localhost:3748/hooks/{EventName}`. The structure matches what Claude's plugin framework expects.

#### 3: MCP server -- Marcus inspects .mcp.json

Marcus opens `plugin/.mcp.json` and finds: `{"mcpServers": {"norbert": {"type": "stdio", "command": "norbert-cc", "args": ["mcp"]}}}`. This matches the current MCP registration but is now managed by the plugin framework rather than surgically merged into ~/.claude.json.

### UAT Scenarios (BDD)

#### Scenario: Plugin directory contains valid plugin manifest

Given the Norbert repository has a plugin/ directory
When Marcus inspects plugin/.claude-plugin/plugin.json
Then it contains the plugin name "norbert"
And it contains a description of the plugin
And it contains a version field

#### Scenario: Plugin hooks.json defines 6 async HTTP hooks

Given the Norbert repository has plugin/hooks/hooks.json
When Marcus inspects the hooks file
Then it defines exactly 6 hook entries
And each hook is configured as async
And each hook URL follows the pattern http://localhost:3748/hooks/{EventName}
And the event names are PreToolUse, PostToolUse, SubagentStop, Stop, SessionStart, UserPromptSubmit

#### Scenario: Plugin .mcp.json defines norbert MCP server

Given the Norbert repository has plugin/.mcp.json
When Marcus inspects the MCP configuration
Then it defines a server named "norbert"
And the server type is "stdio"
And the command is "norbert-cc" with args ["mcp"]

#### Scenario: Hook port matches app sidecar port

Given the plugin hooks.json defines hooks pointing to port 3748
And the Norbert app sidecar binds to port 3748
When Claude installs the plugin and the app is running
Then hook events reach the sidecar without port mismatch

### Acceptance Criteria

- [ ] plugin/.claude-plugin/plugin.json exists with valid metadata
- [ ] plugin/hooks/hooks.json defines exactly 6 async HTTP hooks to localhost:3748
- [ ] plugin/.mcp.json defines norbert MCP server with stdio transport
- [ ] All hook URLs use the same port as the app sidecar (3748)
- [ ] Hook event names match the app's HOOK_EVENT_NAMES domain constant

### Technical Notes

- Plugin directory structure must conform to Claude's plugin framework requirements
- Hook URLs must use localhost (not 127.0.0.1) for consistency with existing sidecar
- Marketplace catalog entry in pmvanev/claude-marketplace is out of scope for this repo but must be created separately
- The `git-subdir` reference in the marketplace points to this repo's `plugin/` directory

### Dependencies

- Claude's plugin framework documentation (for exact schema of plugin.json, hooks.json)
- pmvanev/claude-marketplace repo must accept the catalog entry (out of scope, tracked)

---

## US-PIS-003: Remove Settings Merge Code

### Problem

Priya Chandrasekaran is updating her Norbert installation. The settings merge code -- `SettingsMergeAdapter`, `run_settings_merge()`, the `SettingsManager` port, backup logic, and related domain functions -- is dead code now that hooks are registered through Claude's plugin framework. Dead code increases maintenance burden, confuses contributors, and creates false confidence that settings management is still active.

### Who

- Norbert contributor/maintainer | Wants clean codebase without dead code paths | Expects code to match actual behavior

### Solution

Remove all settings merge code: the `SettingsMergeAdapter` struct and tests, `run_settings_merge()` function, `SettingsManager` port trait, `build_hooks_only_config()`, `merge_hooks_into_config()`, `hooks_are_merged()` domain functions, and the first-launch notification logic. Mark ADR-006 as superseded with a note pointing to the plugin framework.

### Domain Examples

#### 1: Dead adapter removal -- contributor reads clean code

A new contributor opens `src-tauri/src/adapters/settings/mod.rs`. Instead of finding 330 lines of settings merge code with backup logic, the file (or module) no longer exists. The `adapters/` directory only contains adapters that are actually used.

#### 2: ADR-006 superseded -- Marcus checks architectural decisions

Marcus reviews the ADR log and finds ADR-006 marked as "Superseded by plugin framework (plugin-install-split feature)". The ADR is preserved for historical context but clearly marked as no longer active.

#### 3: First launch is clean -- Priya sees no merge artifacts

Priya runs Norbert for the first time after the update. No settings merge runs. No backup file appears. No notification about restarting Claude Code appears. The app launches directly into the "No plugin connected" empty state.

### UAT Scenarios (BDD)

#### Scenario: SettingsMergeAdapter code is removed

Given a Norbert contributor inspects the codebase
When they search for SettingsMergeAdapter
Then no source file contains the SettingsMergeAdapter struct
And no test file references SettingsMergeAdapter

#### Scenario: run_settings_merge function is removed

Given the Norbert app initializes on startup
When the setup closure executes
Then no settings merge operation is called
And no reference to run_settings_merge exists in the codebase

#### Scenario: ADR-006 marked as superseded

Given Marcus reviews docs/adrs/ADR-006-settings-merge-strategy.md
When he reads the status field
Then it shows "Superseded"
And the document includes a note explaining the plugin framework replaces surgical merge

#### Scenario: No settings merge domain functions remain

Given a contributor searches the domain module
When they look for build_hooks_only_config, merge_hooks_into_config, or hooks_are_merged
Then none of these functions exist in the codebase

### Acceptance Criteria

- [ ] SettingsMergeAdapter struct and all its tests are removed
- [ ] run_settings_merge() function and its call in .setup() are removed
- [ ] SettingsManager port trait is removed (if no other consumers)
- [ ] Domain functions for settings merge are removed
- [ ] ADR-006 status changed to "Superseded" with explanation
- [ ] First-launch notification/banner logic is removed
- [ ] App compiles and all remaining tests pass after removal

### Technical Notes

- This is a code removal story -- verify no other code depends on removed functions before deletion
- The `SettingsManager` port may be used only by `SettingsMergeAdapter` -- confirm before removing trait
- Domain constants like `HOOK_EVENT_NAMES` and `HOOK_PORT` are still used by the sidecar and must NOT be removed
- Existing acceptance tests referencing settings merge must be updated or removed

### Dependencies

- US-PIS-001 (app install without Claude integration) -- must be implemented first so the app works without the merge

---

## US-PIS-004: Plugin Install from Marketplace

### Problem

Marcus Rivera has installed the Norbert desktop app and wants to connect it to Claude Code. Currently he would need Norbert to surgically merge hooks into his settings.json, which feels invasive. He wants to use Claude's official plugin framework to add the integration, just like he installs other Claude plugins.

### Who

- Claude Code user | Has Norbert app installed | Wants to connect via official plugin marketplace

### Solution

Marcus runs `/plugin install norbert@pmvanev-marketplace` in any Claude Code session. Claude's plugin framework fetches the plugin definition from the marketplace, registers the 6 async HTTP hooks and the MCP server, and reports success. The Norbert app detects incoming events and transitions from "No plugin connected" to "Listening."

### Domain Examples

#### 1: Happy path -- Marcus installs the plugin

Marcus has Norbert running in his system tray showing "No plugin connected." He opens a Claude Code session and types `/plugin install norbert@pmvanev-marketplace`. Claude reports: "Registered 6 hooks, Registered MCP server: norbert. Plugin installed successfully." He starts working and the Norbert window transitions to "Listening" with events flowing.

#### 2: App not running -- Marcus installs plugin before launching Norbert

Marcus installs the Norbert plugin via `/plugin install norbert@pmvanev-marketplace` before launching the Norbert app. The plugin installs successfully -- Claude registers the hooks. When Marcus later launches Norbert and starts a Claude session, events begin flowing. The hooks are registered regardless of whether the app is running at install time.

#### 3: Plugin already installed -- Marcus reinstalls

Marcus runs `/plugin install norbert@pmvanev-marketplace` when the plugin is already installed. Claude's framework handles this idempotently -- either skipping the install or updating to the latest version. No duplicate hook entries are created.

### UAT Scenarios (BDD)

#### Scenario: Plugin installs successfully from marketplace

Given Marcus Rivera has the Norbert app running in the system tray
When he runs "/plugin install norbert@pmvanev-marketplace" in Claude Code
Then Claude reports successful installation
And 6 async HTTP hooks are registered pointing to localhost:3748
And the norbert MCP server is registered with stdio transport

#### Scenario: App transitions from waiting to listening after plugin events

Given Marcus has the Norbert app showing "No plugin connected"
And he has installed the Norbert plugin in Claude Code
When he starts a Claude Code session and submits "List the files in this directory"
Then the Norbert app status transitions to "Listening"
And the session count shows 1
And events appear as Claude processes the request

#### Scenario: Plugin installs even when app is not running

Given Marcus has not yet launched the Norbert app
When he runs "/plugin install norbert@pmvanev-marketplace" in Claude Code
Then the plugin installs successfully
And hooks are registered in Claude's configuration
And when Marcus later launches Norbert and starts a Claude session, events flow normally

#### Scenario: Plugin install is idempotent

Given Marcus already has the Norbert plugin installed in Claude Code
When he runs "/plugin install norbert@pmvanev-marketplace" again
Then no duplicate hook entries are created
And the MCP server registration is not duplicated
And Claude handles the reinstall gracefully

### Acceptance Criteria

- [ ] `/plugin install norbert@pmvanev-marketplace` successfully registers 6 hooks and 1 MCP server
- [ ] App detects incoming events and transitions status to "Listening" without manual intervention
- [ ] Plugin installs regardless of whether Norbert app is running
- [ ] Reinstalling the plugin does not create duplicate registrations

### Technical Notes

- Plugin install behavior is managed by Claude's plugin framework -- Norbert code does not handle the install process
- The marketplace catalog entry in pmvanev/claude-marketplace must exist (out of scope for this repo)
- App detection of "plugin connected" is implicit -- the app transitions when it receives first hook event, not through explicit handshake

### Dependencies

- US-PIS-002 (plugin directory structure) -- must exist for Claude to install
- Marketplace catalog entry in pmvanev/claude-marketplace (out of scope, tracked)

---

## US-PIS-005: Plugin Uninstall Cleanly Removes Hooks

### Problem

Priya Chandrasekaran has been using Norbert with the plugin for 3 weeks and wants to temporarily disconnect it while she troubleshoots a Claude Code issue. With the old approach, she would need to manually edit settings.json to remove hook entries, risking typos or accidentally deleting other configuration. She wants a clean, reversible way to remove just the Norbert integration.

### Who

- Claude Code user | Has Norbert plugin installed | Wants clean removal without manual config editing

### Solution

Priya runs `/plugin uninstall norbert` in Claude Code. Claude's plugin framework removes all 6 hook registrations and the MCP server entry. The Norbert app continues running with all historical data intact, reverting its status to "No plugin connected."

### Domain Examples

#### 1: Clean uninstall -- Priya removes the plugin

Priya has 14 sessions and 847 events stored in Norbert. She runs `/plugin uninstall norbert`. Claude removes all hooks and MCP registration. She checks her Claude settings -- no trace of Norbert remains. She opens the Norbert app -- all 14 sessions and 847 events are still there. Status shows "No plugin connected."

#### 2: Reinstall after uninstall -- Priya reconnects

After troubleshooting her Claude issue, Priya runs `/plugin install norbert@pmvanev-marketplace` again. The hooks and MCP server are re-registered. She starts a new Claude session and events flow again. Session count goes to 15. All previous data is preserved alongside new data.

#### 3: App does not crash when plugin is removed mid-session

Priya is running a Claude Code session with Norbert receiving events. She runs `/plugin uninstall norbert` in another terminal. Claude removes the hooks. The current session stops sending events to Norbert. The app does not crash -- it gracefully handles the cessation of events and eventually shows "No plugin connected" status.

### UAT Scenarios (BDD)

#### Scenario: Plugin uninstall removes all hooks and MCP registration

Given Priya Chandrasekaran has the Norbert plugin installed in Claude Code
When she runs "/plugin uninstall norbert"
Then all 6 hook registrations are removed from Claude's configuration
And the norbert MCP server is deregistered
And no orphaned Norbert entries remain in Claude's settings

#### Scenario: App preserves data after plugin uninstall

Given Priya's Norbert app has 14 stored sessions and 847 events
When she runs "/plugin uninstall norbert" in Claude Code
Then the Norbert app still shows 14 sessions and 847 events
And the app status returns to "No plugin connected"
And the window displays the plugin install command for reconnection

#### Scenario: Reinstall after uninstall works cleanly

Given Priya previously uninstalled the Norbert plugin
And her Norbert app has 14 stored sessions
When she runs "/plugin install norbert@pmvanev-marketplace"
And starts a new Claude Code session
Then events flow to Norbert again
And the session count becomes 15
And all previous 14 sessions remain intact

#### Scenario: App handles graceful disconnection

Given Priya has the Norbert app receiving events from an active Claude session
When the plugin is uninstalled and events stop arriving
Then the Norbert app does not crash or show error messages
And the app eventually transitions to "No plugin connected" status

### Acceptance Criteria

- [ ] Plugin uninstall removes all 6 hooks from Claude configuration
- [ ] Plugin uninstall removes MCP server registration
- [ ] App data (sessions, events, database) is unaffected by plugin removal
- [ ] App status reverts to "No plugin connected" after plugin removal
- [ ] App handles cessation of events gracefully without crashes

### Technical Notes

- Plugin uninstall is managed entirely by Claude's framework -- no Norbert code handles the uninstall
- The app's transition from "Listening" to "No plugin connected" is timeout-based (no events for N seconds) or triggered by next window open
- Database at ~/.norbert/ is completely independent of the plugin lifecycle

### Dependencies

- US-PIS-004 (plugin install from marketplace) -- must work first to have something to uninstall

---

## US-PIS-006: App Functions Without Plugin Connected

### Problem

Marcus Rivera installed the Norbert app to evaluate it before connecting it to Claude Code. He also wants to browse historical sessions after temporarily disabling the plugin. Currently, the walking skeleton assumes hooks are always registered -- the app does not have a meaningful state for "app running, plugin not connected."

### Who

- Claude Code user | Evaluating Norbert before committing | Wants to browse historical data without active plugin

### Solution

The Norbert app runs fully functional without the plugin. When no plugin is connected (no events arriving), the app shows a clear "No plugin connected" state with guidance on how to connect. Historical sessions and events remain browsable. The sidecar still listens on port 3748 -- it is ready to receive events the moment the plugin is installed.

### Domain Examples

#### 1: First-time evaluation -- Marcus browses the empty app

Marcus just installed Norbert and has not installed the plugin. He opens the window and sees "No plugin connected" with the plugin install command. He explores the UI -- session list is empty, event view is empty. Everything looks intentional. He sees that the sidecar is listening on port 3748, ready.

#### 2: Historical browsing -- Marcus reviews old sessions after removing plugin

Marcus used Norbert with the plugin for a week, capturing 8 sessions. He uninstalls the plugin to troubleshoot an unrelated issue. He opens Norbert and can still browse all 8 sessions, view their events, check costs. The only difference is the status bar shows "No plugin connected" instead of "Listening."

#### 3: Sidecar readiness -- Marcus installs plugin and events flow immediately

Marcus has the Norbert app running in "No plugin connected" state for 2 days. He finally installs the plugin and starts a Claude Code session. Events begin flowing immediately -- no app restart needed, no delay. The sidecar was listening the whole time.

### UAT Scenarios (BDD)

#### Scenario: App shows clear empty state without plugin

Given Marcus Rivera has installed Norbert but not the plugin
When he opens the Norbert app window
Then the status shows "No plugin connected"
And the sidecar is listening on port 3748
And the plugin install command is displayed prominently
And the UI does not show error states or broken indicators

#### Scenario: Historical data accessible without plugin

Given Marcus has 8 stored sessions from when the plugin was active
And the plugin is now uninstalled
When he opens the Norbert app and navigates to the session list
Then all 8 sessions are listed with their timestamps
And he can view session details and event data
And the status shows "No plugin connected"

#### Scenario: No app restart needed when plugin connects

Given Marcus has the Norbert app running in "No plugin connected" state
When he installs the plugin and starts a Claude Code session
Then the Norbert app begins receiving events immediately
And the status transitions to "Listening" without manual restart
And new session data appears alongside any historical data

### Acceptance Criteria

- [ ] App displays "No plugin connected" status when no events are arriving
- [ ] Plugin install command is displayed in empty state
- [ ] Historical sessions and events remain browsable without active plugin
- [ ] Sidecar listens continuously regardless of plugin state
- [ ] App transitions to "Listening" automatically when events begin arriving -- no restart needed

### Technical Notes

- The app's "No plugin connected" vs "Listening" status is event-driven, not configuration-driven
- The sidecar starts and listens on port 3748 regardless of plugin state -- it is always ready
- Status transition logic: "No plugin connected" when no events received since app launch or within a timeout window; "Listening" when events are actively arriving

### Dependencies

- US-PIS-001 (app install without Claude integration) -- establishes the standalone app behavior
