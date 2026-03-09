Feature: Plugin Install Split
  As a Claude Code user who wants observability,
  I want to install the Norbert app and Claude plugin independently,
  so that each concern can be managed, updated, and removed without affecting the other.

  Background:
    Given Priya Chandrasekaran uses Claude Code on Windows 11
    And she has existing Claude Code configuration with custom MCP servers

  # --- App Install (no Claude integration) ---

  Scenario: App installs without modifying Claude settings
    Given Priya's ~/.claude/settings.json contains her existing configuration
    When she runs "npx github:pmvanev/norbert-cc"
    Then the Norbert binary is installed to ~/.norbert/bin/
    And the Norbert tray icon appears in the Windows system tray
    And her ~/.claude/settings.json is byte-identical to before the install
    And no ~/.norbert/settings.json.bak file is created

  Scenario: App shows helpful empty state without plugin
    Given Norbert is installed and running in the system tray
    And no Norbert plugin is installed in Claude Code
    When Priya clicks the tray icon to open the window
    Then the status shows "No plugin connected"
    And the hook receiver sidecar is listening on port 3748
    And the window displays "/plugin install norbert@pmvanev-marketplace"
    And session count shows 0 and event count shows 0

  Scenario: App terminal output shows plugin install hint
    When Priya runs "npx github:pmvanev/norbert-cc"
    Then the terminal output includes "To connect to Claude Code:"
    And the terminal output includes "/plugin install norbert@pmvanev-marketplace"

  # --- Plugin Install ---

  Scenario: Plugin installs hooks and MCP server via Claude framework
    Given Priya has the Norbert app running with sidecar on port 3748
    When she runs "/plugin install norbert@pmvanev-marketplace" in Claude Code
    Then Claude registers 6 async HTTP hooks:
      | Hook              | URL                                          |
      | PreToolUse        | http://localhost:3748/hooks/PreToolUse        |
      | PostToolUse       | http://localhost:3748/hooks/PostToolUse       |
      | SubagentStop      | http://localhost:3748/hooks/SubagentStop      |
      | Stop              | http://localhost:3748/hooks/Stop              |
      | SessionStart      | http://localhost:3748/hooks/SessionStart      |
      | UserPromptSubmit  | http://localhost:3748/hooks/UserPromptSubmit  |
    And Claude registers the norbert MCP server with stdio transport
    And the command is "norbert-cc" with args ["mcp"]

  Scenario: App detects plugin connection automatically
    Given Priya has the Norbert app running showing "No plugin connected"
    And she has installed the Norbert plugin in Claude Code
    When she starts a Claude Code session and submits a prompt
    Then the Norbert app status transitions to "Listening"
    And the session count increments to 1
    And events appear as Claude Code sends hook data

  # --- Plugin Uninstall ---

  Scenario: Plugin uninstall removes all hooks cleanly
    Given Priya has the Norbert plugin installed in Claude Code
    When she runs "/plugin uninstall norbert" in Claude Code
    Then all 6 hook registrations are removed from Claude's configuration
    And the norbert MCP server is deregistered
    And no orphaned Norbert entries remain in Claude's settings

  Scenario: App preserves data after plugin uninstall
    Given Priya's Norbert app has 14 stored sessions and 847 events
    And the Norbert plugin is installed in Claude Code
    When she runs "/plugin uninstall norbert" in Claude Code
    Then the Norbert app still shows 14 sessions and 847 events
    And the app status returns to "No plugin connected"
    And the app window displays the plugin install command for reconnection

  # --- App functions without plugin ---

  Scenario: App runs standalone browsing historical data
    Given Priya previously used Norbert with the plugin for 2 weeks
    And she has uninstalled the Norbert plugin from Claude Code
    When she opens the Norbert app window
    Then she can browse all 14 previously captured sessions
    And she can view session details and event timelines
    And the status shows "No plugin connected"

  # --- Settings merge code removal ---

  Scenario: First launch does not trigger settings merge
    Given Priya runs "npx github:pmvanev/norbert-cc" for the first time
    When the Norbert app initializes
    Then no settings merge operation is attempted
    And no "Restart Claude Code" notification is shown
    And no first-launch banner about hooks appears

  # --- Plugin directory structure ---

  Scenario: Plugin directory contains required files
    Given the Norbert repository has a plugin/ directory
    Then plugin/.claude-plugin/plugin.json exists with plugin metadata
    And plugin/hooks/hooks.json exists with 6 async HTTP hook definitions
    And plugin/.mcp.json exists with the norbert MCP server definition
    And all hook URLs point to localhost:3748
