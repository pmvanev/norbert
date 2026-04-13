Feature: MCP Server Discovery -- Walking Skeletons
  As a Claude Code user with MCP servers configured across multiple files,
  I want to see all my MCP servers in one place with their source origin,
  so I can verify my configuration without manually reading each file.

  Background:
    Given the user has the Configuration Viewer open on the MCP tab

  @walking_skeleton
  Scenario: User sees MCP servers from all configuration sources in one view
    Given the user has "filesystem-server" configured in settings.json
    And the user has "memory-server" configured in .claude.json
    And the user has "git-server" configured in the project .mcp.json
    And the user has "discord-server" configured by the "discord" plugin
    When the MCP tab displays all discovered servers
    Then 4 server cards appear
    And "filesystem-server" shows source "settings.json"
    And "memory-server" shows source ".claude.json"
    And "git-server" shows source ".mcp.json"
    And "discord-server" shows source "discord"

  @walking_skeleton
  Scenario: User identifies where each MCP server is configured
    Given "api-server" is configured in settings.json with user scope
    And "local-db" is configured in .mcp.json with project scope
    And "slack-bot" is configured by the "slack" plugin with plugin scope
    When the user views the MCP server cards
    Then "api-server" shows scope "user" and source "settings.json"
    And "local-db" shows scope "project" and source ".mcp.json"
    And "slack-bot" shows scope "plugin" and source "slack"

  @walking_skeleton
  Scenario: Missing configuration files produce an empty view without errors
    Given no MCP configuration files exist on the filesystem
    When the MCP tab loads
    Then no server cards appear
    And the empty state message lists all configuration locations checked
    And no error indicators are shown
