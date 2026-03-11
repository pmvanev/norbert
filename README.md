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

This registers hooks so Claude Code sends session events to Norbert. The app and plugin are independent — Norbert runs fine without the plugin (it just won't receive events), and the plugin can be installed or removed without affecting the app or its data.

## How it works

Norbert listens on `localhost:3748` for HTTP hook events from Claude Code. Each event (tool use, agent activity, session start/stop) is stored in a local SQLite database. The dashboard gives you real-time and historical views of your sessions.

The plugin also registers an MCP server that lets Claude query Norbert's data directly — session history, event counts, and usage statistics.

## Tech stack

- **Desktop shell**: Tauri 2.0 (single binary, system tray)
- **Backend**: Rust (modular monolith, ports-and-adapters)
- **Frontend**: React + TypeScript + Vite
- **Storage**: SQLite with WAL mode
- **Hook receiver**: Axum HTTP server (async, non-blocking)
