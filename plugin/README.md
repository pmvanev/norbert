# Norbert Plugin for Claude Code

Connects the Norbert desktop app to Claude Code by registering HTTP hooks and an MCP server.

When installed, Claude Code sends session lifecycle events (tool use, agent activity, session start/stop) to Norbert's local hook receiver on port 3748. Norbert stores these events in a local SQLite database for observability, replay, and analytics.

The plugin also registers an MCP server that gives Claude read-only access to Norbert's session data.

## Prerequisites

Norbert must be installed and running before the plugin can deliver events.

```bash
npx github:pmvanev/norbert-cc
```

## Install

From inside Claude Code:

```
/plugin marketplace add pmvanev/claude-marketplace
/plugin install norbert@pmvanev-plugins
```

## Uninstall

```
/plugin uninstall norbert@pmvanev-plugins
```

This cleanly removes all hooks and the MCP server. Norbert's app and historical data are unaffected.

## What it registers

**6 HTTP hooks** (all async, non-blocking):
- PreToolUse, PostToolUse, SubagentStop, Stop, SessionStart, UserPromptSubmit

**1 MCP server** (`norbert`):
- Provides tools to query sessions, events, and usage data from Norbert's local database
