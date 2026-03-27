# Norbert

Local-first observability for Claude Code.

Norbert is a desktop app that watches your Claude Code sessions and gives you complete visibility into what your AI is doing. It captures every tool call, agent spawn, and session lifecycle event — storing everything locally in SQLite. No cloud services, no telemetry, no data leaves your machine.

Named after Norbert Wiener, the father of cybernetics.

## Quick Start

Installation is two steps: the app, then the Claude Code plugin.

### 1. Install the app

**Git Bash / macOS / Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/pmvanev/norbert/main/install.sh | sh
```

**Windows PowerShell:**

```powershell
irm https://raw.githubusercontent.com/pmvanev/norbert/main/install.ps1 | iex
```

This downloads and installs the Norbert desktop app. It runs as a system tray icon with a local dashboard UI.

### 2. Connect to Claude Code

From inside Claude Code:

```
/plugin marketplace add pmvanev/claude-marketplace
/plugin install norbert@pmvanev-plugins
```

Then run the setup command to configure OpenTelemetry:

```
/norbert:setup
```

This merges the required OTel environment variables into your `~/.claude/settings.json`. Restart Claude Code after running it for the settings to take effect. The command is idempotent — safe to re-run.

The plugin registers hooks so Claude Code sends session events to Norbert. The app and plugin are independent — Norbert runs fine without the plugin (it just won't receive events), and the plugin can be installed or removed without affecting the app or its data.

## Documentation

- [Architecture](docs/architecture.md) — how it works, tech stack
- [Development](docs/development.md) — building from source, local install
