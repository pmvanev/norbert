# Journey Visual: Plugin Install Split

## Journey Overview

Two-phase install journey separating app installation from Claude Code integration.

```
[README]          [App Install]         [App Launch]           [Plugin Install]       [First Session]
   |                   |                     |                       |                      |
   v                   v                     v                       v                      v
"Two steps:        npx github:           Tray icon appears.      /plugin install         Claude sends
 app, then         pmvanev/norbert-cc    Window: "No plugin      norbert@pmvanev-       events. App
 plugin"           Binary → ~/.norbert/  connected"              marketplace            transitions to
                   No settings touched.  Shows install hint.     Claude registers       "Listening"
                                                                 hooks + MCP.           automatically.

Feels:             Feels:                Feels:                  Feels:                 Feels:
Curious            Safe -- nothing       Clear -- knows          Confident --           Satisfied --
                   was modified          what to do next         official channel       it works!
```

## Emotional Arc

```
Confidence
    ^
    |                                                              **** SATISFIED
    |                                                         ****
    |                                                    ****
    |                                          CONFIDENT *
    |                                     ****
    |              SAFE            CLEAR *
    |          ****    ************
    | CURIOUS *
    |****
    +-----------------------------------------------------------------> Time
    README    App Install    App Launch    Plugin Install    First Session
```

**Pattern**: Confidence Building
- Start: Curious -- user discovers Norbert, reads about two-step install
- Middle: Safe/Clear -- app installs without side effects, guides to next step
- Peak: Confident -- plugin installs through Claude's official framework
- End: Satisfied -- events flowing, full pipeline working

---

## Step 1: Read README

**Action**: User reads README on GitHub

```
+-- README.md ---------------------------------------------------+
|                                                                 |
|  ## Quick Start                                                 |
|                                                                 |
|  ### 1. Install the app                                         |
|  npx github:pmvanev/norbert-cc                                  |
|                                                                 |
|  ### 2. Connect to Claude Code                                  |
|  /plugin install norbert@pmvanev-plugins                    |
|                                                                 |
|  That's it. Norbert listens. Claude talks.                      |
|                                                                 |
+-----------------------------------------------------------------+
```

**Emotional state**: Curious -> Clear
**Artifacts**: Install command, plugin command

---

## Step 2: App Install

**Action**: `npx github:pmvanev/norbert-cc`

```
+-- Terminal ------------------------------------------------------+
|                                                                  |
|  $ npx github:pmvanev/norbert-cc                                 |
|                                                                  |
|  norbert v0.2.0                                                  |
|  Downloading binary for win32-x64...                             |
|  Installed to ~/.norbert/bin/norbert                              |
|  Launching Norbert...                                            |
|                                                                  |
|  Norbert is running in the system tray.                          |
|  To connect to Claude Code: /plugin install                      |
|    norbert@pmvanev-plugins                                   |
|                                                                  |
+------------------------------------------------------------------+
```

**Emotional state**: Safe -- nothing modified outside `~/.norbert/`
**Key change from walking skeleton**: No `run_settings_merge()`. No backup. No settings.json touched.

---

## Step 3: App Launch (Standalone)

**Action**: User clicks tray icon

```
+-- Norbert v0.2.0 -----------------------------------------------+
|                                                                  |
|  Status: No plugin connected                                     |
|  Port:   3748 (listening)                                        |
|                                                                  |
|  +------------------------------------------------------------+ |
|  |  Connect Norbert to Claude Code:                            | |
|  |                                                             | |
|  |  /plugin install norbert@pmvanev-plugins                | |
|  |                                                             | |
|  |  Run this command in any Claude Code session.               | |
|  +------------------------------------------------------------+ |
|                                                                  |
|  Sessions: 0    Events: 0                                        |
|                                                                  |
+------------------------------------------------------------------+
```

**Emotional state**: Clear -- user knows what to do next, app does not look broken
**Key change from walking skeleton**: No "hooks registered" notification. No "restart Claude Code" banner. Instead, a helpful prompt showing the plugin install command.

---

## Step 4: Plugin Install

**Action**: User types `/plugin install norbert@pmvanev-plugins` in Claude Code

```
+-- Claude Code ---------------------------------------------------+
|                                                                  |
|  > /plugin install norbert@pmvanev-plugins                   |
|                                                                  |
|  Installing plugin norbert from pmvanev-plugins...           |
|  Registered 6 hooks (async HTTP to localhost:3748)               |
|  Registered MCP server: norbert (stdio)                          |
|  Plugin installed successfully.                                  |
|                                                                  |
+------------------------------------------------------------------+
```

**Emotional state**: Confident -- Claude's own framework handles registration
**Artifacts produced**: Hook registration, MCP server registration (managed by Claude)

---

## Step 5: First Session with Plugin

**Action**: User starts a Claude Code session

```
+-- Norbert v0.2.0 -----------------------------------------------+
|                                                                  |
|  Status: Listening                                               |
|  Port:   3748 (receiving)                                        |
|                                                                  |
|  Sessions: 1    Events: 12                                       |
|                                                                  |
|  Latest: session_abc123 (active)                                 |
|    Started: 2026-03-09 14:32:01                                  |
|    Events:  12 (SessionStart, UserPromptSubmit, ...)             |
|                                                                  |
+------------------------------------------------------------------+
```

**Emotional state**: Satisfied -- the full pipeline works
**Transition**: App automatically detects incoming events and updates status from "No plugin connected" to "Listening"

---

## Uninstall Path

**Action**: User types `/plugin uninstall norbert` in Claude Code

```
+-- Claude Code ---------------------------------------------------+
|                                                                  |
|  > /plugin uninstall norbert                                     |
|                                                                  |
|  Removing plugin norbert...                                      |
|  Removed 6 hooks                                                 |
|  Removed MCP server: norbert                                     |
|  Plugin uninstalled.                                             |
|                                                                  |
+------------------------------------------------------------------+
```

```
+-- Norbert v0.2.0 -----------------------------------------------+
|                                                                  |
|  Status: No plugin connected                                     |
|  Port:   3748 (listening)                                        |
|                                                                  |
|  Sessions: 14    Events: 847                                     |
|                                                                  |
|  Historical data preserved. Reconnect anytime:                   |
|  /plugin install norbert@pmvanev-plugins                     |
|                                                                  |
+------------------------------------------------------------------+
```

**Emotional state**: Relieved -- clean removal, data preserved
**Key point**: App keeps all historical data. Only the Claude-side integration is removed.
