# Architecture

How Norbert works and what it's built with.

## How it works

Norbert listens on `localhost:3748` for HTTP hook events from Claude Code. Each event (tool use, agent activity, session start/stop) is stored in a local SQLite database. The dashboard gives you real-time and historical views of your sessions.

The plugin also registers an MCP server that lets Claude query Norbert's data directly — session history, event counts, and usage statistics.

## Tech stack

- **Desktop shell**: Tauri 2.0 (single binary, system tray)
- **Backend**: Rust (modular monolith, ports-and-adapters)
- **Frontend**: React + TypeScript + Vite
- **Storage**: SQLite with WAL mode
- **Hook receiver**: Axum HTTP server (async, non-blocking)
