# JTBD Analysis: Plugin Install Split

## Job Classification

**Job Type**: Improve Existing System (Brownfield)
**Workflow**: baseline -> roadmap -> split -> execute -> review

The walking skeleton already bundles app install and Claude Code integration into one step. This feature separates them into two independent concerns, using Claude's plugin framework instead of surgical JSON merging.

---

## Primary Job: Separate App Concerns from Integration Concerns

### Job Statement

"Help me install and manage observability tooling independently from my Claude Code configuration so that each concern can be added, removed, or updated without affecting the other."

### Job Story

**When** I want to add observability to my Claude Code workflow,
**I want to** install the desktop app and the Claude integration as independent steps,
**so I can** use either one without the other, upgrade them separately, and remove the integration cleanly without affecting the app or my Claude configuration.

### Three Dimensions

**Functional**: Install the Norbert desktop app without touching Claude Code settings. Separately install the Norbert plugin through Claude's plugin framework to register hooks and MCP server. Remove the plugin without affecting the app. Run the app without the plugin.

**Emotional**: Feel safe that installing Norbert will not touch my Claude settings until I explicitly choose to connect them. Feel confident that uninstalling the plugin leaves my Claude configuration exactly as it was before.

**Social**: Be seen as a developer who manages tooling deliberately -- adding integrations through official channels (plugin marketplace) rather than tools that silently modify configuration files.

---

## Job Stories

### Job 1: Install the App Without Side Effects

**When** I discover Norbert and want to try the desktop app,
**I want to** install it without it modifying any other tool's configuration,
**so I can** evaluate the app independently before deciding to connect it to Claude Code.

#### Forces Analysis

- **Push**: The current install modifies `~/.claude/settings.json` on first launch without asking. Priya Chandrasekaran discovered Norbert had silently added hooks to her settings when she reviewed the file manually. That felt invasive.
- **Pull**: A clean install that only puts files in `~/.norbert/` and shows a tray icon. No surprises. The app runs, shows its UI, waits for the user to connect it.
- **Anxiety**: Will the app still work if I do not install the plugin? Will it just show an empty screen forever?
- **Habit**: The current walking skeleton installs everything in one step. Users expect "install = fully working." Splitting may feel like extra friction.

**Switch likelihood**: High -- the push (invasive config modification) is a trust violation.
**Key blocker**: Habit of expecting one-step install to mean "fully working."
**Key enabler**: Push of settings modification anxiety.
**Design implication**: The app must clearly communicate its state when running without the plugin -- "Waiting for connection" rather than looking broken.

### Job 2: Connect Norbert to Claude Code via Plugin

**When** I have installed the Norbert app and want it to receive Claude Code events,
**I want to** install the Norbert plugin through Claude's official plugin command,
**so I can** trust that the integration is managed by Claude's framework and can be cleanly removed.

#### Forces Analysis

- **Push**: Manual JSON editing or opaque automatic merging of settings.json creates anxiety about breaking existing configuration. Marcus Rivera had custom MCP servers configured and worried the merge would clobber them.
- **Pull**: `/plugin install norbert@pmvanev-plugins` uses Claude's own plugin framework. Claude manages the hooks. Claude manages the cleanup. The user trusts Claude to handle its own configuration.
- **Anxiety**: Is the plugin marketplace trustworthy? Will the plugin have the right permissions? What if the plugin version does not match the app version?
- **Habit**: The surgical merge was invisible -- it just worked. Now the user must run a second command. That is more steps.

**Switch likelihood**: High -- plugin framework is the officially supported integration path.
**Key blocker**: Extra step (second command) compared to current automatic merge.
**Key enabler**: Trust in Claude's plugin framework over custom JSON surgery.
**Design implication**: The plugin install must be a single, copy-pasteable command. The app should detect when the plugin is connected and transition its UI from "waiting" to "listening."

### Job 3: Remove Integration Without Breaking Either Side

**When** I want to stop Norbert from receiving Claude Code events (temporarily or permanently),
**I want to** uninstall the plugin and have all hooks and MCP registration removed cleanly,
**so I can** trust that my Claude configuration is exactly as it was before I installed Norbert, and that the Norbert app continues to work with its existing stored data.

#### Forces Analysis

- **Push**: The current approach leaves backup files and merged settings entries that the user must manually clean up. When Priya uninstalled Norbert, she found orphaned hook entries in her settings.json.
- **Pull**: `/plugin uninstall norbert` removes everything Claude-side. The Norbert app keeps running with its database intact -- historical sessions are still viewable.
- **Anxiety**: Will uninstalling the plugin delete my stored session data? Will it leave orphaned entries?
- **Habit**: Users expect uninstall to be clean. The current backup-based approach requires manual intervention to fully clean up.

**Switch likelihood**: High -- clean uninstall is table stakes.
**Key blocker**: Anxiety about data loss in the app when removing the plugin.
**Key enabler**: Plugin framework handles its own cleanup automatically.
**Design implication**: The app must clearly separate "plugin data" (hooks, MCP registration -- managed by Claude) from "app data" (sessions, events, database -- managed by Norbert). Uninstalling the plugin touches only Claude's side.

---

## 8-Step Job Map: Plugin Install Split

| Step | Description | Scope |
|------|-------------|-------|
| 1. Define | User decides to try Norbert, reads README | Two-step install instructions: app first, plugin second |
| 2. Locate | User finds install commands | `npx github:pmvanev/norbert-cc` for app, `/plugin install norbert@pmvanev-plugins` for plugin |
| 3. Prepare | App installs binary to `~/.norbert/bin/` | No settings.json modification. App launches standalone. |
| 4. Confirm | User sees tray icon, app shows "No plugin connected" | Clear empty state indicating plugin is the next step |
| 5. Execute | User installs plugin via Claude's `/plugin` command | Claude registers hooks and MCP server through its framework |
| 6. Monitor | User runs a Claude Code session, Norbert receives events | App transitions from "waiting" to "listening" automatically |
| 7. Modify | User removes plugin if needed | `/plugin uninstall norbert` removes hooks/MCP cleanly |
| 8. Conclude | User confirms app still works after plugin removal | Historical data preserved, app shows "No plugin connected" again |

### Overlooked Requirements from Job Map

- **Step 3 (Prepare)**: The postinstall script must NOT call `run_settings_merge()`. First-launch UX must not show "hooks registered" notification.
- **Step 4 (Confirm)**: Empty state must guide the user to install the plugin, not look broken. Show the `/plugin install` command.
- **Step 5 (Execute)**: Plugin directory structure (`plugin/.claude-plugin/plugin.json`, `plugin/hooks/hooks.json`, `plugin/.mcp.json`) must be correct for Claude's plugin framework.
- **Step 7 (Modify)**: After plugin uninstall, the app must detect the absence of incoming events gracefully. No crash, no error spam.
- **Step 8 (Conclude)**: The `~/.norbert/settings.json.bak` backup file is no longer created. Old backups from previous installs may exist and should be harmless.

---

## Outcome Statements

| # | Outcome Statement | Priority |
|---|-------------------|----------|
| 1 | Minimize the likelihood of Norbert modifying Claude Code configuration without explicit user action | Must Have |
| 2 | Minimize the number of steps to connect Norbert to Claude Code after app install | Must Have |
| 3 | Minimize the likelihood of orphaned configuration entries after plugin removal | Must Have |
| 4 | Minimize the time for the app to detect that the plugin has been connected | Should Have |
| 5 | Minimize confusion about what the app can do without the plugin installed | Must Have |
| 6 | Minimize the likelihood of version mismatch between app and plugin | Should Have |

---

## Code Removal Scope

The following code becomes obsolete and must be removed:

- `src-tauri/src/adapters/settings/mod.rs` -- `SettingsMergeAdapter` and all tests
- `src-tauri/src/lib.rs` -- `run_settings_merge()` function and its call in `.setup()`
- `src-tauri/src/ports.rs` -- `SettingsManager` port trait (if solely used for settings merge)
- Domain functions: `build_hooks_only_config()`, `merge_hooks_into_config()`, `hooks_are_merged()`
- `docs/adrs/ADR-006-settings-merge-strategy.md` -- superseded by plugin framework
- First-launch notification logic (restart Claude Code prompt, banner until first event)
- Backup logic that creates `~/.norbert/settings.json.bak`

## Code Addition Scope

New `plugin/` directory in this repo:

```
plugin/
  .claude-plugin/
    plugin.json          # Plugin metadata for Claude's framework
  hooks/
    hooks.json           # 6 async HTTP hooks to localhost:3748
  .mcp.json              # norbert-cc MCP server registration
```

**Out of scope for this repo** (but noted): marketplace.json entry in `pmvanev/claude-marketplace` pointing to this repo's `plugin/` directory via `git-subdir`.
